"""Policy Compliance subagent stub — Claude Agent SDK version in Week 2 Day 4."""

from underwriting_agent.models import Applicant, PolicyMatch


def check_policy_compliance(applicant: Applicant) -> list[PolicyMatch]:
    """Placeholder policy match until RAG + Claude Agent SDK subagent are wired."""
    return [
        PolicyMatch(
            clause_id="placeholder-1",
            source="stub",
            excerpt="Policy retrieval not yet implemented.",
            citation="N/A — Week 2 Day 2 stub",
        )
    ]
