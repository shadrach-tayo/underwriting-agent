"""Post-retrieve filters for policy layer + optional lender overlay."""

from __future__ import annotations

from models import Citation, PolicyLayer

# Shared layers that remain in scope when filtering to a product program.
_SHARED_LAYERS = frozenset(
    {
        PolicyLayer.COMPLIANCE_FLOOR,
        PolicyLayer.ELIGIBILITY_GATE,
    }
)


def citation_lender_id(cite: Citation) -> str | None:
    return cite.source.lender_id


def lender_in_scope(cite: Citation, *, lender_id: str | None) -> bool:
    """Generic mode: only shared chunks (no lender_id). Lender mode: match ∪ shared."""
    chunk_lender = citation_lender_id(cite)
    if lender_id is None:
        return chunk_lender is None
    return chunk_lender is None or chunk_lender == lender_id


def program_in_scope(
    cite: Citation,
    *,
    program: str | None,
    include_shared_layers: bool = True,
) -> bool:
    """When ``program`` is set, keep matching layer and optionally shared gates."""
    if program is None:
        return True
    if cite.program.value == program:
        return True
    if include_shared_layers and cite.program in _SHARED_LAYERS:
        return True
    return False


def citation_in_scope(
    cite: Citation,
    *,
    program: str | None = None,
    lender_id: str | None = None,
    include_shared_layers: bool = True,
) -> bool:
    return lender_in_scope(cite, lender_id=lender_id) and program_in_scope(
        cite,
        program=program,
        include_shared_layers=include_shared_layers,
    )


def filter_citations(
    citations: list[Citation],
    *,
    program: str | None = None,
    lender_id: str | None = None,
    include_shared_layers: bool = True,
) -> list[Citation]:
    return [
        c
        for c in citations
        if citation_in_scope(
            c,
            program=program,
            lender_id=lender_id,
            include_shared_layers=include_shared_layers,
        )
    ]


def is_regulatory_citation(cite: Citation) -> bool:
    return (
        cite.program == PolicyLayer.COMPLIANCE_FLOOR
        or cite.source.authority == "regulatory"
    )


def ensure_regulatory_citations(
    primary: list[Citation],
    pool: list[Citation],
    *,
    max_extra: int = 2,
) -> list[Citation]:
    """If primary has no regulatory evidence, prepend from ``pool`` (or primary)."""
    if any(is_regulatory_citation(c) for c in primary):
        return primary
    extras = _take_matching(primary, pool, is_regulatory_citation, max_extra=max_extra)
    return extras + primary if extras else primary


def is_pdf_citation(cite: Citation) -> bool:
    """True when the cited catalog file is a PDF the viewer can render."""
    for value in (cite.source.name, cite.source.source_id, cite.clause_id):
        stem = str(value or "").split(":", 1)[0].rsplit("/", 1)[-1].lower()
        if stem.endswith(".pdf"):
            return True
    return False


def ensure_pdf_citations(
    primary: list[Citation],
    pool: list[Citation],
    *,
    max_extra: int = 2,
) -> list[Citation]:
    """If primary is SOP/DOCX-only, prepend PDF pages from ``pool``."""
    if any(is_pdf_citation(c) for c in primary):
        return primary
    extras = _take_matching(primary, pool, is_pdf_citation, max_extra=max_extra)
    return extras + primary if extras else primary


def _take_matching(
    primary: list[Citation],
    pool: list[Citation],
    predicate,
    *,
    max_extra: int,
) -> list[Citation]:
    seen = {c.clause_id for c in primary}
    extras: list[Citation] = []
    for cite in pool:
        if cite.clause_id in seen or not predicate(cite):
            continue
        extras.append(cite)
        seen.add(cite.clause_id)
        if len(extras) >= max_extra:
            break
    return extras
