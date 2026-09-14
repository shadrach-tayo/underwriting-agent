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


class HealthResponse(BaseModel):
    status: str
    version: str


class ReadyResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    database_reachable: bool
    detail: str | None = None
