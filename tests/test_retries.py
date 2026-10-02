"""Provider error taxonomy + fail-closed outage path (no stacked app retries)."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import httpx
import pytest

from agents.critic import critique_outputs
from graph import build_graph
from models import (
    Applicant,
    CritiqueVerdict,
    DecisionOutcome,
    SubagentName,
    SubagentOutput,
)
from retries import (
    DATABASE_UNAVAILABLE_MESSAGE,
    DatabaseUnavailableError,
    ProviderOutageError,
    RetryableProviderError,
    call_with_retry,
    classify_provider_error,
    is_database_unavailable,
    is_fatal_provider_error,
    is_retryable,
    should_retry_node,
)


def _applicant(**overrides: Any) -> Applicant:
    return Applicant(
        applicant_id="a-retry",
        business_name="Retry Co",
        industry="retail",
        annual_revenue=500_000,
        requested_loan_amount=50_000,
        years_in_business=5,
        credit_score_proxy=720,
        debt_service_coverage_ratio=1.4,
        sbss_proxy=180,
    ).model_copy(update=overrides)


def test_is_retryable_for_connection_and_429() -> None:
    assert is_retryable(ConnectionError("voyage down"))
    assert is_retryable(TimeoutError("timed out"))
    assert is_retryable(RetryableProviderError("blip"))
    request = httpx.Request("POST", "https://api.example.test")
    response = httpx.Response(429, request=request)
    assert is_retryable(httpx.HTTPStatusError("rate limited", request=request, response=response))
    assert is_retryable(RuntimeError("Error code: 429 - rate limit exceeded"))
    assert not is_retryable(ProviderOutageError("exhausted"))
    assert not is_retryable(ValueError("bad applicant"))
    bad = httpx.Response(400, request=request)
    assert not is_retryable(httpx.HTTPStatusError("bad request", request=request, response=bad))


def test_quota_and_auth_are_fatal_and_not_retryable() -> None:
    quota = RuntimeError(
        "Error code: 429 - {'error': {'message': 'You have no credits remaining.', "
        "'type': 'insufficient_quota', 'code': 'credit_balance_exhausted'}}"
    )
    assert is_fatal_provider_error(quota)
    assert not is_retryable(quota)
    assert not should_retry_node(quota)
    request = httpx.Request("GET", "https://api.example.test")
    unauthorized = httpx.HTTPStatusError(
        "unauthorized",
        request=request,
        response=httpx.Response(401, request=request),
    )
    assert is_fatal_provider_error(unauthorized)
    assert not is_retryable(unauthorized)


def test_nodes_do_not_retry_provider_failures() -> None:
    assert should_retry_node(ConnectionError("voyage down")) is False
    assert should_retry_node(RetryableProviderError("blip")) is False
    assert should_retry_node(ProviderOutageError("done")) is False


def test_classify_wraps_retryable() -> None:
    wrapped = classify_provider_error(ConnectionError("reset"))
    assert isinstance(wrapped, RetryableProviderError)
    original = ValueError("nope")
    assert classify_provider_error(original) is original
    quota = RuntimeError("insufficient_quota: no credits remaining")
    assert classify_provider_error(quota) is quota


def test_call_with_retry_succeeds_after_blip() -> None:
    calls = {"n": 0}

    def flaky() -> str:
        calls["n"] += 1
        if calls["n"] < 3:
            raise ConnectionError("blip")
        return "ok"

    assert call_with_retry(flaky, operation="test_infra", sleep=lambda _: None) == "ok"
    assert calls["n"] == 3


def test_call_with_retry_does_not_retry_quota() -> None:
    calls = {"n": 0}

    def billed() -> str:
        calls["n"] += 1
        raise RuntimeError("insufficient_quota: You have no credits remaining.")

    with pytest.raises(RuntimeError, match="insufficient_quota"):
        call_with_retry(billed, operation="test_llm", sleep=lambda _: None)
    assert calls["n"] == 1


def test_call_with_retry_does_not_retry_logic_errors() -> None:
    calls = {"n": 0}

    def boom() -> str:
        calls["n"] += 1
        raise ValueError("bad input")

    with pytest.raises(ValueError, match="bad input"):
        call_with_retry(boom, operation="test_infra", sleep=lambda _: None)
    assert calls["n"] == 1


def test_critic_escalates_on_provider_outage_without_send() -> None:
    report = critique_outputs(
        {
            SubagentName.FINANCIAL.value: SubagentOutput(
                agent=SubagentName.FINANCIAL,
                conclusion="ok",
                confidence=0.8,
                reasoning_trace="ok",
                metrics=None,
            ),
            SubagentName.POLICY.value: SubagentOutput(
                agent=SubagentName.POLICY,
                conclusion="outage",
                confidence=0.0,
                reasoning_trace="provider_outage=true",
                provider_outage=True,
                provider_outage_reason="voyage down",
            ),
        }
    )
    assert report.verdict == CritiqueVerdict.ESCALATE
    assert report.rerun_targets == []
    assert "provider outage" in report.notes


def test_graph_provider_outage_fail_closed_on_first_error() -> None:
    calls = {"n": 0}

    def once(*_args: object, **_kwargs: object) -> list[Any]:
        calls["n"] += 1
        raise ConnectionError("voyage down")

    g = build_graph()
    with patch("agents.policy._retrieve_citations_once", side_effect=once):
        result = g.invoke({"applicant": _applicant()})
    assert calls["n"] == 1
    assert result["decision"].outcome == DecisionOutcome.ESCALATE
    assert result.get("provider_outage") is True
    assert result["escalation"] is not None
    policy = result["subagent_outputs"][SubagentName.POLICY.value]
    assert policy.provider_outage is True
    assert any(e.event == "provider_outage" for e in result["audit_trail"])
    assert any(e.event == "escalation" for e in result["audit_trail"])


def test_graph_quota_fail_closed_without_retry() -> None:
    calls = {"n": 0}

    def billed(*_args: object, **_kwargs: object) -> list[Any]:
        calls["n"] += 1
        raise RuntimeError("insufficient_quota: You have no credits remaining.")

    g = build_graph()
    with patch("agents.policy._retrieve_citations_once", side_effect=billed):
        result = g.invoke({"applicant": _applicant()})
    assert calls["n"] == 1
    assert result["decision"].outcome == DecisionOutcome.ESCALATE
    assert result.get("provider_outage") is True


class _PsycopgOperationalError(Exception):
    """Stand-in for psycopg.OperationalError without requiring a live driver."""


_PsycopgOperationalError.__module__ = "psycopg"


def _db_down(*_args: object, **_kwargs: object) -> None:
    raise _PsycopgOperationalError(
        'connection failed: connection to server at "127.0.0.1", port 54326 failed: '
        "Connection refused"
    )


def test_database_outage_is_not_a_provider_retry() -> None:
    with pytest.raises(_PsycopgOperationalError) as raised:
        _db_down()
    exc = raised.value
    assert is_database_unavailable(exc)
    assert not is_retryable(exc)
    assert classify_provider_error(exc) is exc
    assert not is_database_unavailable(ConnectionError("voyage down"))


def test_graph_database_outage_is_not_a_decision() -> None:
    g = build_graph()
    with (
        patch("agents.policy._retrieve_citations_once", side_effect=_db_down),
        pytest.raises(DatabaseUnavailableError, match="Policy database is unreachable"),
    ):
        g.invoke({"applicant": _applicant()})


def test_graph_hard_reject_survives_database_outage() -> None:
    g = build_graph()
    with patch("agents.policy._retrieve_citations_once", side_effect=_db_down):
        result = g.invoke({"applicant": _applicant(has_bankruptcy=True)})
    assert result["decision"].outcome == DecisionOutcome.DENY
    assert DATABASE_UNAVAILABLE_MESSAGE not in result["decision"].rationale.text
    assert "54326" not in result["decision"].rationale.text


def test_graph_hard_reject_survives_retrieval_outage() -> None:
    g = build_graph()
    with patch(
        "agents.policy._retrieve_citations_once",
        side_effect=ConnectionError("voyage down"),
    ):
        result = g.invoke({"applicant": _applicant(has_bankruptcy=True)})
    assert result["decision"].outcome == DecisionOutcome.DENY
    assert result["decision"].adverse_action_reasons
    assert not result.get("provider_outage")
