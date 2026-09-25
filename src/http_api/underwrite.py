"""Underwrite endpoint — invoke the compiled LangGraph agent."""

from __future__ import annotations

import json
import logging
import time
from typing import TypeVar
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from evals.gold_set import load_gold_cases, summarize_routes
from evals.tracing import span
from graph.runtime import configure_langsmith, decision_from_state, run_underwrite
from http_api.deps import SettingsDep
from http_api.errors import extract_error_message
from http_api.metrics import METRICS
from http_api.schemas import (
    GoldSetCase,
    GoldSetResponse,
    UnderwriteRequest,
    UnderwriteResponse,
)
from models import Applicant, EscalationPackage, LoanProgram, SubagentOutput

logger = logging.getLogger(__name__)

router = APIRouter(tags=["underwrite"])

TModel = TypeVar("TModel", bound=BaseModel)


def _applicant_from_request(body: UnderwriteRequest) -> Applicant:
    raw = body.applicant
    metadata = dict(raw.metadata)
    if raw.notes:
        metadata.setdefault("notes", raw.notes)
    return Applicant(
        applicant_id=raw.applicant_id or f"A-{uuid4().hex[:10]}",
        business_name=raw.business_name,
        industry=raw.industry,
        annual_revenue=raw.annual_revenue,
        requested_loan_amount=raw.requested_loan_amount,
        years_in_business=raw.years_in_business,
        debt_service_coverage_ratio=raw.debt_service_coverage_ratio,
        credit_score_proxy=raw.credit_score_proxy,
        sbss_proxy=raw.sbss_proxy,
        has_bankruptcy=raw.has_bankruptcy,
        has_severe_fraud_alert=raw.has_severe_fraud_alert,
        requested_program=(
            LoanProgram(raw.requested_program) if raw.requested_program else None
        ),
        lender_id=raw.lender_id,
        metadata=metadata,
    )


def _coerce(model: type[TModel], value: object) -> TModel:
    if isinstance(value, model):
        return value
    if hasattr(value, "model_dump"):
        return model.model_validate(value.model_dump(mode="json"))  # type: ignore[union-attr]
    return model.model_validate(value)


@router.get("/gold-set", response_model=GoldSetResponse)
def gold_set() -> GoldSetResponse:
    """Labeled gold-set catalog for the underwrite playground queue."""
    try:
        cases = load_gold_cases()
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    rows = [
        GoldSetCase(
            case_id=case.case_id,
            applicant_id=case.applicant.applicant_id,
            business_name=case.applicant.business_name,
            industry=case.applicant.industry,
            annual_revenue=case.applicant.annual_revenue,
            requested_loan_amount=case.applicant.requested_loan_amount,
            years_in_business=case.applicant.years_in_business,
            debt_service_coverage_ratio=case.applicant.debt_service_coverage_ratio,
            credit_score_proxy=case.applicant.credit_score_proxy,
            sbss_proxy=case.applicant.sbss_proxy,
            has_bankruptcy=case.applicant.has_bankruptcy,
            has_severe_fraud_alert=case.applicant.has_severe_fraud_alert,
            requested_program=(
                case.applicant.requested_program.value
                if case.applicant.requested_program
                else None
            ),
            gold_outcome=case.label.outcome.value,
            gold_risk_tier=case.label.risk_tier.value,
            gold_program=(
                case.label.recommended_program
                if case.label.recommended_program
                else None
            ),
            gold_rationale=case.label.rationale,
        )
        for case in cases
    ]
    return GoldSetResponse(
        n_cases=len(rows),
        counts=summarize_routes(cases),
        cases=rows,
    )


@router.post("/underwrite", response_model=UnderwriteResponse)
def underwrite(body: UnderwriteRequest, settings: SettingsDep) -> UnderwriteResponse:
    """Run the underwriting graph on a synthetic applicant."""
    configure_langsmith(settings)
    applicant = _applicant_from_request(body)

    with span("http.underwrite") as current:
        if current is not None:
            current.log(
                input={
                    "case_id": body.case_id,
                    "applicant_id": applicant.applicant_id,
                    "business_name": applicant.business_name,
                }
            )
        t0 = time.perf_counter()
        try:
            state = run_underwrite(
                applicant,
                case_id=body.case_id,
                max_retries=body.max_retries,
            )
        except Exception as exc:  # noqa: BLE001
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            METRICS.record(outcome="error", latency_ms=elapsed_ms, error=True)
            logger.error(
                json.dumps(
                    {
                        "event": "underwrite.error",
                        "applicant_id": applicant.applicant_id,
                        "latency_ms": round(elapsed_ms, 2),
                        "error": extract_error_message(exc),
                    }
                )
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=extract_error_message(exc),
            ) from exc
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        try:
            decision = decision_from_state(state)
        except RuntimeError as exc:
            METRICS.record(outcome="error", latency_ms=elapsed_ms, error=True)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc

        outputs = {
            key: _coerce(SubagentOutput, value)
            for key, value in (state.get("subagent_outputs") or {}).items()
        }
        escalation_raw = state.get("escalation")
        response = UnderwriteResponse(
            case_id=str(state.get("case_id") or body.case_id or applicant.applicant_id),
            decision=decision,
            program_routing=decision.program_routing,
            citations=list(decision.citations),
            subagent_outputs=outputs,
            escalation=(
                None
                if escalation_raw is None
                else _coerce(EscalationPackage, escalation_raw)
            ),
            latency_ms=elapsed_ms,
        )
        METRICS.record(outcome=decision.outcome.value, latency_ms=elapsed_ms)
        logger.info(
            json.dumps(
                {
                    "event": "underwrite.decision",
                    "case_id": response.case_id,
                    "outcome": decision.outcome.value,
                    "latency_ms": round(elapsed_ms, 2),
                    "n_citations": len(response.citations),
                    "escalated": response.escalation is not None,
                }
            )
        )
        if current is not None:
            current.log(
                output={
                    "case_id": response.case_id,
                    "outcome": decision.outcome.value,
                    "latency_ms": elapsed_ms,
                    "n_citations": len(response.citations),
                }
            )
        return response
