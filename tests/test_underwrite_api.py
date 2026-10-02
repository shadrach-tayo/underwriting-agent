"""Underwrite API tests (graph invoke mocked)."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from http_api import create_app
from models import (
    Citation,
    Decision,
    DecisionOrigin,
    DecisionOutcome,
    LoanProgram,
    PolicyLayer,
    PolicySource,
    ProgramRouting,
    RiskTier,
    SubagentName,
    SubagentOutput,
)
from retries import DATABASE_UNAVAILABLE_MESSAGE, DatabaseUnavailableError


def _decision() -> Decision:
    return Decision(
        outcome=DecisionOutcome.APPROVE,
        origin=DecisionOrigin.AUTO,
        risk_tier=RiskTier.LOW,
        ceiling_triggered=False,
        rationale="Within envelope",
        program_routing=ProgramRouting(
            compliance_floor_pass=True,
            eligibility_gate_pass=True,
            eligible_programs=[LoanProgram.SBA_7A, LoanProgram.CDFI_DIRECT],
            recommended_program=LoanProgram.SBA_7A,
        ),
        citations=[
            Citation(
                clause_id="sop:sbss",
                source=PolicySource(
                    source_id="sop",
                    name="sop.pdf",
                    authority="sba",
                    version="1",
                    effective_date=datetime(2024, 1, 1, tzinfo=timezone.utc),
                    program=PolicyLayer.SBA_7A,
                ),
                retrieved_text="SBSS minimum is 165.",
                similarity_score=0.9,
                program=PolicyLayer.SBA_7A,
            )
        ],
    )


def test_underwrite_returns_decision() -> None:
    decision = _decision()
    policy_out = SubagentOutput(
        agent=SubagentName.POLICY,
        conclusion="ok",
        confidence=0.9,
        reasoning_trace="ok",
        citations=decision.citations,
        program_routing=decision.program_routing,
    )
    state = {
        "case_id": "case-demo",
        "decision": decision,
        "subagent_outputs": {"policy_compliance": policy_out},
        "escalation": None,
    }

    with patch("http_api.underwrite.run_underwrite", return_value=state):
        client = TestClient(create_app())
        res = client.post(
            "/underwrite",
            json={
                "case_id": "case-demo",
                "applicant": {
                    "business_name": "Northside Supply Co.",
                    "industry": "wholesale trade",
                    "annual_revenue": 180000,
                    "requested_loan_amount": 75000,
                    "years_in_business": 3,
                    "credit_score_proxy": 700,
                    "sbss_proxy": 180,
                    "debt_service_coverage_ratio": 1.4,
                    "requested_program": "sba_7a",
                },
            },
        )

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["case_id"] == "case-demo"
    assert body["decision"]["outcome"] == "approve"
    assert body["decision"]["rationale"]["summary"] == "Within envelope"
    assert body["decision"]["rationale"]["sections"][0]["kind"] == "general"
    assert "improvement_actions" in body["decision"]
    assert body["program_routing"]["recommended_program"] == "sba_7a"
    assert len(body["citations"]) == 1


def test_underwrite_accepts_lender_id() -> None:
    decision = _decision()
    state = {
        "case_id": "case-lender",
        "decision": decision,
        "subagent_outputs": {},
        "escalation": None,
    }
    with patch("http_api.underwrite.run_underwrite", return_value=state) as mocked:
        client = TestClient(create_app())
        res = client.post(
            "/underwrite",
            json={
                "case_id": "case-lender",
                "applicant": {
                    "business_name": "Accion Demo Co",
                    "industry": "retail trade",
                    "annual_revenue": 120000,
                    "requested_loan_amount": 150000,
                    "years_in_business": 2,
                    "requested_program": "sba_7a",
                    "lender_id": "accion",
                },
            },
        )
    assert res.status_code == 200, res.text
    applicant = mocked.call_args.args[0]
    assert applicant.lender_id == "accion"
    assert applicant.requested_program == LoanProgram.SBA_7A


def test_underwrite_database_outage_returns_503() -> None:
    with patch(
        "http_api.underwrite.run_underwrite",
        side_effect=DatabaseUnavailableError(),
    ):
        client = TestClient(create_app())
        res = client.post(
            "/underwrite",
            json={
                "case_id": "case-db",
                "applicant": {
                    "business_name": "Northside Supply Co.",
                    "industry": "wholesale trade",
                    "annual_revenue": 180000,
                    "requested_loan_amount": 75000,
                    "years_in_business": 3,
                    "credit_score_proxy": 700,
                    "sbss_proxy": 180,
                    "debt_service_coverage_ratio": 1.4,
                },
            },
        )
    assert res.status_code == 503
    assert res.json()["detail"] == DATABASE_UNAVAILABLE_MESSAGE
