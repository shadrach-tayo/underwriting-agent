"""API request/response models."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Literal

from pydantic import BaseModel, Field

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


ProgramLayerName = Literal[
    "compliance_floor",
    "eligibility_gate",
    "sba_7a",
    "cdfi_direct",
]


class RagSearchRequest(BaseModel):
    """Playground / console policy retrieval."""

    query: str = Field(min_length=1, max_length=4000)
    top_k: int = Field(default=5, ge=1, le=20)
    program: ProgramLayerName | None = Field(
        default=None,
        description="Optional policy-layer filter applied after retrieval.",
    )
    with_answer: bool = Field(
        default=False,
        description="If true, also call the LLM over retrieved context (agent search).",
    )


class RagHit(BaseModel):
    clause_id: str
    text: str
    score: float
    program: str
    source: str
    authority: str
    metadata: dict[str, str] = Field(default_factory=dict)


class RagSearchResponse(BaseModel):
    query: str
    index_name: str
    strategy: str
    program_filter: str | None = None
    with_answer: bool = False
    hits: list[RagHit]
    answer: str | None = None


class RagAskResponse(BaseModel):
    query: str
    index_name: str
    strategy: str
    program_filter: str | None = None
    hits: list[RagHit]
    answer: str
