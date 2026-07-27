"""Graph nodes matching docs/underwriting_agent_system_design.png."""

from __future__ import annotations

from typing import Literal
from uuid import uuid4

from langgraph.types import Send

from underwriting_agent.agents import (
    critique_outputs,
    run_financial_subagent,
    run_policy_subagent,
)
from underwriting_agent.config import get_settings
from underwriting_agent.graph.audit import last_audit_hash, make_audit_entry
from underwriting_agent.graph.state import GraphState
from underwriting_agent.subagent_state import SubagentState
from underwriting_agent.models import (
    AdverseActionReason,
    CompositeScore,
    CritiqueVerdict,
    Decision,
    DecisionOrigin,
    DecisionOutcome,
    EscalationPackage,
    HumanReviewRecord,
    RiskTier,
    SubagentName,
    SubagentOutput,
)

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
    risk_tier = (
        financial.metrics.risk_tier if financial and financial.metrics else RiskTier.HIGH
    )
    citations = list(policy.citations) if policy else []
    term_mods = (
        list(financial.metrics.recommended_term_mods)
        if financial and financial.metrics
        else []
    )

    if policy and policy.hard_reject:
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
            rationale=policy.hard_reject_reason or policy.conclusion,
            adverse_action_reasons=[
                AdverseActionReason(
                    reason_code="hard_reject",
                    description=policy.hard_reject_reason or policy.conclusion,
                    supporting_citations=[c.clause_id for c in citations],
                )
            ],
            citations=citations,
        )
        return _decision_update(state, decision)

    if latest_critique and latest_critique.verdict == CritiqueVerdict.ESCALATE:
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
            rationale=latest_critique.notes or "Critic escalated after unresolved deficiencies",
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

    rationale_parts = []
    if financial:
        rationale_parts.append(financial.reasoning_trace)
    if policy:
        rationale_parts.append(policy.reasoning_trace)
    if latest_critique:
        rationale_parts.append(latest_critique.notes)

    if composite_value < 0.45 or (
        latest_critique is not None and latest_critique.verdict != CritiqueVerdict.PASS
    ):
        proposed = DecisionOutcome.ESCALATE
        rationale_parts.append("Below auto-decision envelope → escalate")
    elif risk_tier == RiskTier.LOW and composite_value >= 0.55:
        proposed = DecisionOutcome.APPROVE
        rationale_parts.append("Within auto-approve envelope")
    else:
        proposed = DecisionOutcome.DENY
        rationale_parts.append("Outside approve envelope → deny")

    outcome, ceiling_triggered, prohibited = apply_risk_ceiling(risk_score, proposed)
    if prohibited:
        risk_tier = prohibited
    if ceiling_triggered:
        rationale_parts.append(f"Hard-coded risk ceiling triggered (risk_score={risk_score:.2f})")

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
        rationale="; ".join(rationale_parts),
        adverse_action_reasons=adverse,
        term_modifications=term_mods,
        citations=citations,
    )
    return _decision_update(state, decision)


def _decision_update(state: GraphState, decision: Decision) -> GraphState:
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
        update={"rationale": f"{decision.rationale}; Auto-decision: {decision.outcome.value}"}
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
        reason = "Hard-coded risk ceiling — human review required"
    elif decision and decision.composite_score and decision.composite_score.composite < 0.45:
        reason = "Confidence below auto-decision threshold"

    package = EscalationPackage(
        reason=reason,
        rationale=decision.rationale if decision else "",
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

    origin = (
        DecisionOrigin.HUMAN_OVERRIDE if review.overrode_ceiling else DecisionOrigin.HUMAN
    )
    finalized = decision.model_copy(
        update={
            "outcome": review.outcome,
            "origin": origin,
            "rationale": f"{decision.rationale}; Human: {review.rationale}",
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
