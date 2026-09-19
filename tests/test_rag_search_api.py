"""RAG search / ask API tests (pipeline mocked — no Voyage / Postgres required)."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from http_api import create_app
from models import Citation, PolicyLayer, PolicySource
from rag.pipeline import RetrievalResult


def _cite(text: str, program: PolicyLayer, *, url: str | None = "https://example.com/policy") -> Citation:
    return Citation(
        clause_id=f"c-{program.value}",
        source=PolicySource(
            source_id="test",
            name="test-source.pdf",
            title="Test source",
            url=url,
            authority="sba",
            version="1",
            effective_date=datetime(2024, 1, 1, tzinfo=timezone.utc),
            program=program,
        ),
        retrieved_text=text,
        similarity_score=0.9,
        program=program,
    )


def test_rag_search_retries_then_succeeds() -> None:
    result = RetrievalResult(
        docs=["SBSS minimum score is 165 for SBA 7(a)."],
        metadata=[{"source": "sop.pdf", "program": "sba_7a", "score": 0.91}],
        strategy="vector",
        es_hits=[],
        rerank=[],
    )
    pipeline = MagicMock()
    pipeline.retrieve.side_effect = [ConnectionError("blip"), result]

    with (
        patch("http_api.rag.get_policy_pipeline", return_value=pipeline),
        patch(
            "http_api.rag.citations_from_retrieval",
            return_value=[_cite(result.docs[0], PolicyLayer.SBA_7A)],
        ),
    ):
        client = TestClient(create_app())
        res = client.post("/rag/search", json={"query": "SBSS score", "top_k": 3})

    assert res.status_code == 200, res.text
    assert pipeline.retrieve.call_count == 2


def test_rag_search_exhausts_retries_returns_502() -> None:
    pipeline = MagicMock()
    pipeline.retrieve.side_effect = ConnectionError("voyage down")

    with patch("http_api.rag.get_policy_pipeline", return_value=pipeline):
        client = TestClient(create_app())
        res = client.post("/rag/search", json={"query": "SBSS score", "top_k": 3})

    assert res.status_code == 502
    assert pipeline.retrieve.call_count == 3


def test_rag_search_returns_hits() -> None:
    result = RetrievalResult(
        docs=["SBSS minimum score is 165 for SBA 7(a)."],
        metadata=[{"source": "sop.pdf", "program": "sba_7a", "score": 0.91}],
        strategy="vector",
        es_hits=[],
        rerank=[],
    )
    pipeline = MagicMock()
    pipeline.retrieve.return_value = result

    with (
        patch("http_api.rag.get_policy_pipeline", return_value=pipeline),
        patch(
            "http_api.rag.citations_from_retrieval",
            return_value=[_cite(result.docs[0], PolicyLayer.SBA_7A)],
        ),
    ):
        client = TestClient(create_app())
        res = client.post(
            "/rag/search",
            json={"query": "SBSS score for 7(a)", "top_k": 3},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["with_answer"] is False
    assert body["answer"] is None
    assert len(body["hits"]) == 1
    assert body["hits"][0]["program"] == "sba_7a"
    assert body["hits"][0]["url"] == "https://example.com/policy"
    assert body["hits"][0]["title"] == "Test source"
    assert "165" in body["hits"][0]["text"]
    pipeline.generate.assert_not_called()


def test_rag_search_with_answer_calls_generate() -> None:
    result = RetrievalResult(
        docs=["CDFI direct needs $50k revenue."],
        metadata=[{"source": "accion.md", "program": "cdfi_direct", "score": 0.88}],
        strategy="vector",
        es_hits=[],
        rerank=[],
    )
    pipeline = MagicMock()
    pipeline.retrieve.return_value = result
    pipeline.generate.return_value = {
        "content": "Applicants need at least $50k annual revenue.",
        "retrieval_context": result.docs,
    }

    with (
        patch("http_api.rag.get_policy_pipeline", return_value=pipeline),
        patch(
            "http_api.rag.citations_from_retrieval",
            return_value=[_cite(result.docs[0], PolicyLayer.CDFI_DIRECT)],
        ),
    ):
        client = TestClient(create_app())
        res = client.post(
            "/rag/search",
            json={
                "query": "CDFI revenue floor?",
                "with_answer": True,
                "program": "cdfi_direct",
            },
        )

    assert res.status_code == 200
    body = res.json()
    assert body["with_answer"] is True
    assert "50k" in body["answer"]
    pipeline.generate.assert_called_once()


def test_rag_ask_forces_answer() -> None:
    result = RetrievalResult(
        docs=["ECOA prohibits discrimination."],
        metadata=[{"source": "regb.pdf", "program": "compliance_floor", "score": 0.95}],
        strategy="vector",
        es_hits=[],
        rerank=[],
    )
    pipeline = MagicMock()
    pipeline.retrieve.return_value = result
    pipeline.generate.return_value = {"content": "Compliance floor applies."}

    with (
        patch("http_api.rag.get_policy_pipeline", return_value=pipeline),
        patch(
            "http_api.rag.citations_from_retrieval",
            return_value=[_cite(result.docs[0], PolicyLayer.COMPLIANCE_FLOOR)],
        ),
    ):
        client = TestClient(create_app())
        res = client.post("/rag/ask", json={"query": "ECOA rule?"})

    assert res.status_code == 200
    assert res.json()["answer"]
    pipeline.generate.assert_called_once()


def test_rag_search_generic_lender_excludes_accion_overlay() -> None:
    shared = _cite("Shared SBA rule.", PolicyLayer.SBA_7A)
    accion = Citation(
        clause_id="c-accion",
        source=PolicySource(
            source_id="accion",
            name="accion.md",
            title="Accion criteria",
            url=None,
            authority="lender",
            version="1",
            effective_date=datetime(2024, 1, 1, tzinfo=timezone.utc),
            program=PolicyLayer.CDFI_DIRECT,
            lender_id="accion",
        ),
        retrieved_text="Accion revenue floor $50k.",
        similarity_score=0.9,
        program=PolicyLayer.CDFI_DIRECT,
    )
    result = RetrievalResult(
        docs=[shared.retrieved_text, accion.retrieved_text],
        metadata=[{}, {}],
        strategy="vector",
        es_hits=[],
        rerank=[],
    )
    pipeline = MagicMock()
    pipeline.retrieve.return_value = result

    with (
        patch("http_api.rag.get_policy_pipeline", return_value=pipeline),
        patch(
            "http_api.rag.citations_from_retrieval",
            return_value=[shared, accion],
        ),
    ):
        client = TestClient(create_app())
        res = client.post(
            "/rag/search",
            json={"query": "loan criteria", "top_k": 5, "lender_id": None},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["lender_filter"] is None
    assert [h["clause_id"] for h in body["hits"]] == ["c-sba_7a"]


def test_rag_search_accion_includes_overlay() -> None:
    shared = _cite("Shared compliance.", PolicyLayer.COMPLIANCE_FLOOR)
    shared.source.authority = "regulatory"
    accion = Citation(
        clause_id="c-accion",
        source=PolicySource(
            source_id="accion",
            name="accion.md",
            title="Accion criteria",
            url=None,
            authority="lender",
            version="1",
            effective_date=datetime(2024, 1, 1, tzinfo=timezone.utc),
            program=PolicyLayer.CDFI_DIRECT,
            lender_id="accion",
        ),
        retrieved_text="Accion revenue floor $50k.",
        similarity_score=0.9,
        program=PolicyLayer.CDFI_DIRECT,
    )
    result = RetrievalResult(
        docs=[shared.retrieved_text, accion.retrieved_text],
        metadata=[{}, {}],
        strategy="vector",
        es_hits=[],
        rerank=[],
    )
    pipeline = MagicMock()
    pipeline.retrieve.return_value = result

    with (
        patch("http_api.rag.get_policy_pipeline", return_value=pipeline),
        patch(
            "http_api.rag.citations_from_retrieval",
            return_value=[shared, accion],
        ),
    ):
        client = TestClient(create_app())
        res = client.post(
            "/rag/search",
            json={"query": "CDFI criteria", "top_k": 5, "lender_id": "accion"},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["lender_filter"] == "accion"
    ids = {h["clause_id"] for h in body["hits"]}
    assert ids == {"c-compliance_floor", "c-accion"}
    assert any(h.get("lender_id") == "accion" for h in body["hits"])
