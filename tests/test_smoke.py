"""Smoke tests for hard-coded risk ceiling and package imports."""

from underwriting_agent.graph import apply_risk_ceiling
from underwriting_agent.models import DecisionOutcome
from underwriting_agent.agents import analyze_financials
from underwriting_agent.models import Applicant


def test_risk_ceiling_blocks_approve() -> None:
    outcome, triggered = apply_risk_ceiling(0.9, DecisionOutcome.APPROVE)
    assert triggered is True
    assert outcome == DecisionOutcome.ESCALATE


def test_risk_ceiling_allows_low_risk_approve() -> None:
    outcome, triggered = apply_risk_ceiling(0.2, DecisionOutcome.APPROVE)
    assert triggered is False
    assert outcome == DecisionOutcome.APPROVE


def test_financial_analysis_runs() -> None:
    applicant = Applicant(
        applicant_id="a-1",
        business_name="Acme Bakery",
        industry="food_services",
        annual_revenue=500_000,
        requested_loan_amount=50_000,
        years_in_business=5,
        credit_score_proxy=720,
    )
    result = analyze_financials(applicant)
    assert result.risk_tier == "low"
    assert 0.0 <= result.risk_score <= 1.0
