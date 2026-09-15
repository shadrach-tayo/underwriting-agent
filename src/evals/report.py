"""Aggregate case scores → suite report + hard-gate check."""

from __future__ import annotations

from statistics import quantiles
from typing import Any

from evals.thresholds import (
    CITATION_ACCURACY,
    CONTEXT_PRECISION,
    CONTEXT_RECALL,
    DECISION_ACCURACY,
    ESCALATION_PRECISION,
    FAITHFULNESS,
    FALSE_APPROVE_RATE,
    HARD_GATE_METRICS,
    LATENCY_P95_MS,
    PROGRAM_ROUTING_ACCURACY,
    THRESHOLDS,
    EvalThresholds,
)
from evals.types import CaseScores, SuiteReport


def _mean(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)


def _p95(values: list[float]) -> float | None:
    if not values:
        return None
    if len(values) == 1:
        return values[0]
    # statistics.quantiles n=100 → 99 cut points; index 94 ≈ p95
    cuts = quantiles(values, n=100, method="inclusive")
    return cuts[94]


def aggregate(
    case_scores: list[CaseScores],
    *,
    thresholds: EvalThresholds = THRESHOLDS,
    notes: list[str] | None = None,
) -> SuiteReport:
    decision = [c.decision_match for c in case_scores if c.decision_match is not None]
    false_approves = [c.false_approve for c in case_scores if c.false_approve is not None]
    routes = [
        c.program_route_match for c in case_scores if c.program_route_match is not None
    ]
    esc = [
        c.escalation_precision_hit
        for c in case_scores
        if c.escalation_precision_hit is not None
    ]
    cites = [c.citation_accuracy for c in case_scores if c.citation_accuracy is not None]
    cprec = [c.context_precision for c in case_scores if c.context_precision is not None]
    crec = [c.context_recall for c in case_scores if c.context_recall is not None]
    faith = [c.faithfulness for c in case_scores if c.faithfulness is not None]
    lats = [c.latency_ms for c in case_scores if c.latency_ms is not None]

    scores: dict[str, float] = {}
    thr: dict[str, float] = {
        FALSE_APPROVE_RATE: thresholds.false_approve_rate_max,
        DECISION_ACCURACY: thresholds.decision_accuracy_min,
        ESCALATION_PRECISION: thresholds.escalation_precision_min,
        CITATION_ACCURACY: thresholds.citation_accuracy_min,
        PROGRAM_ROUTING_ACCURACY: thresholds.program_routing_accuracy_min,
        CONTEXT_PRECISION: thresholds.context_precision_min,
        CONTEXT_RECALL: thresholds.context_recall_min,
        FAITHFULNESS: thresholds.faithfulness_min,
        LATENCY_P95_MS: thresholds.latency_p95_ms_max,
    }

    fa_rate = _mean(false_approves)
    if fa_rate is not None:
        scores[FALSE_APPROVE_RATE] = fa_rate
    da = _mean(decision)
    if da is not None:
        scores[DECISION_ACCURACY] = da
    pr = _mean(routes)
    if pr is not None:
        scores[PROGRAM_ROUTING_ACCURACY] = pr
    ep = _mean(esc)
    if ep is not None:
        scores[ESCALATION_PRECISION] = ep
    ca = _mean(cites)
    if ca is not None:
        scores[CITATION_ACCURACY] = ca
    cp = _mean(cprec)
    if cp is not None:
        scores[CONTEXT_PRECISION] = cp
    cr = _mean(crec)
    if cr is not None:
        scores[CONTEXT_RECALL] = cr
    ff = _mean(faith)
    if ff is not None:
        scores[FAITHFULNESS] = ff
    p95 = _p95(lats)
    if p95 is not None:
        scores[LATENCY_P95_MS] = p95

    passed: dict[str, bool] = {}
    for name, value in scores.items():
        limit = thr[name]
        if name == FALSE_APPROVE_RATE or name == LATENCY_P95_MS:
            passed[name] = value <= limit
        else:
            passed[name] = value >= limit

    hard_gate = all(
        passed.get(m, False) for m in HARD_GATE_METRICS if m in scores
    ) and FALSE_APPROVE_RATE in scores

    # Suite pass: hard gate + every scored metric vs threshold.
    suite_ok = hard_gate and all(passed.values())

    return SuiteReport(
        n_cases=len(case_scores),
        scores=scores,
        thresholds={k: thr[k] for k in scores},
        passed=passed,
        hard_gate_passed=hard_gate,
        suite_passed=suite_ok,
        case_scores=case_scores,
        notes=list(notes or []),
    )


def report_as_dict(report: SuiteReport) -> dict[str, Any]:
    return report.model_dump(mode="json")
