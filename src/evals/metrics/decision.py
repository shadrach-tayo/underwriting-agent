"""Deterministic decision / risk metrics (no LLM required)."""

from __future__ import annotations

from evals.gold_set import GoldCase
from evals.types import Prediction
from models import DecisionOutcome, LoanProgram


def is_false_approve(gold: GoldCase, pred: Prediction) -> bool:
    """Approve when gold says deny/escalate — the hard-gate failure mode."""
    if pred.decision.outcome != DecisionOutcome.APPROVE:
        return False
    return gold.label.outcome != DecisionOutcome.APPROVE


def decision_match(gold: GoldCase, pred: Prediction) -> bool:
    return pred.decision.outcome == gold.label.outcome


def program_route_match(gold: GoldCase, pred: Prediction) -> bool:
    """Exact match on eligible programs + recommended program (EVALS.md)."""
    routing = pred.decision.program_routing
    if routing is None:
        return False
    gold_eligible = {LoanProgram(p) for p in gold.label.eligible_programs}
    pred_eligible = set(routing.eligible_programs)
    if gold_eligible != pred_eligible:
        return False
    gold_rec = (
        LoanProgram(gold.label.recommended_program)
        if gold.label.recommended_program
        else None
    )
    return routing.recommended_program == gold_rec


def escalation_precision_applicable(pred: Prediction) -> bool:
    return pred.decision.outcome == DecisionOutcome.ESCALATE


def escalation_precision_hit(gold: GoldCase, pred: Prediction) -> bool | None:
    """Among predicted escalations, was gold also escalate?"""
    if not escalation_precision_applicable(pred):
        return None
    return gold.label.outcome == DecisionOutcome.ESCALATE
