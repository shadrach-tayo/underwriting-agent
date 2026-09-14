"""Unit tests for the RagPipeline adapter (no Postgres / Voyage required)."""

from __future__ import annotations

from rag.pipeline import RetrievalResult

from underwriting_agent.models import PolicyLayer
from underwriting_agent.rag import POLICY_INDEX, citations_from_retrieval, policy_sources_dir
from underwriting_agent.rag.tags import resolve_program


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
    assert citations[0].program == PolicyLayer.COMPLIANCE_FLOOR
    assert citations[0].similarity_score == 0.91
    assert "ECOA" in citations[0].retrieved_text


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
