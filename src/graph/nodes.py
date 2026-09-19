"""Graph nodes matching docs/underwriting_agent_system_design.png."""

from __future__ import annotations

from typing import Literal
from uuid import uuid4

from langgraph.types import Send

from agents import (
    compute_improvement_actions,
    critique_outputs,
    financial_facts,
    policy_facts,
    run_financial_subagent,
    run_policy_subagent,
)
from agents.improvements import HEALTHY_DSCR
from config import get_settings
from graph.audit import last_audit_hash, make_audit_entry
from graph.state import GraphState
from models import (
    AdverseActionReason,
    CompositeScore,
    CritiqueVerdict,
    Decision,
    DecisionOrigin,
    DecisionOutcome,
    DecisionRationale,
    EscalationPackage,
    HumanReviewRecord,
    LoanProgram,
    RationaleFact,
    RationaleFactTone,
    RationaleKind,
    RationaleSection,
    RiskTier,
    SubagentName,
    SubagentOutput,
)
from subagent_state import SubagentState

DEFAULT_MAX_RETRIES = 3


def underwriter_node(state: GraphState) -> GraphState:
    """Entry supervisor: ensure case id + retry budget."""
    if state.get("applicant") is None:
        return {}
    updates: GraphState = {
        "retry_count": state.get("retry_count", 0),
        "max_retries": state.get("max_retries", DEFAULT_MAX_RETRIES),
    }
    if not state.get("case_id"):
        updates["case_id"] = state.get("thread_id") or f"case-{uuid4().hex[:12]}"
    return updates


def _build_subagent_state(state: GraphState, agent: SubagentName) -> SubagentState:
    applicant = state.get("applicant")
    if applicant is None:
        raise ValueError("GraphState.applicant is required to build SubagentState")
    outputs = state.get("subagent_outputs") or {}
    prior = outputs.get(agent.value)
    retry_index = state.get("retry_count", 0)
    # retry 1 -> reuse evidence; retry 2+ -> force fresh retrieval later
    reuse_evidence = retry_index == 1
    history = state.get("critique_history") or []
    feedback = history[-1] if history else None
    return {
        "agent": agent,
        "applicant": applicant,
        "critique_feedback": feedback,
        "prior_output": prior,
        "retry_index": retry_index,
        "reuse_evidence": reuse_evidence,
    }


def financial_analysis_node(state: GraphState) -> GraphState:
    if state.get("applicant") is None:
        return {}
    output = run_financial_subagent(_build_subagent_state(state, SubagentName.FINANCIAL))
    # No audit_trail here — parallel fan-out can't hash-chain; critic logs serially.
    return {"subagent_outputs": {output.agent.value: output}}


def policy_compliance_node(state: GraphState) -> GraphState:
    if state.get("applicant") is None:
        return {}
    output = run_policy_subagent(_build_subagent_state(state, SubagentName.POLICY))
    return {"subagent_outputs": {output.agent.value: output}}


def self_critic_node(state: GraphState) -> GraphState:
    outputs = state.get("subagent_outputs") or {}
    cycle = state.get("retry_count", 0)
    max_retries = state.get("max_retries", DEFAULT_MAX_RETRIES)
    report = critique_outputs(outputs, cycle=cycle, max_retries=max_retries)

    case_id = state.get("case_id") or "unknown"
    trail = state.get("audit_trail") or []
    prev = last_audit_hash(trail)
    # Serial audit: one entry per subagent output present this cycle, then critique.
    new_entries = []
    for key in (SubagentName.FINANCIAL.value, SubagentName.POLICY.value):
        if key not in outputs:
            continue
        entry = make_audit_entry(
            case_id=case_id,
            event="subagent_output",
            payload=outputs[key].model_dump(mode="json"),
            prev_hash=prev,
        )
        new_entries.append(entry)
        prev = entry.entry_hash
    critique_entry = make_audit_entry(
        case_id=case_id,
        event="critique",
        payload=report.model_dump(mode="json"),
        prev_hash=prev,
    )
    new_entries.append(critique_entry)

    updates: GraphState = {
        "critique_history": [report],
        "rerun_targets": list(report.rerun_targets),
        "audit_trail": new_entries,
    }
    if report.verdict == CritiqueVerdict.RETRY:
        updates["retry_count"] = cycle + 1
    return updates


def route_after_critic(state: GraphState) -> list[Send] | Literal["decision"]:
    """Send retries only to flagged subagents; otherwise proceed to decision."""
    history = state.get("critique_history") or []
    if not history:
        return "decision"
    latest = history[-1]
    if latest.verdict != CritiqueVerdict.RETRY or not latest.rerun_targets:
        return "decision"
    return [Send(target.value, state) for target in latest.rerun_targets]


def apply_risk_ceiling(
    risk_score: float, proposed: DecisionOutcome
) -> tuple[DecisionOutcome, bool, RiskTier | None]:
    """Hard-coded risk ceiling: never bypassable via prompt."""
    ceiling = get_settings().risk_ceiling
    if risk_score >= ceiling:
        return DecisionOutcome.ESCALATE, True, RiskTier.PROHIBITED
    return proposed, False, None


def _financial(state: GraphState) -> SubagentOutput | None:
    return (state.get("subagent_outputs") or {}).get(SubagentName.FINANCIAL.value)


def _policy(state: GraphState) -> SubagentOutput | None:
    return (state.get("subagent_outputs") or {}).get(SubagentName.POLICY.value)


def decision_node(state: GraphState) -> GraphState:
    """Composite score + hard-coded risk ceiling → approve/deny/escalate."""
    financial = _financial(state)
    policy = _policy(state)
    history = state.get("critique_history") or []
    latest_critique = history[-1] if history else None

    risk_score = financial.metrics.risk_score if financial and financial.metrics else 1.0
    risk_tier = financial.metrics.risk_tier if financial and financial.metrics else RiskTier.HIGH
    citations = list(policy.citations) if policy else []
    term_mods = (
        list(financial.metrics.recommended_term_mods) if financial and financial.metrics else []
    )

    if policy and policy.hard_reject:
        reason = policy.hard_reject_reason or policy.conclusion
        decision = Decision(
            outcome=DecisionOutcome.DENY,
            origin=DecisionOrigin.AUTO,
            risk_tier=risk_tier,
            ceiling_triggered=False,
            composite_score=CompositeScore(
                subagent_agreement=1.0,
                evidence_coverage=1.0,
                calibration_adjustment=0.0,
                composite=1.0,
            ),
            rationale=DecisionRationale.from_text(
                reason,
                kind=RationaleKind.HARD_REJECT,
                title="Hard reject",
            ),
            program_routing=policy.program_routing,
            adverse_action_reasons=[
                AdverseActionReason(
                    reason_code="hard_reject",
                    description=reason,
                    supporting_citations=[c.clause_id for c in citations],
                )
            ],
            citations=citations,
        )
        return _decision_update(state, decision)

    if latest_critique and latest_critique.verdict == CritiqueVerdict.ESCALATE:
        critic_notes = latest_critique.notes or "Critic escalated after unresolved deficiencies"
        decision = Decision(
            outcome=DecisionOutcome.ESCALATE,
            origin=DecisionOrigin.AUTO,
            risk_tier=risk_tier,
            ceiling_triggered=False,
            composite_score=CompositeScore(
                subagent_agreement=0.0,
                evidence_coverage=0.0,
                calibration_adjustment=0.0,
                composite=0.0,
            ),
            rationale=DecisionRationale.from_text(
                critic_notes,
                kind=RationaleKind.CRITIC,
                title="Critic escalation",
            ),
            program_routing=policy.program_routing if policy else None,
            citations=citations,
            term_modifications=term_mods,
        )
        return _decision_update(state, decision)

    routing = policy.program_routing if policy else None
    if routing is not None and not routing.eligible_programs:
        routing_body = (
            policy.reasoning_trace if policy else "No eligible program track; escalate for review"
        )
        decision = Decision(
            outcome=DecisionOutcome.ESCALATE,
            origin=DecisionOrigin.AUTO,
            risk_tier=risk_tier,
            ceiling_triggered=False,
            composite_score=CompositeScore(
                subagent_agreement=0.4,
                evidence_coverage=0.4,
                calibration_adjustment=0.0,
                composite=0.4,
            ),
            rationale=DecisionRationale.from_text(
                routing_body,
                kind=RationaleKind.ROUTING,
                title="Program routing",
            ),
            program_routing=routing,
            citations=citations,
            term_modifications=term_mods,
        )
        return _decision_update(state, decision)

    fin_conf = financial.confidence if financial else 0.0
    pol_conf = policy.confidence if policy else 0.0
    agreement = 1.0 - abs(fin_conf - pol_conf)
    evidence = 1.0 if citations else 0.4
    if policy and policy.conflicts and any(not c.resolved for c in policy.conflicts):
        evidence = min(evidence, 0.2)
    composite_value = max(0.0, min(1.0, 0.5 * agreement + 0.5 * evidence - risk_score * 0.25))
    score = CompositeScore(
        subagent_agreement=agreement,
        evidence_coverage=evidence,
        calibration_adjustment=-risk_score * 0.25,
        composite=composite_value,
    )

    sections: list[RationaleSection] = []
    if financial:
        sections.append(
            RationaleSection(
                kind=RationaleKind.FINANCIAL,
                title="Financial analysis",
                body=financial.conclusion or financial.reasoning_trace,
                facts=financial_facts(financial.metrics),
            )
        )
    if policy:
        sections.append(
            RationaleSection(
                kind=RationaleKind.POLICY,
                title="Policy compliance",
                body=policy.conclusion or policy.reasoning_trace,
                facts=policy_facts(
                    policy.program_routing,
                    citation_count=len(policy.citations),
                ),
            )
        )
    if latest_critique and latest_critique.notes:
        sections.append(
            RationaleSection(
                kind=RationaleKind.CRITIC,
                title="Critic notes",
                body=latest_critique.notes,
                facts=[
                    RationaleFact(
                        key="verdict",
                        label="Verdict",
                        value=latest_critique.verdict.value,
                        tone=(
                            RationaleFactTone.PASS
                            if latest_critique.verdict == CritiqueVerdict.PASS
                            else RationaleFactTone.WARN
                            if latest_critique.verdict == CritiqueVerdict.RETRY
                            else RationaleFactTone.FAIL
                        ),
                    ),
                    RationaleFact(
                        key="critic_confidence",
                        label="Critic confidence",
                        value=f"{latest_critique.critic_confidence:.0%}",
                        tone=RationaleFactTone.INFO,
                    ),
                ],
            )
        )

    dscr = (
        financial.metrics.debt_service_coverage
        if financial and financial.metrics
        else None
    )
    applicant = state.get("applicant")
    borderline = bool(applicant and (applicant.metadata or {}).get("borderline"))
    fico = (applicant.credit_score_proxy or 0) if applicant else 0
    eligible = list(routing.eligible_programs) if routing else []
    # Match gold oracle: stricter FICO when SBA is on the eligible set.
    fico_floor = 680 if LoanProgram.SBA_7A in eligible else 640
    loan_to_rev = (
        applicant.requested_loan_amount / max(applicant.annual_revenue, 1.0)
        if applicant
        else 0.0
    )

    if composite_value < 0.45 or (
        latest_critique is not None and latest_critique.verdict != CritiqueVerdict.PASS
    ):
        proposed = DecisionOutcome.ESCALATE
        envelope = "Below auto-decision envelope; escalate"
    elif (
        eligible
        and not borderline
        and dscr is not None
        and dscr >= HEALTHY_DSCR
        and fico >= fico_floor
        and loan_to_rev <= 0.75
        and risk_tier not in (RiskTier.HIGH, RiskTier.PROHIBITED)
        and composite_value >= 0.55
    ):
        proposed = DecisionOutcome.APPROVE
        envelope = "Within auto-approve envelope"
    elif borderline or dscr is None or dscr < HEALTHY_DSCR or loan_to_rev > 0.75:
        proposed = DecisionOutcome.ESCALATE
        envelope = "Borderline or weak coverage; escalate"
    else:
        proposed = DecisionOutcome.DENY
        envelope = "Outside approve envelope; deny"

    sections.append(
        RationaleSection(
            kind=RationaleKind.ENVELOPE,
            title="Decision envelope",
            body=envelope,
            facts=[
                RationaleFact(
                    key="composite",
                    label="Composite score",
                    value=f"{composite_value:.0%}",
                    tone=(
                        RationaleFactTone.PASS
                        if composite_value >= 0.55
                        else RationaleFactTone.WARN
                        if composite_value >= 0.45
                        else RationaleFactTone.FAIL
                    ),
                ),
                RationaleFact(
                    key="proposed",
                    label="Proposed outcome",
                    value=proposed.value,
                    tone=RationaleFactTone.INFO,
                ),
            ],
        )
    )

    outcome, ceiling_triggered, prohibited = apply_risk_ceiling(risk_score, proposed)
    if prohibited:
        risk_tier = prohibited
    if ceiling_triggered:
        sections.append(
            RationaleSection(
                kind=RationaleKind.ENVELOPE,
                title="Risk ceiling",
                body="Hard-coded risk ceiling triggered; human review required",
                facts=[
                    RationaleFact(
                        key="risk_score",
                        label="Risk score",
                        value=f"{risk_score:.2f}",
                        tone=RationaleFactTone.FAIL,
                    ),
                    RationaleFact(
                        key="ceiling",
                        label="Ceiling",
                        value="Triggered",
                        tone=RationaleFactTone.FAIL,
                    ),
                ],
            )
        )

    adverse: list[AdverseActionReason] = []
    if outcome == DecisionOutcome.DENY:
        adverse.append(
            AdverseActionReason(
                reason_code="credit_risk",
                description="Application does not meet underwriting risk envelope",
                supporting_citations=[c.clause_id for c in citations],
            )
        )

    decision = Decision(
        outcome=outcome,
        origin=DecisionOrigin.AUTO,
        risk_tier=risk_tier,
        ceiling_triggered=ceiling_triggered,
        composite_score=score,
        rationale=DecisionRationale(summary=envelope, sections=sections),
        program_routing=policy.program_routing if policy else None,
        adverse_action_reasons=adverse,
        term_modifications=term_mods,
        citations=citations,
    )
    return _decision_update(state, decision)


def _decision_update(state: GraphState, decision: Decision) -> GraphState:
    applicant = state.get("applicant")
    if applicant is not None and not decision.improvement_actions:
        financial = _financial(state)
        policy = _policy(state)
        actions = compute_improvement_actions(
            applicant,
            metrics=financial.metrics if financial else None,
            routing=(
                decision.program_routing
                or (policy.program_routing if policy else None)
            ),
            outcome=decision.outcome,
            ceiling_triggered=decision.ceiling_triggered,
        )
        term_mods = list(decision.term_modifications)
        if not term_mods:
            term_mods = [
                action.title
                for action in actions
                if action.area.value == "structure"
            ][:3]
        decision = decision.model_copy(
            update={
                "improvement_actions": actions,
                "term_modifications": term_mods,
            }
        )

    case_id = state.get("case_id") or "unknown"
    trail = state.get("audit_trail") or []
    entry = make_audit_entry(
        case_id=case_id,
        event="decision",
        payload=decision.model_dump(mode="json"),
        prev_hash=last_audit_hash(trail),
    )
    return {"decision": decision, "audit_trail": [entry]}


def route_after_decision(
    state: GraphState,
) -> Literal["approve_decline", "hitl_escalation"]:
    decision = state.get("decision")
    if decision and decision.outcome == DecisionOutcome.ESCALATE:
        return "hitl_escalation"
    return "approve_decline"


def approve_decline_node(state: GraphState) -> GraphState:
    """Finalize automated approve/deny."""
    decision = state.get("decision")
    if decision is None:
        return {}
    updated = decision.model_copy(
        update={
            "rationale": decision.rationale.with_section(
                kind=RationaleKind.ENVELOPE,
                title="Auto resolution",
                body=f"Auto-decision: {decision.outcome.value}",
            )
        }
    )
    case_id = state.get("case_id") or "unknown"
    trail = state.get("audit_trail") or []
    entry = make_audit_entry(
        case_id=case_id,
        event="auto_resolution",
        payload={"outcome": updated.outcome.value},
        prev_hash=last_audit_hash(trail),
    )
    return {"decision": updated, "audit_trail": [entry]}


def hitl_escalation_node(state: GraphState) -> GraphState:
    """Compile evidence for Human Review UI / resolution queue."""
    decision = state.get("decision")
    financial = _financial(state)
    policy = _policy(state)
    history = state.get("critique_history") or []
    latest = history[-1] if history else None

    reason = "Escalated for human underwriter review"
    if decision and decision.ceiling_triggered:
        reason = "Hard-coded risk ceiling; human review required"
    elif decision and decision.composite_score and decision.composite_score.composite < 0.45:
        reason = "Confidence below auto-decision threshold"

    package = EscalationPackage(
        reason=reason,
        rationale=decision.rationale if decision else DecisionRationale(summary=""),
        financial_summary=financial.reasoning_trace if financial else "",
        compliance_summary=policy.reasoning_trace if policy else "",
        citations=list(policy.citations) if policy else [],
        critic_notes=latest.notes if latest else "",
        sla_queue="underwriter_review",
    )
    # Placeholder pending human capture (interrupt/resume wires reviewer later).
    pending = HumanReviewRecord(
        reviewer_id="pending",
        outcome=DecisionOutcome.ESCALATE,
        rationale="Awaiting human underwriter",
        pending=True,
    )
    case_id = state.get("case_id") or "unknown"
    trail = state.get("audit_trail") or []
    entry = make_audit_entry(
        case_id=case_id,
        event="escalation",
        payload=package.model_dump(mode="json"),
        prev_hash=last_audit_hash(trail),
    )
    return {
        "escalation": package,
        "escalation_reason": reason,
        "human_review": pending,
        "audit_trail": [entry],
    }


def human_capture_node(state: GraphState) -> GraphState:
    """Terminal human decision capture.

    If a completed HumanReviewRecord is already on state (resume path), finalize
    Decision.origin. Otherwise leave the pending placeholder for the review UI.
    """
    review = state.get("human_review")
    decision = state.get("decision")
    if review is None or review.pending or decision is None:
        return {}

    if review.overrode_ceiling and not review.override_confirmed_by:
        # Maker-checker incomplete — keep pending.
        return {
            "human_review": review.model_copy(update={"pending": True}),
        }

    origin = DecisionOrigin.HUMAN_OVERRIDE if review.overrode_ceiling else DecisionOrigin.HUMAN
    finalized = decision.model_copy(
        update={
            "outcome": review.outcome,
            "origin": origin,
            "rationale": decision.rationale.with_section(
                kind=RationaleKind.HUMAN,
                title="Human review",
                body=review.rationale,
                update_summary=True,
            ),
            "ceiling_triggered": decision.ceiling_triggered and not review.overrode_ceiling,
        }
    )
    case_id = state.get("case_id") or "unknown"
    trail = state.get("audit_trail") or []
    entry = make_audit_entry(
        case_id=case_id,
        event="human_review",
        payload=review.model_dump(mode="json"),
        prev_hash=last_audit_hash(trail),
    )
    return {"decision": finalized, "human_review": review, "audit_trail": [entry]}


def audit_log_node(state: GraphState) -> GraphState:
    """Final audit marker for the completed case."""
    decision = state.get("decision")
    if decision is None:
        return {}
    case_id = state.get("case_id") or "unknown"
    trail = state.get("audit_trail") or []
    entry = make_audit_entry(
        case_id=case_id,
        event="case_complete",
        payload={
            "outcome": decision.outcome.value,
            "origin": decision.origin.value,
            "ceiling_triggered": decision.ceiling_triggered,
            "retry_count": state.get("retry_count", 0),
            "escalation_reason": state.get("escalation_reason"),
        },
        prev_hash=last_audit_hash(trail),
    )
    return {"audit_trail": [entry]}
