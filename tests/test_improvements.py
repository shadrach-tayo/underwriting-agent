"""Improvement-action unit tests."""

from __future__ import annotations

from agents.improvements import compute_improvement_actions
from agents.program_routing import compute_program_routing
from models import (
    Applicant,
    DecisionOutcome,
    FinancialMetrics,
    RiskTier,
)


def test_high_leverage_suggests_loan_reduction() -> None:
    applicant = Applicant(
        applicant_id="A-1",
        business_name="Leverage Co",
        industry="wholesale trade",
        annual_revenue=100_000,
        requested_loan_amount=400_000,
        years_in_business=3,
        debt_service_coverage_ratio=1.0,
        credit_score_proxy=700,
        sbss_proxy=180,
    )
    routing = compute_program_routing(applicant)
    metrics = FinancialMetrics(
        debt_to_income=4.0,
        debt_service_coverage=1.0,
        risk_score=0.85,
        risk_tier=RiskTier.HIGH,
        recommended_term_mods=["Consider lowering requested amount or increasing rate"],
    )
    actions = compute_improvement_actions(
        applicant,
        metrics=metrics,
        routing=routing,
        outcome=DecisionOutcome.ESCALATE,
        ceiling_triggered=True,
    )
    titles = [a.title for a in actions]
    assert any("Reduce requested loan" in t for t in titles)
    assert any(a.target and "Loan ≤" in a.target for a in actions)


def test_approve_returns_no_actions() -> None:
    applicant = Applicant(
        applicant_id="A-2",
        business_name="Strong Co",
        industry="wholesale trade",
        annual_revenue=500_000,
        requested_loan_amount=50_000,
        years_in_business=5,
        debt_service_coverage_ratio=1.5,
        credit_score_proxy=720,
        sbss_proxy=190,
    )
    actions = compute_improvement_actions(
        applicant,
        metrics=FinancialMetrics(
            debt_to_income=0.1,
            debt_service_coverage=1.5,
            risk_score=0.2,
            risk_tier=RiskTier.LOW,
        ),
        routing=compute_program_routing(applicant),
        outcome=DecisionOutcome.APPROVE,
    )
    assert actions == []


def test_low_sbss_suggests_credit_and_cdfi_path() -> None:
    applicant = Applicant(
        applicant_id="A-3",
        business_name="Thin Credit Co",
        industry="retail",
        annual_revenue=120_000,
        requested_loan_amount=40_000,
        years_in_business=2,
        debt_service_coverage_ratio=1.3,
        credit_score_proxy=620,
        sbss_proxy=140,
        requested_program=None,
    )
    actions = compute_improvement_actions(
        applicant,
        metrics=None,
        routing=compute_program_routing(applicant),
        outcome=DecisionOutcome.DENY,
    )
    areas = {a.area.value for a in actions}
    assert "credit" in areas or "program" in areas
    assert any("SBSS" in (a.target or "") or "CDFI" in a.title for a in actions)
