"""Shared data models for applicants, decisions, and audit events."""

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class DecisionOutcome(StrEnum):
    APPROVE = "approve"
    DENY = "deny"
    ESCALATE = "escalate"


class Applicant(BaseModel):
    """Structured SME loan applicant profile (synthetic / non-PII)."""

    applicant_id: str
    business_name: str
    industry: str
    annual_revenue: float = Field(ge=0)
    requested_loan_amount: float = Field(gt=0)
    years_in_business: float = Field(ge=0)
    debt_service_coverage_ratio: float | None = None
    credit_score_proxy: int | None = Field(default=None, ge=300, le=850)
    metadata: dict[str, Any] = Field(default_factory=dict)


class FinancialAnalysis(BaseModel):
    debt_to_income: float | None = None
    risk_score: float = Field(ge=0.0, le=1.0)
    risk_tier: str
    notes: list[str] = Field(default_factory=list)


class PolicyMatch(BaseModel):
    clause_id: str
    source: str
    excerpt: str
    citation: str


class DecisionResult(BaseModel):
    outcome: DecisionOutcome
    confidence: float = Field(ge=0.0, le=1.0)
    risk_score: float = Field(ge=0.0, le=1.0)
    reasoning_trace: list[str] = Field(default_factory=list)
    citations: list[PolicyMatch] = Field(default_factory=list)
    ceiling_triggered: bool = False
