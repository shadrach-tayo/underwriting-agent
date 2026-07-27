"""Financial Analysis subagent — ratios, risk tier, term-mod suggestions."""

from __future__ import annotations

from underwriting_agent.models import (
    Applicant,
    FinancialMetrics,
    RiskTier,
    SubagentName,
    SubagentOutput,
)
from underwriting_agent.subagent_state import SubagentState


def _tier_and_score(applicant: Applicant) -> tuple[RiskTier, float]:
    revenue = max(applicant.annual_revenue, 1.0)
    dti = applicant.requested_loan_amount / revenue
    if dti < 0.25 and (applicant.credit_score_proxy or 0) >= 700:
        return RiskTier.LOW, 0.2
    if dti < 0.5:
        return RiskTier.MEDIUM, 0.5
    return RiskTier.HIGH, 0.85


def run_financial_subagent(state: SubagentState) -> SubagentOutput:
    """Run one financial analysis cycle from isolated SubagentState."""
    applicant = state["applicant"]
    retry_index = state.get("retry_index", 0)
    feedback = state.get("critique_feedback")

    tier, score = _tier_and_score(applicant)
    dti = applicant.requested_loan_amount / max(applicant.annual_revenue, 1.0)
    dscr = applicant.debt_service_coverage_ratio

    notes = [f"loan_to_revenue={dti:.3f}", f"risk_tier={tier.value}"]
    if dscr is not None:
        notes.append(f"dscr={dscr:.3f}")
    if feedback and feedback.notes:
        notes.append(f"critic_feedback: {feedback.notes}")
    if state.get("reuse_evidence") and state.get("prior_output"):
        notes.append("reuse_evidence=true (re-reason pass)")

    term_mods: list[str] = []
    if tier == RiskTier.HIGH:
        term_mods.append("Consider lowering requested amount or increasing rate")
    elif tier == RiskTier.MEDIUM and dscr is not None and dscr < 1.25:
        term_mods.append("Consider shorter tenor or partial guarantee")

    metrics = FinancialMetrics(
        debt_to_income=dti,
        debt_service_coverage=dscr,
        risk_score=score,
        risk_tier=tier,
        recommended_term_mods=term_mods,
    )
    return SubagentOutput(
        agent=SubagentName.FINANCIAL,
        conclusion=f"Financial risk tier={tier.value} score={score:.2f}",
        confidence=max(0.0, 1.0 - score),
        reasoning_trace="; ".join(notes),
        metrics=metrics,
        retry_index=retry_index,
    )


def analyze_financials(applicant: Applicant, *, attempt: int = 1) -> SubagentOutput:
    """Convenience wrapper for unit tests / direct calls."""
    return run_financial_subagent(
        {
            "agent": SubagentName.FINANCIAL,
            "applicant": applicant,
            "retry_index": max(0, attempt - 1),
            "reuse_evidence": attempt > 1,
        }
    )
