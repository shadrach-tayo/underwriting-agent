"""Gold-set eval runner — DeepEval metrics + Braintrust spans."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from deepeval.test_case import LLMTestCase

from evals.gold_set import GOLD_SET_PATH, GoldCase, load_gold_cases
from evals.harness import HarnessMode, PredictFn, resolve_predict_fn
from evals.metrics.citation import score_citation_accuracy
from evals.metrics.decision import (
    decision_match,
    escalation_precision_hit,
    is_false_approve,
    program_route_match,
)
from evals.metrics.deepeval_metrics import (
    DecisionAccuracyMetric,
    FalseApproveMetric,
    ProgramRoutingMetric,
)
from evals.metrics.retrieval import score_retrieval
from evals.report import aggregate
from evals.thresholds import (
    LATENCY_P95_MS,
    THRESHOLDS,
    EvalThresholds,
)
from evals.tracing import init_tracing, span
from evals.types import CaseScores, JudgeMode, Prediction, SuiteReport

logger = logging.getLogger(__name__)


def _braintrust_scores(scores: dict[str, float]) -> dict[str, float]:
    """Braintrust requires score values in [0, 1]; keep latency in metrics instead."""
    return {
        k: v
        for k, v in scores.items()
        if k != LATENCY_P95_MS and 0.0 <= v <= 1.0
    }


def score_case(
    gold: GoldCase,
    pred: Prediction,
    *,
    judge_mode: JudgeMode = "heuristic",
    thresholds: EvalThresholds = THRESHOLDS,
) -> CaseScores:
    """Score one (gold, prediction) pair with DeepEval custom + retrieval metrics."""
    test_case = LLMTestCase(
        input=gold.applicant.model_dump_json(),
        actual_output=pred.decision.rationale,
        expected_output=gold.label.rationale,
    )

    da = DecisionAccuracyMetric(gold, pred, threshold=thresholds.decision_accuracy_min)
    da.measure(test_case)
    fa = FalseApproveMetric(gold, pred)
    fa.measure(test_case)
    pr = ProgramRoutingMetric(
        gold, pred, threshold=thresholds.program_routing_accuracy_min
    )
    pr.measure(test_case)

    esc = escalation_precision_hit(gold, pred)
    cite_score, cite_details = score_citation_accuracy(pred, mode=judge_mode)
    retrieval_scores, retrieval_details = score_retrieval(pred, mode=judge_mode)

    return CaseScores(
        case_id=gold.case_id,
        decision_match=da.score,
        false_approve=fa.score,
        program_route_match=pr.score,
        escalation_precision_hit=(
            1.0 if esc is True else (0.0 if esc is False else None)
        ),
        citation_accuracy=cite_score,
        context_precision=retrieval_scores.get("context_precision"),
        context_recall=retrieval_scores.get("context_recall"),
        faithfulness=retrieval_scores.get("faithfulness"),
        latency_ms=pred.latency_ms,
        details={
            "decision_reason": da.reason,
            "false_approve_reason": fa.reason,
            "route_reason": pr.reason,
            "citation": cite_details,
            "retrieval": retrieval_details,
            "decision_match_bool": decision_match(gold, pred),
            "is_false_approve": is_false_approve(gold, pred),
            "program_route_match_bool": program_route_match(gold, pred),
        },
    )


def run_suite(
    *,
    gold_path: Path | None = None,
    mode: HarnessMode = "oracle",
    predictions_path: Path | None = None,
    predict_fn: PredictFn | None = None,
    judge_mode: JudgeMode = "heuristic",
    thresholds: EvalThresholds = THRESHOLDS,
    limit: int | None = None,
    case_ids: Sequence[str] | None = None,
) -> SuiteReport:
    """Run the full Week 4 metric suite over the gold set."""
    init_tracing()
    cases = load_gold_cases(gold_path or GOLD_SET_PATH)
    if case_ids:
        wanted = set(case_ids)
        cases = [c for c in cases if c.case_id in wanted]
    if limit is not None:
        cases = cases[:limit]

    predict = predict_fn or resolve_predict_fn(mode, predictions_path=predictions_path)
    notes: list[str] = [f"harness={mode}", f"judge_mode={judge_mode}"]

    case_scores: list[CaseScores] = []
    with span("eval.suite") as suite_span:
        for case in cases:
            with span("eval.case", span_attributes={"type": "eval"}) as case_span:
                if case_span is not None:
                    case_span.log(input={"case_id": case.case_id})
                pred = predict(case)
                scored = score_case(
                    case, pred, judge_mode=judge_mode, thresholds=thresholds
                )
                case_scores.append(scored)
                if case_span is not None:
                    case_span.log(
                        output=scored.model_dump(mode="json"),
                        scores={
                            k: v
                            for k, v in {
                                "decision_match": scored.decision_match,
                                "false_approve": scored.false_approve,
                                "program_route_match": scored.program_route_match,
                                "citation_accuracy": scored.citation_accuracy,
                                "context_precision": scored.context_precision,
                                "context_recall": scored.context_recall,
                                "faithfulness": scored.faithfulness,
                            }.items()
                            if v is not None
                        },
                    )

        report = aggregate(case_scores, thresholds=thresholds, notes=notes)
        if suite_span is not None:
            suite_span.log(
                output={
                    "n_cases": report.n_cases,
                    "scores": report.scores,
                    "hard_gate_passed": report.hard_gate_passed,
                    "suite_passed": report.suite_passed,
                },
                scores=_braintrust_scores(report.scores),
                metrics={
                    k: v
                    for k, v in report.scores.items()
                    if k == LATENCY_P95_MS
                },
            )
    return report


def braintrust_eval(
    *,
    mode: HarnessMode = "oracle",
    judge_mode: JudgeMode = "heuristic",
    limit: int | None = None,
    use_remote_dataset: bool = True,
) -> Any:
    """Run via Braintrust ``Eval()`` against the versioned gold dataset when possible."""
    from evals.braintrust_dataset import (
        braintrust_api_configured,
        gold_case_to_record,
        load_braintrust_dataset,
    )
    from evals.gold_set import GoldLabel
    from evals.tracing import project_name
    from models import Applicant, DecisionOutcome, RiskTier

    local_cases = load_gold_cases()
    if limit is not None:
        local_cases = local_cases[:limit]
    by_id = {c.case_id: c for c in local_cases}
    predict = resolve_predict_fn(mode)

    def _case_for_task(input_row: dict[str, Any]) -> GoldCase:
        case_id = str(input_row.get("case_id") or "")
        if case_id in by_id:
            return by_id[case_id]
        return GoldCase(
            case_id=case_id,
            applicant=Applicant.model_validate(input_row["applicant"]),
            label=GoldLabel(
                outcome=DecisionOutcome.ESCALATE,
                risk_tier=RiskTier.MEDIUM,
                rationale="",
            ),
        )

    def _gold_for_score(input_row: dict[str, Any], expected: Any) -> GoldCase:
        if isinstance(expected, dict):
            return GoldCase.model_validate(
                {
                    "case_id": input_row.get("case_id"),
                    "applicant": input_row["applicant"],
                    "label": expected,
                }
            )
        case_id = str(input_row.get("case_id") or "")
        if case_id in by_id:
            return by_id[case_id]
        raise ValueError(f"Missing expected label for case_id={case_id}")

    def task(input_row: dict[str, Any]) -> dict[str, Any]:
        pred = predict(_case_for_task(input_row))
        return pred.model_dump(mode="json")

    def score_false_approve(input_row, output, expected=None) -> float:
        gold = _gold_for_score(input_row, expected)
        pred = Prediction.model_validate(output)
        return 0.0 if is_false_approve(gold, pred) else 1.0

    def score_decision(input_row, output, expected=None) -> float:
        gold = _gold_for_score(input_row, expected)
        pred = Prediction.model_validate(output)
        return 1.0 if decision_match(gold, pred) else 0.0

    def score_routing(input_row, output, expected=None) -> float:
        gold = _gold_for_score(input_row, expected)
        pred = Prediction.model_validate(output)
        return 1.0 if program_route_match(gold, pred) else 0.0

    if not braintrust_api_configured():
        logger.info("BRAINTRUST_API_KEY unset — running local suite only")
        return run_suite(mode=mode, judge_mode=judge_mode, limit=limit)

    from braintrust import Eval

    if use_remote_dataset:
        data: Any = load_braintrust_dataset()
        dataset_meta = "braintrust"
    else:

        def iter_local_data() -> Any:
            for case in local_cases:
                rec = gold_case_to_record(case)
                yield {
                    "input": rec["input"],
                    "expected": rec["expected"],
                    "metadata": rec["metadata"],
                    "tags": rec["tags"],
                }

        data = iter_local_data
        dataset_meta = "local_gold"

    return Eval(
        project_name(),
        data=data,
        task=task,
        scores=[score_false_approve, score_decision, score_routing],
        metadata={
            "harness": mode,
            "judge_mode": judge_mode,
            "dataset": dataset_meta,
        },
    )
