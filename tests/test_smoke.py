"""Smoke tests for risk ceiling, agents, and system-design graph shape."""

from typing import Any

from langgraph.types import Send

from agents import analyze_financials, check_policy_compliance
from graph import apply_risk_ceiling, build_graph
from graph.nodes import route_after_critic
from models import (
    Applicant,
    CritiqueReport,
    CritiqueVerdict,
    DecisionOutcome,
    RiskTier,
    SubagentName,
)


def _applicant(**overrides: Any) -> Applicant:
    return Applicant(
        applicant_id="a-1",
        business_name="Acme Bakery",
        industry="food_services",
        annual_revenue=500_000,
        requested_loan_amount=50_000,
        years_in_business=5,
        credit_score_proxy=720,
    ).model_copy(update=overrides)


def test_risk_ceiling_blocks_approve() -> None:
    outcome, triggered, tier = apply_risk_ceiling(0.9, DecisionOutcome.APPROVE)
    assert triggered is True
    assert outcome == DecisionOutcome.ESCALATE
    assert tier == RiskTier.PROHIBITED


def test_risk_ceiling_allows_low_risk_approve() -> None:
    outcome, triggered, tier = apply_risk_ceiling(0.2, DecisionOutcome.APPROVE)
    assert triggered is False
    assert outcome == DecisionOutcome.APPROVE
    assert tier is None


def test_financial_analysis_runs() -> None:
    result = analyze_financials(_applicant())
    assert result.metrics is not None
    assert result.metrics.risk_tier == RiskTier.LOW
    assert 0.0 <= result.metrics.risk_score <= 1.0


def test_policy_hard_reject_bankruptcy() -> None:
    report = check_policy_compliance(_applicant(has_bankruptcy=True))
    assert report.hard_reject is True


def test_graph_clean_path_approves_low_risk() -> None:
    g = build_graph()
    result = g.invoke(
        {
            "thread_id": "t-1",
            "user_id": "u-1",
            "applicant": _applicant(),
        }
    )
    assert result["decision"].outcome == DecisionOutcome.APPROVE
    assert result.get("audit_trail")
    assert result["audit_trail"][-1].event == "case_complete"
    assert result.get("escalation") is None
    assert SubagentName.FINANCIAL.value in result["subagent_outputs"]
    assert SubagentName.POLICY.value in result["subagent_outputs"]


def test_graph_hard_reject_denies() -> None:
    g = build_graph()
    result = g.invoke({"applicant": _applicant(has_severe_fraud_alert=True)})
    assert result["decision"].outcome == DecisionOutcome.DENY
    assert result["decision"].adverse_action_reasons
    assert result["audit_trail"][-1].event == "case_complete"


def test_graph_ceiling_escalates() -> None:
    g = build_graph()
    result = g.invoke(
        {
            "applicant": _applicant(
                annual_revenue=100_000,
                requested_loan_amount=90_000,
                credit_score_proxy=600,
            )
        }
    )
    assert result["decision"].outcome == DecisionOutcome.ESCALATE
    assert result["decision"].ceiling_triggered is True
    assert result["decision"].risk_tier == RiskTier.PROHIBITED
    assert result["escalation"] is not None
    assert result["human_review"] is not None
    assert result["human_review"].pending is True
    assert any(e.event == "escalation" for e in result["audit_trail"])


def test_route_after_critic_sends_only_flagged_targets() -> None:
    state = {
        "retry_count": 1,
        "critique_history": [
            CritiqueReport(
                verdict=CritiqueVerdict.RETRY,
                rerun_targets=[SubagentName.FINANCIAL],
                notes="retry financial",
            )
        ],
    }
    routed = route_after_critic(state)  # type: ignore[arg-type]
    assert isinstance(routed, list)
    assert len(routed) == 1
    assert isinstance(routed[0], Send)
    assert routed[0].node == "financial_analysis"


def test_route_after_critic_sends_both_when_needed() -> None:
    state = {
        "retry_count": 1,
        "critique_history": [
            CritiqueReport(
                verdict=CritiqueVerdict.RETRY,
                rerun_targets=[SubagentName.FINANCIAL, SubagentName.POLICY],
            )
        ],
    }
    routed = route_after_critic(state)  # type: ignore[arg-type]
    assert isinstance(routed, list)
    assert {s.node for s in routed} == {"financial_analysis", "policy_compliance"}


def test_route_after_critic_proceeds_when_pass() -> None:
    state = {
        "retry_count": 0,
        "critique_history": [CritiqueReport(verdict=CritiqueVerdict.PASS)],
    }
    assert route_after_critic(state) == "decision"  # type: ignore[arg-type]


def test_audit_trail_is_hash_chained() -> None:
    g = build_graph()
    result = g.invoke({"applicant": _applicant()})
    trail = result["audit_trail"]
    assert len(trail) >= 3
    for i in range(1, len(trail)):
        assert trail[i].prev_hash == trail[i - 1].entry_hash
