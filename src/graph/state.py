"""LangGraph channel state for the underwriting agent runtime."""

from __future__ import annotations

from operator import add
from typing import Annotated, Any, Optional, TypedDict

from models import (
    Applicant,
    AuditEntry,
    CritiqueReport,
    Decision,
    EscalationPackage,
    HumanReviewRecord,
    SubagentName,
    SubagentOutput,
)
from subagent_state import SubagentState

__all__ = ["GraphState", "SubagentState", "merge_outputs", "latest"]


def merge_outputs(
    existing: Optional[dict[str, SubagentOutput]],
    new: Optional[dict[str, SubagentOutput]],
) -> dict[str, SubagentOutput]:
    """Merge-by-key so a selective Send rerun overwrites only the flagged agent."""
    merged = dict(existing or {})
    if new:
        merged.update(new)
    return merged


def latest(_existing: Any, new: Any) -> Any:
    """Latest-write-wins for scalar channels."""
    return new


class GraphState(TypedDict, total=False):
    """Threaded through the full agent runtime."""

    case_id: str
    thread_id: str
    user_id: str
    applicant: Applicant

    subagent_outputs: Annotated[dict[str, SubagentOutput], merge_outputs]

    critique_history: Annotated[list[CritiqueReport], add]
    retry_count: int
    max_retries: int
    rerun_targets: Annotated[list[SubagentName], latest]

    decision: Annotated[Optional[Decision], latest]
    escalation: Annotated[Optional[EscalationPackage], latest]
    escalation_reason: Annotated[Optional[str], latest]
    human_review: Annotated[Optional[HumanReviewRecord], latest]

    audit_trail: Annotated[list[AuditEntry], add]
