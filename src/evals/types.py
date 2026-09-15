"""Shared eval record types (predictions + scored cases)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from models import (
    Citation,
    Decision,
    DecisionOrigin,
    DecisionOutcome,
    LoanProgram,
    ProgramRouting,
    RiskTier,
)

JudgeMode = Literal["heuristic", "llm", "skip"]


class Prediction(BaseModel):
    """System-under-test output for one gold case."""

    case_id: str
    decision: Decision
    # Retrieved policy snippets used for the decision (RAG evals).
    retrieved_contexts: list[str] = Field(default_factory=list)
    # Optional gold-aligned contexts for context recall (when known).
    reference_contexts: list[str] = Field(default_factory=list)
    latency_ms: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CaseScores(BaseModel):
    """Per-case metric scores in [0, 1] (latency excluded)."""

    case_id: str
    decision_match: float | None = None
    false_approve: float | None = None  # 1.0 = false approve occurred
    program_route_match: float | None = None
    escalation_precision_hit: float | None = None  # only when pred=escalate
    citation_accuracy: float | None = None
    context_precision: float | None = None
    context_recall: float | None = None
    faithfulness: float | None = None
    latency_ms: float | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class SuiteReport(BaseModel):
    """Aggregate suite results + gate status."""

    n_cases: int
    scores: dict[str, float]
    thresholds: dict[str, float]
    passed: dict[str, bool]
    hard_gate_passed: bool
    suite_passed: bool
    case_scores: list[CaseScores] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


def decision_from_gold_label(
    *,
    outcome: DecisionOutcome,
    risk_tier: RiskTier,
    rationale: str,
    eligible_programs: list[str],
    recommended_program: str | None,
    compliance_floor_pass: bool = True,
    eligibility_gate_pass: bool = True,
    citations: list[Citation] | None = None,
) -> Decision:
    """Build a Decision shaped like agent output from a gold label (oracle / stubs)."""
    programs = [LoanProgram(p) for p in eligible_programs]
    recommended = LoanProgram(recommended_program) if recommended_program else None
    return Decision(
        outcome=outcome,
        origin=DecisionOrigin.AUTO,
        risk_tier=risk_tier,
        ceiling_triggered=False,
        rationale=rationale,
        program_routing=ProgramRouting(
            compliance_floor_pass=compliance_floor_pass,
            eligibility_gate_pass=eligibility_gate_pass,
            eligible_programs=programs,
            recommended_program=recommended,
        ),
        citations=citations or [],
    )
