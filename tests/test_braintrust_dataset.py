"""Braintrust gold-dataset mapping tests (no API key required)."""

from __future__ import annotations

from evals.braintrust_dataset import gold_case_to_record, sync_gold_dataset
from evals.gold_set import load_gold_cases


def test_gold_case_to_record_shape() -> None:
    case = load_gold_cases()[0]
    rec = gold_case_to_record(case)
    assert rec["id"] == case.case_id
    assert rec["input"]["case_id"] == case.case_id
    assert "applicant" in rec["input"]
    assert rec["expected"]["outcome"] == case.label.outcome.value
    assert rec["metadata"]["case_id"] == case.case_id
    assert any(t.startswith("outcome:") for t in rec["tags"])


def test_sync_dry_run_lists_all_cases() -> None:
    summary = sync_gold_dataset(dry_run=True)
    cases = load_gold_cases()
    assert summary["dry_run"] is True
    assert summary["n_records"] == len(cases)
    assert summary["dataset"] == "underwriting-gold-set"
    assert summary["case_ids"][0] == cases[0].case_id
