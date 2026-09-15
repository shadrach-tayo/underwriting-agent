"""Eval suite package (Week 4 metrics + Week 1 gold-set helpers)."""

from evals.gold_set import (
    GOLD_SET_PATH,
    GoldCase,
    GoldLabel,
    load_gold_cases,
    summarize_routes,
)
from evals.runner import run_suite
from evals.thresholds import THRESHOLDS
from evals.types import Prediction, SuiteReport

__all__ = [
    "GOLD_SET_PATH",
    "GoldCase",
    "GoldLabel",
    "Prediction",
    "SuiteReport",
    "THRESHOLDS",
    "load_gold_cases",
    "run_suite",
    "summarize_routes",
]
