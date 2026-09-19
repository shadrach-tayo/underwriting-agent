"""LangGraph agent runtime — see docs/underwriting_agent_system_design.png."""

from graph.nodes import (
    apply_risk_ceiling,
    approve_decline_node,
    audit_log_node,
    decision_node,
    financial_analysis_node,
    hitl_escalation_node,
    human_capture_node,
    policy_compliance_node,
    provider_error_handler,
    route_after_critic,
    route_after_decision,
    self_critic_node,
    underwriter_node,
)
from graph.state import GraphState, SubagentState

__all__ = [
    "GraphState",
    "SubagentState",
    "apply_risk_ceiling",
    "build_graph",
    "configure_langsmith",
    "decision_from_state",
    "get_compiled_graph",
    "graph",
    "provider_error_handler",
    "run_underwrite",
]


def build_graph():
    """Underwriter → parallel subagents → critic (Send) → decision → audit → END."""
    from langgraph.graph import END, START, StateGraph

    builder = StateGraph(GraphState)

    builder.add_node("underwriter", underwriter_node)
    # No node RetryPolicy: Voyage/ChatOpenAI already retry. Stacking blows latency.
    builder.add_node(
        "financial_analysis",
        financial_analysis_node,
        error_handler=provider_error_handler,
    )
    builder.add_node(
        "policy_compliance",
        policy_compliance_node,
        error_handler=provider_error_handler,
    )
    builder.add_node("self_critic", self_critic_node, defer=True)
    builder.add_node("decision", decision_node)
    builder.add_node("approve_decline", approve_decline_node)
    builder.add_node("hitl_escalation", hitl_escalation_node)
    builder.add_node("human_capture", human_capture_node)
    builder.add_node("audit_log", audit_log_node)

    builder.add_edge(START, "underwriter")
    builder.add_edge("underwriter", "financial_analysis")
    builder.add_edge("underwriter", "policy_compliance")
    builder.add_edge("financial_analysis", "self_critic")
    builder.add_edge("policy_compliance", "self_critic")
    builder.add_conditional_edges(
        "self_critic",
        route_after_critic,
        ["financial_analysis", "policy_compliance", "decision"],
    )
    builder.add_conditional_edges(
        "decision",
        route_after_decision,
        {"approve_decline": "approve_decline", "hitl_escalation": "hitl_escalation"},
    )
    builder.add_edge("approve_decline", "audit_log")
    builder.add_edge("hitl_escalation", "human_capture")
    builder.add_edge("human_capture", "audit_log")
    builder.add_edge("audit_log", END)

    return builder.compile()


from graph.runtime import (  # noqa: E402
    configure_langsmith,
    decision_from_state,
    get_compiled_graph,
    run_underwrite,
)

configure_langsmith()
graph = build_graph()
