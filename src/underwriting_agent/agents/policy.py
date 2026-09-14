"""Policy Compliance subagent — citations + hard-reject rules (RAG/SDK later)."""

from __future__ import annotations

from datetime import datetime, timezone

from underwriting_agent.models import (
    Applicant,
    Citation,
    PolicyLayer,
    PolicySource,
    SubagentName,
    SubagentOutput,
)
from underwriting_agent.subagent_state import SubagentState

_STUB_SOURCE = PolicySource(
    source_id="stub-policy",
    name="Stub underwriting policy",
    authority="lender",
    version="0.1.0",
    effective_date=datetime(2024, 1, 1, tzinfo=timezone.utc),
    program=PolicyLayer.CDFI_DIRECT,
)


def run_policy_subagent(state: SubagentState) -> SubagentOutput:
    """Run one policy compliance cycle from isolated SubagentState."""
    applicant = state["applicant"]
    retry_index = state.get("retry_index", 0)
    feedback = state.get("critique_feedback")

    citations = [
        Citation(
            clause_id="placeholder-1",
            source=_STUB_SOURCE,
            retrieved_text="Policy retrieval not yet implemented.",
            similarity_score=0.5,
            program=PolicyLayer.CDFI_DIRECT,
            grounding_score=None,
            grounded=None,
        )
    ]
    notes = ["stub_policy_pass"]
    if feedback and feedback.notes:
        notes.append(f"critic_feedback: {feedback.notes}")
    if state.get("reuse_evidence") and state.get("prior_output"):
        notes.append("reuse_evidence=true (re-reason pass)")

    if applicant.has_bankruptcy:
        return SubagentOutput(
            agent=SubagentName.POLICY,
            conclusion="HARD_REJECT: bankruptcy",
            confidence=1.0,
            reasoning_trace="; ".join(notes + ["hard_reject:bankruptcy"]),
            citations=citations,
            hard_reject=True,
            hard_reject_reason="Bankruptcy on file — auto-deny per policy",
            retry_index=retry_index,
        )

    if applicant.has_severe_fraud_alert:
        return SubagentOutput(
            agent=SubagentName.POLICY,
            conclusion="HARD_REJECT: fraud_alert",
            confidence=1.0,
            reasoning_trace="; ".join(notes + ["hard_reject:fraud_alert"]),
            citations=citations,
            hard_reject=True,
            hard_reject_reason="Severe fraud alert — auto-deny per policy",
            retry_index=retry_index,
        )

    return SubagentOutput(
        agent=SubagentName.POLICY,
        conclusion="No hard policy disqualifiers detected (stub)",
        confidence=0.8,
        reasoning_trace="; ".join(notes + ["No hard policy disqualifiers detected (stub)"]),
        citations=citations,
        hard_reject=False,
        retry_index=retry_index,
    )


def check_policy_compliance(applicant: Applicant, *, attempt: int = 1) -> SubagentOutput:
    """Convenience wrapper for unit tests / direct calls."""
    return run_policy_subagent(
        {
            "agent": SubagentName.POLICY,
            "applicant": applicant,
            "retry_index": max(0, attempt - 1),
            "reuse_evidence": attempt > 1,
        }
    )
