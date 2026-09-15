"""Week 4 eval suite unit tests (no API keys required — oracle + heuristic)."""

from __future__ import annotations

from evals.gold_set import load_gold_cases
from evals.harness import predict_oracle
from evals.metrics.decision import is_false_approve
from evals.runner import run_suite, score_case
from evals.types import Prediction, decision_from_gold_label
from models import DecisionOutcome, RiskTier


def test_oracle_suite_passes_hard_gate() -> None:
    report = run_suite(mode="oracle", judge_mode="heuristic", limit=10)
    assert report.n_cases == 10
    assert report.scores["false_approve_rate"] == 0.0
    assert report.hard_gate_passed is True
    assert report.scores["decision_accuracy"] == 1.0
    assert report.scores["program_routing_accuracy"] == 1.0


def test_false_approve_detected() -> None:
    cases = load_gold_cases()
    deny = next(c for c in cases if c.label.outcome == DecisionOutcome.DENY)
    bad_decision = decision_from_gold_label(
        outcome=DecisionOutcome.APPROVE,
        risk_tier=RiskTier.LOW,
        rationale="Incorrectly approving a deny gold case.",
        eligible_programs=list(deny.label.eligible_programs),
        recommended_program=deny.label.recommended_program,
    )
    pred = Prediction(case_id=deny.case_id, decision=bad_decision)
    assert is_false_approve(deny, pred) is True
    scored = score_case(deny, pred, judge_mode="heuristic")
    assert scored.false_approve == 1.0


def test_oracle_prediction_has_retrieval_contexts() -> None:
    case = load_gold_cases()[0]
    pred = predict_oracle(case)
    assert pred.retrieved_contexts
    assert pred.decision.citations
    scored = score_case(case, pred, judge_mode="heuristic")
    assert scored.faithfulness is not None
    assert scored.citation_accuracy is not None
