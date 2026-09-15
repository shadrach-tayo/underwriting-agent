"""Build UI-friendly rationale facts from financial / policy outputs."""

from __future__ import annotations

from models import (
    FinancialMetrics,
    LoanProgram,
    ProgramRouting,
    RationaleFact,
    RationaleFactTone,
    RiskTier,
)

_PROGRAM_LABELS = {
    LoanProgram.SBA_7A: "SBA 7(a)",
    LoanProgram.CDFI_DIRECT: "CDFI Direct",
}


def format_program_label(program: LoanProgram | str | None) -> str:
    if program is None:
        return "—"
    if isinstance(program, LoanProgram):
        return _PROGRAM_LABELS.get(program, program.value.replace("_", " "))
    if program == "sba_7a":
        return "SBA 7(a)"
    if program == "cdfi_direct":
        return "CDFI Direct"
    return str(program).replace("_", " ")


def financial_facts(metrics: FinancialMetrics | None) -> list[RationaleFact]:
    if metrics is None:
        return []
    facts: list[RationaleFact] = []
    if metrics.debt_to_income is not None:
        dti = metrics.debt_to_income
        tone = (
            RationaleFactTone.PASS
            if dti <= 0.5
            else RationaleFactTone.WARN
            if dti <= 0.75
            else RationaleFactTone.FAIL
        )
        facts.append(
            RationaleFact(
                key="loan_to_revenue",
                label="Loan / revenue",
                value=f"{dti * 100:.1f}%",
                tone=tone,
                detail=f"{dti:.3f}x requested loan vs annual revenue",
            )
        )
    facts.append(
        RationaleFact(
            key="risk_tier",
            label="Risk tier",
            value=metrics.risk_tier.value,
            tone=(
                RationaleFactTone.PASS
                if metrics.risk_tier == RiskTier.LOW
                else RationaleFactTone.WARN
                if metrics.risk_tier == RiskTier.MEDIUM
                else RationaleFactTone.FAIL
            ),
        )
    )
    if metrics.debt_service_coverage is not None:
        dscr = metrics.debt_service_coverage
        facts.append(
            RationaleFact(
                key="dscr",
                label="DSCR",
                value=f"{dscr:.2f}x",
                tone=(
                    RationaleFactTone.PASS
                    if dscr >= 1.25
                    else RationaleFactTone.WARN
                    if dscr >= 1.2
                    else RationaleFactTone.FAIL
                ),
                detail="Debt service coverage ratio",
            )
        )
    facts.append(
        RationaleFact(
            key="risk_score",
            label="Risk score",
            value=f"{metrics.risk_score:.2f}",
            tone=(
                RationaleFactTone.PASS
                if metrics.risk_score <= 0.35
                else RationaleFactTone.WARN
                if metrics.risk_score <= 0.65
                else RationaleFactTone.FAIL
            ),
        )
    )
    return facts


def policy_facts(
    routing: ProgramRouting | None,
    *,
    citation_count: int | None = None,
) -> list[RationaleFact]:
    if routing is None:
        return []
    facts = [
        RationaleFact(
            key="compliance_floor",
            label="Compliance floor",
            value="Pass" if routing.compliance_floor_pass else "Fail",
            tone=(
                RationaleFactTone.PASS
                if routing.compliance_floor_pass
                else RationaleFactTone.FAIL
            ),
        ),
        RationaleFact(
            key="eligibility_gate",
            label="Eligibility gate",
            value="Pass" if routing.eligibility_gate_pass else "Fail",
            tone=(
                RationaleFactTone.PASS
                if routing.eligibility_gate_pass
                else RationaleFactTone.FAIL
            ),
        ),
        RationaleFact(
            key="eligible_programs",
            label="Eligible programs",
            value=(
                ", ".join(format_program_label(p) for p in routing.eligible_programs)
                or "None"
            ),
            tone=(
                RationaleFactTone.PASS
                if routing.eligible_programs
                else RationaleFactTone.FAIL
            ),
        ),
    ]
    if routing.recommended_program:
        facts.append(
            RationaleFact(
                key="recommended_program",
                label="Recommended",
                value=format_program_label(routing.recommended_program),
                tone=RationaleFactTone.INFO,
            )
        )
    if citation_count is not None:
        facts.append(
            RationaleFact(
                key="citations",
                label="Citations",
                value=str(citation_count),
                tone=(
                    RationaleFactTone.PASS
                    if citation_count > 0
                    else RationaleFactTone.WARN
                ),
            )
        )
    for layer, reason in routing.ineligible_reasons.items():
        facts.append(
            RationaleFact(
                key=f"ineligible_{layer}",
                label=layer.replace("_", " ").title(),
                value=reason,
                tone=RationaleFactTone.FAIL,
            )
        )
    return facts
