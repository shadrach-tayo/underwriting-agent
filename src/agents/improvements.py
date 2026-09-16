"""Deterministic improvement actions to raise auto-approve odds."""

from __future__ import annotations

from agents.program_routing import (
    CDFI_REVENUE_MIN,
    CDFI_YEARS_MIN,
    SBSS_SBA_MIN,
)
from models import (
    Applicant,
    DecisionOutcome,
    FinancialMetrics,
    ImprovementAction,
    ImprovementArea,
    ImprovementPriority,
    ProgramRouting,
    RiskTier,
)

SBA_DSCR_MIN = 1.15
SBA_FICO_MIN = 640
CDFI_FICO_MIN = 580
HEALTHY_DSCR = 1.25
HEALTHY_LOAN_TO_REVENUE = 0.5


def compute_improvement_actions(
    applicant: Applicant,
    *,
    metrics: FinancialMetrics | None,
    routing: ProgramRouting | None,
    outcome: DecisionOutcome,
    ceiling_triggered: bool = False,
) -> list[ImprovementAction]:
    """Suggest concrete steps that would improve approval / reduce escalation."""
    if outcome == DecisionOutcome.APPROVE and not ceiling_triggered:
        return []

    actions: list[ImprovementAction] = []
    seen: set[str] = set()

    def add(action: ImprovementAction) -> None:
        if action.title in seen:
            return
        seen.add(action.title)
        actions.append(action)

    if applicant.has_bankruptcy:
        add(
            ImprovementAction(
                area=ImprovementArea.POLICY,
                priority=ImprovementPriority.HIGH,
                title="Resolve bankruptcy status",
                detail=(
                    "Active bankruptcy is a hard policy reject. Reapply only after "
                    "discharge/dismissal and updated credit reporting."
                ),
            )
        )
    if applicant.has_severe_fraud_alert:
        add(
            ImprovementAction(
                area=ImprovementArea.POLICY,
                priority=ImprovementPriority.HIGH,
                title="Clear severe fraud alert",
                detail=(
                    "A severe fraud alert blocks automated approval. Resolve the alert "
                    "with the credit bureau before resubmitting."
                ),
            )
        )

    if routing is not None:
        mismatch = routing.ineligible_reasons.get("lender_program_mismatch")
        if mismatch:
            offered_hint = ""
            from agents.lenders import format_lender_label, get_lender

            profile = get_lender(applicant.lender_id)
            if profile is not None:
                offered = ", ".join(sorted(p.value for p in profile.offered_programs))
                offered_hint = f" Offered programs: {offered}."
            add(
                ImprovementAction(
                    area=ImprovementArea.PROGRAM,
                    priority=ImprovementPriority.HIGH,
                    title="Align lender and program",
                    detail=mismatch + offered_hint,
                    target=(
                        "Clear lender_id, or switch requested_program to a product "
                        f"this lender originates"
                        + (
                            f" ({format_lender_label(applicant.lender_id)})"
                            if applicant.lender_id
                            else ""
                        )
                    ),
                )
            )
        if not routing.compliance_floor_pass:
            add(
                ImprovementAction(
                    area=ImprovementArea.POLICY,
                    priority=ImprovementPriority.HIGH,
                    title="Address compliance-floor findings",
                    detail=routing.ineligible_reasons.get(
                        "compliance_floor",
                        "Fix fair-lending / process compliance issues before re-underwriting.",
                    ),
                )
            )
        if not routing.eligibility_gate_pass:
            add(
                ImprovementAction(
                    area=ImprovementArea.POLICY,
                    priority=ImprovementPriority.HIGH,
                    title="Confirm eligible business type",
                    detail=routing.ineligible_reasons.get(
                        "eligibility_gate",
                        "Current industry/business type fails the shared eligibility gate.",
                    ),
                )
            )

        sba_eligible = any(p.value == "sba_7a" for p in routing.eligible_programs)
        cdfi_eligible = any(p.value == "cdfi_direct" for p in routing.eligible_programs)

        if not sba_eligible and "sba_7a" in routing.ineligible_reasons:
            sbss = applicant.sbss_proxy
            if sbss is None or sbss < SBSS_SBA_MIN:
                add(
                    ImprovementAction(
                        area=ImprovementArea.CREDIT,
                        priority=ImprovementPriority.HIGH,
                        title="Raise SBSS into the SBA 7(a) band",
                        detail=(
                            "SBA 7(a) routing requires a stronger small-business credit score."
                        ),
                        target=f"SBSS ≥ {SBSS_SBA_MIN}"
                        + (f" (now {sbss})" if sbss is not None else " (missing)"),
                    )
                )
            fico = applicant.credit_score_proxy
            if fico is None or fico < SBA_FICO_MIN:
                add(
                    ImprovementAction(
                        area=ImprovementArea.CREDIT,
                        priority=ImprovementPriority.HIGH,
                        title="Improve personal credit proxy",
                        detail="SBA 7(a) eligibility uses a minimum FICO-style proxy.",
                        target=f"FICO ≥ {SBA_FICO_MIN}"
                        + (f" (now {fico})" if fico is not None else " (missing)"),
                    )
                )
            dscr = applicant.debt_service_coverage_ratio
            if dscr is None or dscr < SBA_DSCR_MIN:
                add(
                    ImprovementAction(
                        area=ImprovementArea.FINANCIAL,
                        priority=ImprovementPriority.HIGH,
                        title="Lift DSCR for SBA eligibility",
                        detail="Increase cash flow or reduce debt service to clear the SBA bar.",
                        target=f"DSCR ≥ {SBA_DSCR_MIN:.2f}x"
                        + (f" (now {dscr:.2f}x)" if dscr is not None else " (missing)"),
                    )
                )

        if not cdfi_eligible and "cdfi_direct" in routing.ineligible_reasons:
            if applicant.annual_revenue < CDFI_REVENUE_MIN:
                add(
                    ImprovementAction(
                        area=ImprovementArea.FINANCIAL,
                        priority=ImprovementPriority.HIGH,
                        title="Grow revenue to the CDFI floor",
                        detail="CDFI Direct requires a minimum trailing annual revenue.",
                        target=(
                            f"Revenue ≥ ${CDFI_REVENUE_MIN:,.0f} "
                            f"(now ${applicant.annual_revenue:,.0f})"
                        ),
                    )
                )
            if applicant.years_in_business < CDFI_YEARS_MIN:
                add(
                    ImprovementAction(
                        area=ImprovementArea.POLICY,
                        priority=ImprovementPriority.MEDIUM,
                        title="Build operating tenure",
                        detail="CDFI Direct expects at least one year in business.",
                        target=(
                            f"Years in business ≥ {CDFI_YEARS_MIN:.0f} "
                            f"(now {applicant.years_in_business:g})"
                        ),
                    )
                )
            fico = applicant.credit_score_proxy
            if fico is not None and fico < CDFI_FICO_MIN:
                add(
                    ImprovementAction(
                        area=ImprovementArea.CREDIT,
                        priority=ImprovementPriority.MEDIUM,
                        title="Improve credit for CDFI Direct",
                        detail="Thin or weak credit can block the CDFI track.",
                        target=f"FICO ≥ {CDFI_FICO_MIN} (now {fico})",
                    )
                )

        if cdfi_eligible and not sba_eligible:
            add(
                ImprovementAction(
                    area=ImprovementArea.PROGRAM,
                    priority=ImprovementPriority.MEDIUM,
                    title="Pursue CDFI Direct instead of SBA 7(a)",
                    detail=(
                        "Applicant clears CDFI Direct but not SBA 7(a). Switching "
                        "requested program can unlock an approvable path."
                    ),
                    target="requested_program = cdfi_direct",
                )
            )

    revenue = max(applicant.annual_revenue, 1.0)
    loan_to_revenue = applicant.requested_loan_amount / revenue
    if loan_to_revenue > HEALTHY_LOAN_TO_REVENUE:
        target_amount = revenue * HEALTHY_LOAN_TO_REVENUE
        add(
            ImprovementAction(
                area=ImprovementArea.STRUCTURE,
                priority=(
                    ImprovementPriority.HIGH
                    if loan_to_revenue > 0.75
                    else ImprovementPriority.MEDIUM
                ),
                title="Reduce requested loan amount",
                detail=(
                    "Loan size is high relative to revenue, which elevates financial "
                    "risk and can push the file out of the auto-approve envelope."
                ),
                target=(
                    f"Loan ≤ ${target_amount:,.0f} "
                    f"(≤ {HEALTHY_LOAN_TO_REVENUE:.0%} of revenue; "
                    f"now ${applicant.requested_loan_amount:,.0f})"
                ),
            )
        )

    dscr = (
        metrics.debt_service_coverage
        if metrics and metrics.debt_service_coverage is not None
        else applicant.debt_service_coverage_ratio
    )
    if dscr is not None and dscr < HEALTHY_DSCR:
        add(
            ImprovementAction(
                area=ImprovementArea.FINANCIAL,
                priority=(
                    ImprovementPriority.HIGH if dscr < SBA_DSCR_MIN else ImprovementPriority.MEDIUM
                ),
                title="Strengthen debt service coverage",
                detail=(
                    "Higher DSCR improves financial tiering and reduces escalation "
                    "pressure inside the decision envelope."
                ),
                target=f"DSCR ≥ {HEALTHY_DSCR:.2f}x (now {dscr:.2f}x)",
            )
        )

    if metrics is not None:
        if metrics.risk_tier in {RiskTier.HIGH, RiskTier.PROHIBITED} or ceiling_triggered:
            add(
                ImprovementAction(
                    area=ImprovementArea.STRUCTURE,
                    priority=ImprovementPriority.HIGH,
                    title="De-risk the ask (amount, tenor, or rate)",
                    detail=(
                        "High risk score / ceiling trigger blocks auto-approve. "
                        "Lower the amount, shorten tenor, or accept a higher rate."
                    ),
                )
            )
        for mod in metrics.recommended_term_mods:
            add(
                ImprovementAction(
                    area=ImprovementArea.STRUCTURE,
                    priority=ImprovementPriority.MEDIUM,
                    title=mod,
                    detail="Suggested by the financial subagent for this risk profile.",
                )
            )

    if outcome == DecisionOutcome.ESCALATE and not actions:
        add(
            ImprovementAction(
                area=ImprovementArea.STRUCTURE,
                priority=ImprovementPriority.MEDIUM,
                title="Provide stronger capacity evidence",
                detail=(
                    "File is near the auto-decision boundary. Updated DSCR, bank "
                    "statements, or a smaller ask can move it into approve territory."
                ),
            )
        )

    priority_rank = {
        ImprovementPriority.HIGH: 0,
        ImprovementPriority.MEDIUM: 1,
        ImprovementPriority.LOW: 2,
    }
    actions.sort(key=lambda a: (priority_rank[a.priority], a.area.value, a.title))
    return actions
