"""Program routing unit tests (no RAG / graph required)."""

from __future__ import annotations

from agents.lenders import LENDER_ACCION, LENDER_FRONTIER_7A, reload_lenders
from agents.program_routing import compute_program_routing
from models import Applicant, LoanProgram


def _applicant(**kwargs) -> Applicant:
    base = dict(
        applicant_id="A-1",
        business_name="Test Co",
        industry="manufacturing",
        annual_revenue=500_000,
        requested_loan_amount=150_000,
        years_in_business=5,
        debt_service_coverage_ratio=1.4,
        credit_score_proxy=700,
        sbss_proxy=180,
    )
    base.update(kwargs)
    return Applicant(**base)


def test_both_programs_eligible() -> None:
    routing = compute_program_routing(_applicant(requested_program=LoanProgram.SBA_7A))
    assert set(routing.eligible_programs) == {
        LoanProgram.SBA_7A,
        LoanProgram.CDFI_DIRECT,
    }
    assert routing.recommended_program == LoanProgram.SBA_7A


def test_bankruptcy_hard_gate() -> None:
    routing = compute_program_routing(_applicant(has_bankruptcy=True))
    assert routing.eligible_programs == []
    assert routing.eligibility_gate_pass is False


def test_ineligible_industry() -> None:
    routing = compute_program_routing(_applicant(industry="gambling"))
    assert routing.eligible_programs == []
    assert routing.eligibility_gate_pass is False


def test_accion_rejects_cdfi_program_mismatch() -> None:
    reload_lenders()
    routing = compute_program_routing(
        _applicant(
            lender_id=LENDER_ACCION,
            requested_program=LoanProgram.CDFI_DIRECT,
        )
    )
    assert routing.eligible_programs == []
    assert "lender_program_mismatch" in routing.ineligible_reasons


def test_accion_accepts_sba_7a() -> None:
    reload_lenders()
    routing = compute_program_routing(
        _applicant(
            lender_id=LENDER_ACCION,
            requested_program=LoanProgram.SBA_7A,
            requested_loan_amount=150_000,
        )
    )
    assert routing.eligible_programs == [LoanProgram.SBA_7A]
    assert routing.recommended_program == LoanProgram.SBA_7A
    assert "lender_program_mismatch" not in routing.ineligible_reasons


def test_accion_loan_amount_band() -> None:
    reload_lenders()
    too_small = compute_program_routing(
        _applicant(
            lender_id=LENDER_ACCION,
            requested_program=LoanProgram.SBA_7A,
            requested_loan_amount=50_000,
        )
    )
    assert too_small.eligible_programs == []
    assert "lender_loan_amount" in too_small.ineligible_reasons


def test_frontier_rejects_cdfi_mismatch() -> None:
    routing = compute_program_routing(
        _applicant(
            lender_id=LENDER_FRONTIER_7A,
            requested_program=LoanProgram.CDFI_DIRECT,
        )
    )
    assert routing.eligible_programs == []
    assert "lender_program_mismatch" in routing.ineligible_reasons


def test_accion_without_requested_program_restricts_to_sba() -> None:
    reload_lenders()
    routing = compute_program_routing(
        _applicant(lender_id=LENDER_ACCION, requested_loan_amount=150_000)
    )
    assert routing.eligible_programs == [LoanProgram.SBA_7A]
    assert routing.recommended_program == LoanProgram.SBA_7A
