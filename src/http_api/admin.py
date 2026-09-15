"""Admin routes for policy RAG ingestion (pgvector by default)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from http_api.db import index_stats, ping_database
from http_api.deps import SettingsDep, require_admin
from http_api.schemas import IngestRequest, IngestResponse, RagStatusResponse
from config import IngestTarget
from evals.tracing import span
from policy_rag.ingest import (
    IngestResult,
    ingest_policy_sources,
    list_policy_source_files,
    load_policy_documents,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/rag", tags=["admin-rag"], dependencies=[Depends(require_admin)])


def _resolve_targets(
    settings_targets: tuple[IngestTarget, ...],
    request_targets: list[str] | None,
    *,
    allow_hybrid: bool,
) -> tuple[IngestTarget, ...]:
    if request_targets is None:
        return settings_targets
    raw = [t.strip().lower() for t in request_targets if t.strip()]
    if not raw:
        return settings_targets
    unknown = [t for t in raw if t not in {"vector", "hybrid"}]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown ingest targets: {', '.join(unknown)}",
        )
    if not allow_hybrid and any(t == "hybrid" for t in raw):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Elasticsearch hybrid ingest is disabled "
                "(set RAG_ALLOW_HYBRID=true to enable; not used in this project yet)."
            ),
        )
    out: list[IngestTarget] = []
    for t in raw:
        if t not in out:
            out.append(t)  # type: ignore[arg-type]
    return tuple(out)


@router.get("/status", response_model=RagStatusResponse)
def rag_status(settings: SettingsDep) -> RagStatusResponse:
    """Index + corpus status without running ingest."""
    try:
        targets = list(settings.ingest_targets())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    reachable = ping_database(settings)
    stats = index_stats(settings, settings.rag_index_name) if reachable else {
        "index_exists": None,
        "row_count": None,
    }
    return RagStatusResponse(
        index_name=settings.rag_index_name,
        strategy=settings.rag_strategy,
        ingest_targets=targets,
        allow_hybrid=settings.rag_allow_hybrid,
        database_configured=bool(settings.database_url),
        database_reachable=reachable,
        index_exists=stats.get("index_exists"),
        row_count=stats.get("row_count"),
        source_files=list_policy_source_files(),
        voyage_configured=bool((settings.voyage_api_key or "").strip()),
    )


@router.post("/ingest", response_model=IngestResponse)
def rag_ingest(body: IngestRequest, settings: SettingsDep) -> IngestResponse:
    """Rebuild the policy vector index from ``data/policy_sources``."""
    with span("http.admin.rag_ingest") as current:
        if current is not None:
            current.log(input={"dry_run": body.dry_run, "targets": body.targets})
        return _rag_ingest_impl(body, settings)


def _rag_ingest_impl(body: IngestRequest, settings: SettingsDep) -> IngestResponse:
    try:
        default_targets = settings.ingest_targets()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    targets = _resolve_targets(
        default_targets,
        body.targets,  # type: ignore[arg-type]
        allow_hybrid=settings.rag_allow_hybrid,
    )
    index_name = body.index_name or settings.rag_index_name

    if body.dry_run:
        docs = load_policy_documents()
        if not docs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No policy documents found under data/policy_sources",
            )
        by_program: dict[str, int] = {}
        for d in docs:
            key = str(d.metadata.get("program", "unknown"))
            by_program[key] = by_program.get(key, 0) + 1
        return IngestResponse(
            status="dry_run",
            index_name=index_name,
            targets=list(targets),
            source_units=len(docs),
            by_program=by_program,
            source_files=list_policy_source_files(),
        )

    try:
        result: IngestResult = ingest_policy_sources(targets=targets, index_name=index_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 — surface ingest failures as 502
        logger.exception("Policy ingest failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ingest failed: {exc}",
        ) from exc

    return IngestResponse(
        status="ok",
        index_name=result.index_name,
        targets=list(result.targets),
        source_units=result.source_units,
        by_program=result.by_program,
        source_files=result.source_files,
    )
