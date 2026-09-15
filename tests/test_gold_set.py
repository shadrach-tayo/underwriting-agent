"""Validate gold-set JSONL against Applicant + GoldLabel schema."""

from __future__ import annotations

from evals.gold_set import load_gold_cases, summarize_routes
from evals.generate_gold_set import build_cases, write_gold_set
from models import DecisionOutcome


def test_build_cases_cover_routing_strata() -> None:
    cases = build_cases()
    assert len(cases) >= 40
    summary = summarize_routes(cases)
    assert summary["approve"] >= 8
    assert summary["deny"] >= 5
    assert summary["escalate"] >= 5
    assert summary["route_cdfi_direct"] >= 3
    assert summary["route_both"] >= 3
    assert summary["route_neither"] >= 3
    # Signature routing case: SBSS miss + CDFI hit
    routing = next(c for c in cases if c.case_id == "gold-003")
    assert routing.label.eligible_programs == ["cdfi_direct"]
    assert routing.label.recommended_program == "cdfi_direct"
    assert routing.label.outcome in {DecisionOutcome.APPROVE, DecisionOutcome.ESCALATE}


def test_gold_set_file_roundtrip(tmp_path) -> None:  # type: ignore[no-untyped-def]
    path = tmp_path / "applicants.jsonl"
    write_gold_set(path)
    loaded = load_gold_cases(path)
    assert len(loaded) == len(build_cases())
    assert loaded[0].applicant.applicant_id
    assert loaded[0].label.rationale


def test_committed_gold_set_loads() -> None:
    cases = load_gold_cases()
    assert len(cases) >= 40
    ids = [c.case_id for c in cases]
    assert len(ids) == len(set(ids))
