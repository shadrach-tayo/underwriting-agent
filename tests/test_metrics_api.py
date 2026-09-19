"""Underwrite metrics + health endpoint tests."""

from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from http_api import create_app
from http_api.metrics import METRICS
from models import (
    Decision,
    DecisionOrigin,
    DecisionOutcome,
    RiskTier,
)


def test_metrics_empty_snapshot() -> None:
    METRICS.reset()
    client = TestClient(create_app())
    res = client.get("/metrics")
    assert res.status_code == 200
    body = res.json()
    assert body["decisions_today"] == 0
    assert body["escalation_rate"] is None
    assert body["latency_ms"]["count"] == 0
    assert body["outcomes"] == {"approve": 0, "deny": 0, "escalate": 0}


def test_metrics_records_underwrite_outcomes() -> None:
    METRICS.reset()
    decision = Decision(
        outcome=DecisionOutcome.ESCALATE,
        origin=DecisionOrigin.AUTO,
        risk_tier=RiskTier.MEDIUM,
        ceiling_triggered=False,
        rationale="borderline",
    )
    state = {
        "case_id": "case-metrics-1",
        "decision": decision,
        "subagent_outputs": {},
        "escalation": None,
    }
    client = TestClient(create_app())
    payload = {
        "applicant": {
            "business_name": "Metrics Co",
            "industry": "retail",
            "annual_revenue": 500_000,
            "requested_loan_amount": 75_000,
            "years_in_business": 5,
            "debt_service_coverage_ratio": 1.4,
            "credit_score_proxy": 720,
            "sbss_proxy": 180,
        }
    }
    with patch("http_api.underwrite.run_underwrite", return_value=state):
        res = client.post("/underwrite", json=payload)
    assert res.status_code == 200

    metrics = client.get("/metrics").json()
    assert metrics["decisions_today"] == 1
    assert metrics["outcomes"]["escalate"] == 1
    assert metrics["escalation_rate"] == 1.0
    assert metrics["latency_ms"]["count"] >= 1
    assert metrics["latency_ms"]["p50"] is not None
