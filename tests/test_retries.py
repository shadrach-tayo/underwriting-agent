"""Provider retry helper + LangGraph fail-closed outage path."""

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
    ProviderOutageError,
    RetryableProviderError,
    call_with_retry,
    classify_provider_error,
    is_retryable,
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


def test_classify_wraps_retryable() -> None:
    wrapped = classify_provider_error(ConnectionError("reset"))
    assert isinstance(wrapped, RetryableProviderError)
    original = ValueError("nope")
    assert classify_provider_error(original) is original


def test_call_with_retry_succeeds_after_blip() -> None:
    calls = {"n": 0}

    def flaky() -> str:
        calls["n"] += 1
        if calls["n"] < 3:
            raise ConnectionError("blip")
        return "ok"

    assert call_with_retry(flaky, operation="test_retrieve", sleep=lambda _: None) == "ok"
    assert calls["n"] == 3


def test_call_with_retry_exhausts_to_outage() -> None:
    def always_down() -> str:
        raise ConnectionError("down")

    with pytest.raises(ProviderOutageError, match="test_retrieve"):
        call_with_retry(always_down, operation="test_retrieve", attempts=3, sleep=lambda _: None)


def test_call_with_retry_does_not_retry_logic_errors() -> None:
    calls = {"n": 0}

    def boom() -> str:
        calls["n"] += 1
        raise ValueError("bad input")

    with pytest.raises(ValueError, match="bad input"):
        call_with_retry(boom, operation="test_retrieve", sleep=lambda _: None)
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


def test_graph_retries_then_succeeds() -> None:
    from datetime import datetime, timezone

    from models import Citation, PolicyLayer, PolicySource

    stub = [
        Citation(
            clause_id="stub:eligibility",
            source=PolicySource(
                source_id="stub",
                name="stub-policy",
                authority="lender",
                version="test",
                effective_date=datetime(2024, 1, 1, tzinfo=timezone.utc),
                program=PolicyLayer.ELIGIBILITY_GATE,
            ),
            retrieved_text="Stub citation.",
            similarity_score=0.5,
            program=PolicyLayer.ELIGIBILITY_GATE,
        )
    ]
    calls = {"n": 0}

    def flaky(*_args: object, **_kwargs: object) -> list[Citation]:
        calls["n"] += 1
        if calls["n"] < 3:
            raise ConnectionError("voyage blip")
        return stub

    g = build_graph()
    with patch("agents.policy._retrieve_citations_once", side_effect=flaky):
        result = g.invoke({"applicant": _applicant()})
    assert calls["n"] == 3
    assert result["decision"].outcome == DecisionOutcome.APPROVE
    assert not result.get("provider_outage")


def test_graph_node_retry_policy_then_succeeds() -> None:
    from datetime import datetime, timezone

    from models import Citation, PolicyLayer, PolicySource

    stub = [
        Citation(
            clause_id="stub:eligibility",
            source=PolicySource(
                source_id="stub",
                name="stub-policy",
                authority="lender",
                version="test",
                effective_date=datetime(2024, 1, 1, tzinfo=timezone.utc),
                program=PolicyLayer.ELIGIBILITY_GATE,
            ),
            retrieved_text="Stub citation.",
            similarity_score=0.5,
            program=PolicyLayer.ELIGIBILITY_GATE,
        )
    ]
    calls = {"n": 0}

    def flaky(state: dict[str, Any]) -> SubagentOutput:
        calls["n"] += 1
        if calls["n"] < 3:
            raise ConnectionError("node blip")
        from agents.policy import run_policy_subagent as real

        with patch("agents.policy._retrieve_citations", return_value=stub):
            return real(state)

    g = build_graph()
    with patch("graph.nodes.run_policy_subagent", side_effect=flaky):
        result = g.invoke({"applicant": _applicant()})
    assert calls["n"] == 3
    assert result["decision"].outcome == DecisionOutcome.APPROVE


def test_graph_provider_outage_fail_closed_escalates() -> None:
    g = build_graph()
    with patch(
        "agents.policy._retrieve_citations_once",
        side_effect=ConnectionError("voyage down"),
    ):
        result = g.invoke({"applicant": _applicant()})
    assert result["decision"].outcome == DecisionOutcome.ESCALATE
    assert result.get("provider_outage") is True
    assert result["escalation"] is not None
    policy = result["subagent_outputs"][SubagentName.POLICY.value]
    assert policy.provider_outage is True
    assert any(e.event == "provider_outage" for e in result["audit_trail"])
    assert any(e.event == "escalation" for e in result["audit_trail"])


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
