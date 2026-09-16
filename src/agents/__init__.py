"""Supervisor-facing subagents: financial, policy, critic."""

from agents.critic import critique_outputs, critique_reports
from agents.financial import analyze_financials, run_financial_subagent
from agents.improvements import compute_improvement_actions
from agents.lenders import (
    format_lender_label,
    get_lender,
    is_known_lender,
    lender_offers,
    list_lenders,
    reload_lenders,
)
from agents.policy import check_policy_compliance, run_policy_subagent
from agents.program_routing import compute_program_routing
from agents.rationale_facts import financial_facts, format_program_label, policy_facts

__all__ = [
    "analyze_financials",
    "check_policy_compliance",
    "compute_improvement_actions",
    "compute_program_routing",
    "critique_outputs",
    "critique_reports",
    "financial_facts",
    "format_lender_label",
    "format_program_label",
    "get_lender",
    "is_known_lender",
    "lender_offers",
    "list_lenders",
    "policy_facts",
    "reload_lenders",
    "run_financial_subagent",
    "run_policy_subagent",
]
