"""Deterministic dual-program routing (compliance → eligibility → product).

Shared by the policy subagent and gold-set labeling so evals and runtime
agree on eligible / recommended programs.
"""

from __future__ import annotations

from models import Applicant, LoanProgram, ProgramRouting

# SBA 7(a) SBSS floor (SOP-style threshold used in gold labels).
SBSS_SBA_MIN = 165
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

    eligible: list[LoanProgram] = []
    if compliance_ok and eligibility_ok and not hard_reject:
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
