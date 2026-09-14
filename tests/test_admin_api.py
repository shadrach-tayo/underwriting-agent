"""Admin RAG API tests (ingest mocked — no Voyage / Postgres required)."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from unittest.mock import patch

from fastapi.testclient import TestClient

from underwriting_agent.api import create_app
from underwriting_agent.config import Settings, get_settings
from underwriting_agent.rag.ingest import IngestResult


@contextmanager
def _override_settings(settings: Settings) -> Iterator[TestClient]:
    get_settings.cache_clear()
    with (
        patch("underwriting_agent.api.deps.get_settings", return_value=settings),
        patch("underwriting_agent.config.get_settings", return_value=settings),
    ):
        yield TestClient(create_app())
    get_settings.cache_clear()


def test_health() -> None:
    client = TestClient(create_app())
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_ready_reports_db() -> None:
    client = TestClient(create_app())
    with patch("underwriting_agent.api.ping_database", return_value=True):
        res = client.get("/ready")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ready"
    assert body["database_reachable"] is True


def test_admin_ingest_dry_run() -> None:
    settings = Settings(admin_api_key=None, rag_ingest_targets="vector")
    docs_meta = type("Doc", (), {"metadata": {"program": "cdfi_direct"}, "page_content": "x"})()

    with (
        _override_settings(settings) as client,
        patch(
            "underwriting_agent.api.admin.load_policy_documents",
            return_value=[docs_meta],
        ),
        patch(
            "underwriting_agent.api.admin.list_policy_source_files",
            return_value=["cdfi_direct_accion_criteria.md"],
        ),
    ):
        res = client.post("/admin/rag/ingest", json={"dry_run": True})

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "dry_run"
    assert body["targets"] == ["vector"]
    assert body["source_units"] == 1
    assert body["by_program"]["cdfi_direct"] == 1


def test_admin_ingest_rejects_hybrid_by_default() -> None:
    settings = Settings(admin_api_key=None, rag_allow_hybrid=False)
    with _override_settings(settings) as client:
        res = client.post("/admin/rag/ingest", json={"targets": ["hybrid"]})
    assert res.status_code == 400
    assert "hybrid" in res.json()["detail"].lower()


def test_admin_ingest_runs_pipeline() -> None:
    settings = Settings(admin_api_key=None, rag_ingest_targets="vector")
    result = IngestResult(
        index_name="underwriting_policy_chunk_512",
        targets=("vector",),
        source_units=3,
        by_program={"compliance_floor": 2, "cdfi_direct": 1},
        source_files=["a.pdf", "b.md"],
    )
    with (
        _override_settings(settings) as client,
        patch("underwriting_agent.api.admin.ingest_policy_sources", return_value=result),
    ):
        res = client.post("/admin/rag/ingest", json={})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["source_units"] == 3
    assert body["targets"] == ["vector"]


def test_admin_requires_key_when_configured() -> None:
    settings = Settings(admin_api_key="secret", rag_allow_hybrid=False)
    with _override_settings(settings) as client:
        denied = client.get("/admin/rag/status")
        assert denied.status_code == 401
        with (
            patch("underwriting_agent.api.admin.ping_database", return_value=False),
            patch(
                "underwriting_agent.api.admin.index_stats",
                return_value={"index_exists": None, "row_count": None},
            ),
            patch("underwriting_agent.api.admin.list_policy_source_files", return_value=[]),
        ):
            ok = client.get("/admin/rag/status", headers={"X-Admin-Key": "secret"})
        assert ok.status_code == 200
        assert ok.json()["ingest_targets"] == ["vector"]
        assert ok.json()["allow_hybrid"] is False
