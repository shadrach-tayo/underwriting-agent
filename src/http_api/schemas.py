"""API request/response models."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Literal

from pydantic import BaseModel, Field

from models import (
    Citation,
    Decision,
    EscalationPackage,
    ProgramRouting,
    SubagentOutput,
)

IngestTargetName = Literal["vector", "hybrid"]


class IngestRequest(BaseModel):
    """Optional overrides for an admin rebuild. Defaults come from Settings."""

    targets: list[IngestTargetName] | None = Field(
        default=None,
        description="Ingest backends. Omit to use RAG_INGEST_TARGETS (default: vector/pgvector).",
    )
    index_name: str | None = Field(
        default=None,
        description="Vector table / index name. Omit to use RAG_INDEX_NAME.",
    )
    dry_run: bool = Field(
        default=False,
        description="If true, load + tag sources but do not write embeddings.",
    )


class IngestResponse(BaseModel):
    status: Literal["ok", "dry_run"]
    index_name: str
    targets: Sequence[str]
    source_units: int
    by_program: dict[str, int]
    source_files: Sequence[str]


class RagStatusResponse(BaseModel):
    index_name: str
    strategy: str
    ingest_targets: Sequence[str]
    allow_hybrid: bool
    database_configured: bool
    database_reachable: bool
    index_exists: bool | None = None
    row_count: int | None = None
    source_files: Sequence[str]
    voyage_configured: bool
    deepseek_configured: bool


class HealthResponse(BaseModel):
    status: str
    version: str


class ReadyResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    database_reachable: bool
    detail: str | None = None


class LatencyMetrics(BaseModel):
    count: int
    p50: float | None = None
    p95: float | None = None


class OutcomeCounts(BaseModel):
    approve: int = 0
    deny: int = 0
    escalate: int = 0


class MetricsResponse(BaseModel):
    """Process-local underwrite dashboard metrics (UTC day window)."""

    day_utc: str
    decisions_today: int
    outcomes: OutcomeCounts
    escalation_rate: float | None = None
    errors_today: int = 0
    latency_ms: LatencyMetrics


ProgramLayerName = Literal[
    "compliance_floor",
    "eligibility_gate",
    "sba_7a",
    "cdfi_direct",
]

LenderIdName = Literal["accion", "frontier_7a"]


class RagSearchRequest(BaseModel):
    """Playground / console policy retrieval."""

    query: str = Field(min_length=1, max_length=4000)
    top_k: int = Field(default=5, ge=1, le=20)
    program: ProgramLayerName | None = Field(
        default=None,
        description=(
            "Optional policy-layer filter applied after retrieval. "
            "When set to a product layer, shared compliance/eligibility chunks stay in scope "
            "unless exact_program=true."
        ),
    )
    lender_id: LenderIdName | None = Field(
        default=None,
        description=(
            "Optional lender overlay. None = generic mode (exclude lender-tagged chunks). "
            "When set, include that lender's chunks plus shared (null lender_id) rules."
        ),
    )
    exact_program: bool = Field(
        default=False,
        description=(
            "If true with program set, keep only that exact layer "
            "(playground layer debugger). Default keeps shared gates in scope."
        ),
    )
    with_answer: bool = Field(
        default=False,
        description="If true, also call the LLM over retrieved context (agent search).",
    )


class RagChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class RagAskStreamRequest(RagSearchRequest):
    """Chat / streaming generate over retrieved policy context."""

    messages: list[RagChatMessage] = Field(
        default_factory=list,
        description="Optional prior turns. The latest user text should also be in query.",
    )


class RagHit(BaseModel):
    clause_id: str
    text: str
    score: float
    program: str
    source: str
    authority: str
    url: str | None = None
    title: str | None = None
    lender_id: str | None = None
    page: int | None = None
    metadata: dict[str, str] = Field(default_factory=dict)


class RagSearchResponse(BaseModel):
    query: str
    index_name: str
    strategy: str
    program_filter: str | None = None
    lender_filter: str | None = None
    with_answer: bool = False
    hits: list[RagHit]
    answer: str | None = None


class RagAskResponse(BaseModel):
    query: str
    index_name: str
    strategy: str
    program_filter: str | None = None
    lender_filter: str | None = None
    hits: list[RagHit]
    answer: str


class UnderwriteApplicantRequest(BaseModel):
    """Synthetic / non-PII applicant payload for ``POST /underwrite``."""

    applicant_id: str | None = None
    business_name: str = Field(min_length=1, max_length=200)
    industry: str = Field(min_length=1, max_length=120)
    annual_revenue: float = Field(ge=0)
    requested_loan_amount: float = Field(gt=0)
    years_in_business: float = Field(ge=0)
    debt_service_coverage_ratio: float | None = None
    credit_score_proxy: int | None = Field(default=None, ge=300, le=850)
    sbss_proxy: int | None = Field(default=None, ge=0, le=300)
    has_bankruptcy: bool = False
    has_severe_fraud_alert: bool = False
    requested_program: Literal["sba_7a", "cdfi_direct"] | None = None
    lender_id: LenderIdName | None = None
    notes: str | None = Field(default=None, max_length=4000)
    metadata: dict[str, str] = Field(default_factory=dict)


class UnderwriteRequest(BaseModel):
    applicant: UnderwriteApplicantRequest
    case_id: str | None = Field(default=None, max_length=120)
    max_retries: int = Field(default=3, ge=0, le=5)


class UnderwriteResponse(BaseModel):
    case_id: str
    decision: Decision
    program_routing: ProgramRouting | None = None
    citations: list[Citation] = Field(default_factory=list)
    subagent_outputs: dict[str, SubagentOutput] = Field(default_factory=dict)
    escalation: EscalationPackage | None = None
    latency_ms: float | None = None


class GoldSetCase(BaseModel):
    """Playground catalog row — gold label plus fields needed to fill the form."""

    case_id: str
    applicant_id: str
    business_name: str
    industry: str
    annual_revenue: float
    requested_loan_amount: float
    years_in_business: float
    debt_service_coverage_ratio: float | None = None
    credit_score_proxy: int | None = None
    sbss_proxy: int | None = None
    has_bankruptcy: bool = False
    has_severe_fraud_alert: bool = False
    requested_program: Literal["sba_7a", "cdfi_direct"] | None = None
    gold_outcome: Literal["approve", "deny", "escalate"]
    gold_risk_tier: str
    gold_program: Literal["sba_7a", "cdfi_direct"] | None = None
    gold_rationale: str


class GoldSetResponse(BaseModel):
    n_cases: int
    counts: dict[str, int]
    cases: list[GoldSetCase]
