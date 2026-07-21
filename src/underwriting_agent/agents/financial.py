"""Financial Analysis subagent — DSCR/DTI and risk tier from structured inputs."""

from underwriting_agent.models import Applicant, FinancialAnalysis


def analyze_financials(applicant: Applicant) -> FinancialAnalysis:
    """Deterministic first-pass ratios. LLM enrichment comes later."""
    revenue = max(applicant.annual_revenue, 1.0)
    dti = applicant.requested_loan_amount / revenue

    if dti < 0.25 and (applicant.credit_score_proxy or 0) >= 700:
        tier, score = "low", 0.2
    elif dti < 0.5:
        tier, score = "medium", 0.5
    else:
        tier, score = "high", 0.85

    notes = [f"loan_to_revenue={dti:.3f}", f"risk_tier={tier}"]
    if applicant.debt_service_coverage_ratio is not None:
        notes.append(f"dscr={applicant.debt_service_coverage_ratio:.3f}")

    return FinancialAnalysis(
        debt_to_income=dti,
        risk_score=score,
        risk_tier=tier,
        notes=notes,
    )
