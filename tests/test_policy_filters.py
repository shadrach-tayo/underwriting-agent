"""Post-retrieve policy filter unit tests."""

from __future__ import annotations

from datetime import datetime, timezone

from models import Citation, PolicyLayer, PolicySource
from policy_rag.filters import (
    citation_in_scope,
    ensure_pdf_citations,
    ensure_regulatory_citations,
    filter_citations,
    is_pdf_citation,
)


def _cite(
    *,
    clause_id: str,
    program: PolicyLayer,
    lender_id: str | None = None,
    authority: str = "sba",
) -> Citation:
    return Citation(
        clause_id=clause_id,
        source=PolicySource(
            source_id=clause_id,
            name=f"{clause_id}.md",
            authority=authority,  # type: ignore[arg-type]
            version="1",
            effective_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
            program=program,
            lender_id=lender_id,
        ),
        retrieved_text=clause_id,
        similarity_score=0.8,
        program=program,
    )


def test_generic_mode_excludes_lender_chunks() -> None:
    shared = _cite(clause_id="sop", program=PolicyLayer.SBA_7A)
    accion = _cite(
        clause_id="accion",
        program=PolicyLayer.CDFI_DIRECT,
        lender_id="accion",
        authority="lender",
    )
    scoped = filter_citations([shared, accion], lender_id=None)
    assert [c.clause_id for c in scoped] == ["sop"]


def test_accion_mode_includes_accion_and_shared() -> None:
    shared = _cite(clause_id="regb", program=PolicyLayer.COMPLIANCE_FLOOR, authority="regulatory")
    accion = _cite(
        clause_id="accion",
        program=PolicyLayer.CDFI_DIRECT,
        lender_id="accion",
        authority="lender",
    )
    other = _cite(
        clause_id="other",
        program=PolicyLayer.CDFI_DIRECT,
        lender_id="other_lender",
        authority="lender",
    )
    scoped = filter_citations([shared, accion, other], lender_id="accion")
    assert {c.clause_id for c in scoped} == {"regb", "accion"}


def test_product_filter_keeps_shared_layers() -> None:
    floor = _cite(
        clause_id="floor",
        program=PolicyLayer.COMPLIANCE_FLOOR,
        authority="regulatory",
    )
    sba = _cite(clause_id="sba", program=PolicyLayer.SBA_7A)
    cdfi = _cite(clause_id="cdfi", program=PolicyLayer.CDFI_DIRECT)
    scoped = filter_citations(
        [floor, sba, cdfi],
        program="sba_7a",
        include_shared_layers=True,
    )
    assert {c.clause_id for c in scoped} == {"floor", "sba"}


def test_exact_program_excludes_shared() -> None:
    floor = _cite(
        clause_id="floor",
        program=PolicyLayer.COMPLIANCE_FLOOR,
        authority="regulatory",
    )
    sba = _cite(clause_id="sba", program=PolicyLayer.SBA_7A)
    assert citation_in_scope(
        sba, program="sba_7a", include_shared_layers=False
    )
    assert not citation_in_scope(
        floor, program="sba_7a", include_shared_layers=False
    )


def test_ensure_regulatory_prepends_when_missing() -> None:
    sba = _cite(clause_id="sba", program=PolicyLayer.SBA_7A)
    floor = _cite(
        clause_id="floor",
        program=PolicyLayer.COMPLIANCE_FLOOR,
        authority="regulatory",
    )
    merged = ensure_regulatory_citations([sba], [sba, floor])
    assert merged[0].clause_id == "floor"
    assert merged[1].clause_id == "sba"


def test_ensure_pdf_citations_prepends_when_primary_is_docx() -> None:
    sop = _cite(clause_id="sop.docx:p12", program=PolicyLayer.ELIGIBILITY_GATE)
    sop.source.name = "SOP 50 10 8.1 effective 10.1.2026_0.docx"
    pdf = _cite(
        clause_id="reg.pdf:p3",
        program=PolicyLayer.COMPLIANCE_FLOOR,
        authority="regulatory",
    )
    pdf.source.name = "12 CFR Part 202 (up to date as of 9-10-2026).pdf"
    assert not is_pdf_citation(sop)
    assert is_pdf_citation(pdf)
    merged = ensure_pdf_citations([sop], [sop, pdf])
    assert merged[0].source.name.endswith(".pdf")
    assert merged[1].clause_id == "sop.docx:p12"
