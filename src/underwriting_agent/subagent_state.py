"""Isolated working state for a single subagent invocation."""

from __future__ import annotations

from typing import Optional, TypedDict

from underwriting_agent.models import (
    Applicant,
    CritiqueReport,
    SubagentName,
    SubagentOutput,
)


class SubagentState(TypedDict, total=False):
    """Local state for one subagent run (isolatable for evals / tracing)."""

    agent: SubagentName
    applicant: Applicant
    critique_feedback: Optional[CritiqueReport]
    prior_output: Optional[SubagentOutput]
    retry_index: int
    reuse_evidence: bool
    output: Optional[SubagentOutput]
