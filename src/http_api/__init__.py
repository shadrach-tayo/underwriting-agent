"""FastAPI service wrapping health, readiness, and admin RAG ingest."""

from __future__ import annotations

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from http_api.admin import router as admin_rag_router
from http_api.db import ping_database
from http_api.schemas import HealthResponse, ReadyResponse
from version import __version__


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="Underwriting Decision & Escalation Agent",
        version=__version__,
        description=(
            "Auto-decide within a confidence/risk envelope; escalate everything else. "
            "Admin RAG ingest defaults to pgvector (Elasticsearch hybrid disabled)."
        ),
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(admin_rag_router)

    @application.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(status="ok", version=__version__)

    @application.get("/ready", response_model=ReadyResponse)
    def ready() -> ReadyResponse:
        cfg = get_settings()
        ok = ping_database(cfg)
        if ok:
            return ReadyResponse(status="ready", database_reachable=True)
        return ReadyResponse(
            status="not_ready",
            database_reachable=False,
            detail="Postgres unreachable — start with `docker compose up -d postgres`",
        )

    return application


app = create_app()


def run() -> None:
    """Start the HTTP API with uvicorn (reload on by default for local dev)."""
    settings = get_settings()
    uvicorn.run(
        "http_api:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload,
        reload_dirs=["src"] if settings.api_reload else None,
    )


if __name__ == "__main__":
    run()
