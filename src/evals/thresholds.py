"""Eval success criteria — mirrors EVALS.md."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EvalThresholds:
    """Targets from EVALS.md. ``false_approve_rate_max`` is the hard CI gate."""

    false_approve_rate_max: float = 0.0
    decision_accuracy_min: float = 0.90
    escalation_precision_min: float = 0.80
    citation_accuracy_min: float = 0.95
    program_routing_accuracy_min: float = 0.90
    context_precision_min: float = 0.85
    context_recall_min: float = 0.85
    faithfulness_min: float = 0.85
    latency_p95_ms_max: float = 5000.0


THRESHOLDS = EvalThresholds()

# Metric names used in reports / Braintrust scores
FALSE_APPROVE_RATE = "false_approve_rate"
DECISION_ACCURACY = "decision_accuracy"
ESCALATION_PRECISION = "escalation_precision"
CITATION_ACCURACY = "citation_accuracy"
PROGRAM_ROUTING_ACCURACY = "program_routing_accuracy"
CONTEXT_PRECISION = "context_precision"
CONTEXT_RECALL = "context_recall"
FAITHFULNESS = "faithfulness"
LATENCY_P95_MS = "latency_p95_ms"

HARD_GATE_METRICS = frozenset({FALSE_APPROVE_RATE})
