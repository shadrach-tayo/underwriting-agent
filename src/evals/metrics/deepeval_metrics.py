"""DeepEval custom metric wrappers for decision-level scores."""

from __future__ import annotations

from deepeval.metrics import BaseMetric
from deepeval.test_case import LLMTestCase

from evals.gold_set import GoldCase
from evals.metrics.decision import (
    decision_match,
    is_false_approve,
    program_route_match,
)
from evals.types import Prediction


class DecisionAccuracyMetric(BaseMetric):
    """Exact outcome match vs gold label (EVALS.md decision accuracy)."""

    def __init__(self, gold: GoldCase, pred: Prediction, threshold: float = 0.9) -> None:
        self.gold = gold
        self.pred = pred
        self.threshold = threshold
        self.score: float | None = None
        self.success: bool | None = None
        self.reason: str | None = None
        self.error: str | None = None

    def measure(self, test_case: LLMTestCase) -> float:
        matched = decision_match(self.gold, self.pred)
        self.score = 1.0 if matched else 0.0
        self.success = self.score >= self.threshold
        self.reason = (
            f"pred={self.pred.decision.outcome.value} "
            f"gold={self.gold.label.outcome.value}"
        )
        return self.score

    async def a_measure(self, test_case: LLMTestCase) -> float:
        return self.measure(test_case)

    def is_successful(self) -> bool:
        return bool(self.success)

    @property
    def __name__(self) -> str:
        return "DecisionAccuracyMetric"


class FalseApproveMetric(BaseMetric):
    """1.0 if this case is a false approve (hard gate wants suite rate == 0)."""

    def __init__(self, gold: GoldCase, pred: Prediction, threshold: float = 0.0) -> None:
        self.gold = gold
        self.pred = pred
        # For a single case, success means NOT a false approve.
        self.threshold = threshold
        self.score: float | None = None
        self.success: bool | None = None
        self.reason: str | None = None
        self.error: str | None = None

    def measure(self, test_case: LLMTestCase) -> float:
        bad = is_false_approve(self.gold, self.pred)
        self.score = 1.0 if bad else 0.0
        self.success = not bad
        self.reason = "false_approve" if bad else "ok"
        return self.score

    async def a_measure(self, test_case: LLMTestCase) -> float:
        return self.measure(test_case)

    def is_successful(self) -> bool:
        return bool(self.success)

    @property
    def __name__(self) -> str:
        return "FalseApproveMetric"


class ProgramRoutingMetric(BaseMetric):
    def __init__(self, gold: GoldCase, pred: Prediction, threshold: float = 0.9) -> None:
        self.gold = gold
        self.pred = pred
        self.threshold = threshold
        self.score: float | None = None
        self.success: bool | None = None
        self.reason: str | None = None
        self.error: str | None = None

    def measure(self, test_case: LLMTestCase) -> float:
        matched = program_route_match(self.gold, self.pred)
        self.score = 1.0 if matched else 0.0
        self.success = self.score >= self.threshold
        self.reason = "route_match" if matched else "route_mismatch"
        return self.score

    async def a_measure(self, test_case: LLMTestCase) -> float:
        return self.measure(test_case)

    def is_successful(self) -> bool:
        return bool(self.success)

    @property
    def __name__(self) -> str:
        return "ProgramRoutingMetric"
