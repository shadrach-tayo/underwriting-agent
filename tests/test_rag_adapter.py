"""Unit tests for the RagPipeline adapter (no Postgres / Voyage required)."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from rag.pipeline import RetrievalResult

from models import PolicyLayer
from policy_rag import POLICY_INDEX, citations_from_retrieval, policy_sources_dir
from policy_rag.catalog import load_catalog, lookup_source
from policy_rag.ingest import _base_metadata
from policy_rag.tags import resolve_program


def test_policy_sources_dir_exists() -> None:
    assert policy_sources_dir().name == "policy_sources"
    assert policy_sources_dir().is_dir()


def test_citations_from_retrieval_maps_program_layer() -> None:
    result = RetrievalResult(
        docs=["ECOA adverse action notice requirements apply."],
        metadata=[
            {
                "source": "12 CFR Part 202 (up to date as of 9-10-2026).pdf",
                "page": 3,
                "score": 0.91,
                "program": "compliance_floor",
            }
        ],
        strategy="vector",
        total=1,
    )
    citations = citations_from_retrieval(result)
    assert len(citations) == 1
    assert citations[0].source.authority == "regulatory"
    assert citations[0].source.url and citations[0].source.url.startswith("https://")
    assert citations[0].source.title == "12 CFR Part 202 (Regulation B)"
    assert citations[0].program == PolicyLayer.COMPLIANCE_FLOOR
    assert citations[0].similarity_score == 0.91
    assert "ECOA" in citations[0].retrieved_text


def test_catalog_covers_known_policy_files() -> None:
    by_file = {entry.file: entry for entry in load_catalog()}
    assert "SOP 50 10 8.1 effective 10.1.2026_0.docx" in by_file
    assert by_file["cdfi_direct_accion_criteria.md"].url is None
    nested = lookup_source(
        "data/policy_sources/12 CFR Part 202 (up to date as of 9-10-2026).pdf"
    )
    assert nested is not None
    assert nested.program == PolicyLayer.COMPLIANCE_FLOOR


def test_ingest_metadata_stamps_catalog_url() -> None:
    meta = _base_metadata(
        Path("12 CFR Part 202 (up to date as of 9-10-2026).pdf"),
        page=3,
        program=PolicyLayer.COMPLIANCE_FLOOR,
    )
    assert meta["url"].startswith("https://www.ecfr.gov/")
    assert meta["title"] == "12 CFR Part 202 (Regulation B)"
    assert meta["authority"] == "regulatory"


def test_citations_from_retrieval_prefers_metadata_url() -> None:
    result = RetrievalResult(
        docs=["SBSS minimum score is 165."],
        metadata=[
            {
                "source": "custom.pdf",
                "page": 1,
                "score": 0.8,
                "program": "sba_7a",
                "url": "https://example.com/custom-policy",
                "title": "Custom SOP",
            }
        ],
        strategy="vector",
        total=1,
    )
    citations = citations_from_retrieval(result)
    assert citations[0].source.url == "https://example.com/custom-policy"
    assert citations[0].source.title == "Custom SOP"


def test_resolve_program_layers() -> None:
    assert (
        resolve_program("12 CFR Part 202 (up to date as of 9-10-2026).pdf")
        == PolicyLayer.COMPLIANCE_FLOOR
    )
    assert resolve_program("cdfi_direct_accion_criteria.md") == PolicyLayer.CDFI_DIRECT
    assert (
        resolve_program(
            "SOP 50 10 8.1 effective 10.1.2026_0.docx",
            "See 13 CFR 120.110 ineligible business types.",
        )
        == PolicyLayer.ELIGIBILITY_GATE
    )
    assert (
        resolve_program(
            "SOP 50 10 8.1 effective 10.1.2026_0.docx",
            "FICO SBSS minimum score for 7(a) guaranty.",
        )
        == PolicyLayer.SBA_7A
    )


def test_policy_index_name() -> None:
    assert POLICY_INDEX.startswith("underwriting_policy")


def test_build_policy_rag_config_uses_deepseek() -> None:
    from config import Settings, get_settings
    from policy_rag import build_policy_rag_config

    get_settings.cache_clear()
    try:
        with patch(
            "policy_rag.get_settings",
            return_value=Settings(
                deepseek_api_key="sk-test",
                deepseek_base_url="https://api.deepseek.com",
                rag_llm_model="deepseek-chat",
            ),
        ):
            cfg = build_policy_rag_config(top_k=3)
        assert cfg.llm_model == "deepseek-chat"
        assert cfg.llm_base_url == "https://api.deepseek.com"
        assert cfg.llm_api_key == "sk-test"
        assert cfg.top_k == 3
        assert cfg.rerank is False
    finally:
        get_settings.cache_clear()
