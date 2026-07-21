"""LangGraph orchestration: intake → retrieval → decision (+ HITL escalation)."""

from typing import Any, TypedDict

from underwriting_agent.models import Applicant, DecisionOutcome, DecisionResult
from underwriting_agent.config import get_settings


class GraphState(TypedDict, total=False):
    applicant: Applicant
    financials: dict[str, Any]
    policy_matches: list[dict[str, Any]]
    decision: DecisionResult


def intake_node(state: GraphState) -> GraphState:
    """Validate / normalize applicant intake. Placeholder for Week 2 Day 1."""
    return state


def retrieval_node(state: GraphState) -> GraphState:
    """Policy retrieval placeholder — replaced by pgvector agentic RAG in Week 3."""
    return {**state, "policy_matches": []}


def apply_risk_ceiling(risk_score: float, proposed: DecisionOutcome) -> tuple[DecisionOutcome, bool]:
    """Hard-coded risk ceiling: never bypassable via prompt. Enforced in code."""
    ceiling = get_settings().risk_ceiling
    if risk_score >= ceiling and proposed == DecisionOutcome.APPROVE:
        return DecisionOutcome.ESCALATE, True
    if risk_score >= ceiling:
        return DecisionOutcome.ESCALATE, True
    return proposed, False


def decision_node(state: GraphState) -> GraphState:
    """Decision placeholder with risk-ceiling gate."""
    risk_score = float((state.get("financials") or {}).get("risk_score", 0.0))
    proposed = DecisionOutcome.ESCALATE
    outcome, ceiling_triggered = apply_risk_ceiling(risk_score, proposed)
    decision = DecisionResult(
        outcome=outcome,
        confidence=0.0,
        risk_score=risk_score,
        reasoning_trace=["Placeholder decision node — Week 2 Day 1 skeleton"],
        citations=[],
        ceiling_triggered=ceiling_triggered,
    )
    return {**state, "decision": decision}


def build_graph():
    """Build the 3-node LangGraph skeleton (Week 2 Day 1).

    Wiring supervisor, subagents, and HITL interrupt_before comes in later Week 2 days.
    """
    from langgraph.graph import END, StateGraph

    graph = StateGraph(GraphState)
    graph.add_node("intake", intake_node)
    graph.add_node("retrieval", retrieval_node)
    graph.add_node("decision", decision_node)
    graph.set_entry_point("intake")
    graph.add_edge("intake", "retrieval")
    graph.add_edge("retrieval", "decision")
    graph.add_edge("decision", END)
    return graph.compile()
