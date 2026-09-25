"""Gold-set catalog endpoint for the underwrite playground."""

from __future__ import annotations

from fastapi.testclient import TestClient

from evals.gold_set import load_gold_cases, summarize_routes
from http_api import create_app


def test_gold_set_catalog() -> None:
    cases = load_gold_cases()
    expected = summarize_routes(cases)
    client = TestClient(create_app())
    res = client.get("/gold-set")
    assert res.status_code == 200
    body = res.json()
    assert body["n_cases"] == len(cases) == 42
    assert body["counts"]["approve"] == expected["approve"]
    assert body["counts"]["deny"] == expected["deny"]
    assert body["counts"]["escalate"] == expected["escalate"]
    first = body["cases"][0]
    assert first["case_id"] == cases[0].case_id
    assert first["business_name"] == cases[0].applicant.business_name
    assert first["gold_outcome"] == cases[0].label.outcome.value
    assert "gold_rationale" in first
