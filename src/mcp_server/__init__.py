"""FastMCP server: get_applicant_financials, fetch_policy_clause, escalate_case."""

from typing import Any


def get_applicant_financials(applicant_id: str) -> dict[str, Any]:
    """Return structured financials for an applicant. Stub until gold set / DB exist."""
    return {"applicant_id": applicant_id, "status": "stub", "financials": {}}


def fetch_policy_clause(query: str) -> dict[str, Any]:
    """Fetch a policy clause by query. Stub; live retrieval is the policy RAG path."""
    return {"query": query, "clause": None, "status": "stub"}


def escalate_case(applicant_id: str, reason: str) -> dict[str, Any]:
    """Record an escalation for human review (HITL)."""
    return {
        "applicant_id": applicant_id,
        "reason": reason,
        "status": "escalated",
        "queue": "human_review",
    }


def create_mcp_server():
    """Build the FastMCP server."""
    from fastmcp import FastMCP

    mcp = FastMCP("underwriting-agent")
    mcp.tool(get_applicant_financials)
    mcp.tool(fetch_policy_clause)
    mcp.tool(escalate_case)
    return mcp


def main() -> None:
    create_mcp_server().run()


if __name__ == "__main__":
    main()
