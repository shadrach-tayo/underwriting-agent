"""Deterministic dual-program routing (compliance → eligibility → product).

Shared by the policy subagent and gold-set labeling so evals and runtime
agree on eligible / recommended programs.

Product bars (SBA / CDFI) are generic. Optional ``applicant.lender_id``
restricts eligible tracks via the lender registry and applies ingest-extracted
lender overlays (loan amount band, etc.).
"""

from __future__ import annotations

from agents.lenders import format_lender_label, get_lender, lender_rule_overlay
from models import Applicant, LoanProgram, ProgramRouting

# SBA 7(a) SBSS floor (SOP-style threshold used in gold labels).
SBSS_SBA_MIN = 165
# Generic CDFI Direct floors (shared product bar when no lender overlay).
CDFI_REVENUE_MIN = 50_000.0
CDFI_YEARS_MIN = 1.0

# Illustrative ineligible types under the shared eligibility gate (13 CFR 120.110).
INELIGIBLE_INDUSTRIES = {
    "gambling",
    "speculative real estate",
    "passive investment holding",
}


def compute_program_routing(applicant: Applicant) -> ProgramRouting:
    """Apply layered gates; never flatten into one scored rule set."""
    lender = get_lender(applicant.lender_id)
    requested = applicant.requested_program

    # Lender × program mismatch: do not mix rule sets.
    if lender is not None and requested is not None and requested not in lender.offered_programs:
        offered = ", ".join(sorted(p.value for p in lender.offered_programs)) or "none"
        return ProgramRouting(
            compliance_floor_pass=True,
            eligibility_gate_pass=True,
            eligible_programs=[],
            recommended_program=None,
            ineligible_reasons={
                "lender_program_mismatch": (
                    f"{format_lender_label(lender.id)} does not originate "
                    f"{requested.value} (offers: {offered})"
                ),
            },
        )

    compliance_ok = not bool(applicant.metadata.get("compliance_violation"))
    eligibility_ok = (
        applicant.industry.lower() not in INELIGIBLE_INDUSTRIES
        and not bool(applicant.metadata.get("ineligible_business"))
    )
    hard_reject = applicant.has_bankruptcy or applicant.has_severe_fraud_alert

    ineligible_reasons: dict[str, str] = {}
    if not compliance_ok:
        ineligible_reasons["compliance_floor"] = "Compliance floor violation"
    if not eligibility_ok:
        ineligible_reasons["eligibility_gate"] = (
            f"Industry/business type not eligible: {applicant.industry}"
        )
    if hard_reject:
        reason = "Bankruptcy on file" if applicant.has_bankruptcy else "Severe fraud alert"
        ineligible_reasons["hard_reject"] = reason

    # Lender-specific overlays from ingest-extracted config (e.g. Accion loan band).
    overlay = lender_rule_overlay(applicant.lender_id)
    loan_min = overlay.get("loan_amount_min")
    loan_max = overlay.get("loan_amount_max")
    if isinstance(loan_min, (int, float)) and applicant.requested_loan_amount < float(loan_min):
        ineligible_reasons["lender_loan_amount"] = (
            f"Requested amount below lender minimum "
            f"(${float(loan_min):,.0f})"
        )
    if isinstance(loan_max, (int, float)) and applicant.requested_loan_amount > float(loan_max):
        ineligible_reasons["lender_loan_amount"] = (
            f"Requested amount above lender maximum "
            f"(${float(loan_max):,.0f})"
        )
    excluded_states = overlay.get("excluded_states") or []
    state = str(applicant.metadata.get("state") or applicant.metadata.get("business_state") or "")
    if state and isinstance(excluded_states, list):
        excluded_l = {str(s).strip().lower() for s in excluded_states}
        if state.strip().lower() in excluded_l:
            ineligible_reasons["lender_geography"] = (
                f"Business state {state!r} is excluded by lender policy"
            )

    eligible: list[LoanProgram] = []
    if (
        compliance_ok
        and eligibility_ok
        and not hard_reject
        and "lender_loan_amount" not in ineligible_reasons
        and "lender_geography" not in ineligible_reasons
    ):
        sbss = applicant.sbss_proxy
        sba_ok = (
            sbss is not None
            and sbss >= SBSS_SBA_MIN
            and (applicant.debt_service_coverage_ratio or 0) >= 1.15
            and (applicant.credit_score_proxy or 0) >= 640
        )
        cdfi_ok = (
            applicant.annual_revenue >= CDFI_REVENUE_MIN
            and applicant.years_in_business >= CDFI_YEARS_MIN
            and (
                applicant.credit_score_proxy is None
                or applicant.credit_score_proxy >= 580
            )
        )
        if sba_ok:
            eligible.append(LoanProgram.SBA_7A)
        else:
            ineligible_reasons["sba_7a"] = (
                f"SBSS/DSCR/FICO below SBA 7(a) bar "
                f"(SBSS>={SBSS_SBA_MIN}, DSCR>=1.15, FICO>=640)"
            )
        if cdfi_ok:
            eligible.append(LoanProgram.CDFI_DIRECT)
        else:
            ineligible_reasons["cdfi_direct"] = (
                f"Revenue/years/FICO below CDFI Direct bar "
                f"(revenue>={CDFI_REVENUE_MIN:.0f}, years>={CDFI_YEARS_MIN})"
            )

    # Restrict to what the selected lender originates.
    if lender is not None:
        offered = lender.offered_programs
        dropped = [p for p in eligible if p not in offered]
        eligible = [p for p in eligible if p in offered]
        for program in dropped:
            ineligible_reasons.setdefault(
                program.value,
                f"{format_lender_label(lender.id)} does not originate {program.value}",
            )

    recommended: LoanProgram | None = None
    if LoanProgram.SBA_7A in eligible and LoanProgram.CDFI_DIRECT in eligible:
        recommended = applicant.requested_program or LoanProgram.SBA_7A
    elif LoanProgram.SBA_7A in eligible:
        recommended = LoanProgram.SBA_7A
    elif LoanProgram.CDFI_DIRECT in eligible:
        recommended = LoanProgram.CDFI_DIRECT

    return ProgramRouting(
        compliance_floor_pass=compliance_ok,
        eligibility_gate_pass=eligibility_ok and not hard_reject,
        eligible_programs=eligible,
        recommended_program=recommended,
        ineligible_reasons=ineligible_reasons,
    )
