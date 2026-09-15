"""Gold-set record schema and load helpers."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from models import Applicant, DecisionOutcome, LoanProgram, RiskTier

REPO_ROOT = Path(__file__).resolve().parents[2]
GOLD_SET_PATH = REPO_ROOT / "data" / "gold_set" / "applicants.jsonl"

ExpectedProgram = Literal["sba_7a", "cdfi_direct"]


class GoldLabel(BaseModel):
    """Rule-based ground truth for evals (Week 1 Day 4 / Week 4 metrics)."""

    outcome: DecisionOutcome
    compliance_floor_pass: bool = True
    eligibility_gate_pass: bool = True
    eligible_programs: list[ExpectedProgram] = Field(default_factory=list)
    recommended_program: ExpectedProgram | None = None
    risk_tier: RiskTier
    rationale: str
    calibration_tags: list[str] = Field(default_factory=list)
    # Free-form pointers into Fed SBCS / policy layers used when labeling.
    policy_refs: list[str] = Field(default_factory=list)


class GoldCase(BaseModel):
    case_id: str
    applicant: Applicant
    label: GoldLabel
    metadata: dict[str, Any] = Field(default_factory=dict)


def load_gold_cases(path: Path | None = None) -> list[GoldCase]:
    """Load and validate the JSONL gold set."""
    target = path or GOLD_SET_PATH
    if not target.is_file():
        raise FileNotFoundError(f"Gold set not found: {target}")
    cases: list[GoldCase] = []
    with target.open(encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, start=1):
            text = line.strip()
            if not text or text.startswith("#"):
                continue
            try:
                cases.append(GoldCase.model_validate_json(text))
            except Exception as exc:  # noqa: BLE001 — surface line number
                raise ValueError(f"Invalid gold case at {target}:{line_no}: {exc}") from exc
    return cases


def summarize_routes(cases: list[GoldCase]) -> dict[str, int]:
    counts: dict[str, int] = {
        "approve": 0,
        "deny": 0,
        "escalate": 0,
        "route_sba_7a": 0,
        "route_cdfi_direct": 0,
        "route_both": 0,
        "route_neither": 0,
    }
    for case in cases:
        counts[case.label.outcome.value] += 1
        programs = set(case.label.eligible_programs)
        if programs == {"sba_7a", "cdfi_direct"}:
            counts["route_both"] += 1
        elif programs == {"sba_7a"}:
            counts["route_sba_7a"] += 1
        elif programs == {"cdfi_direct"}:
            counts["route_cdfi_direct"] += 1
        else:
            counts["route_neither"] += 1
    return counts


# Re-export for callers
__all__ = [
    "GOLD_SET_PATH",
    "ExpectedProgram",
    "GoldCase",
    "GoldLabel",
    "LoanProgram",
    "load_gold_cases",
    "summarize_routes",
]
