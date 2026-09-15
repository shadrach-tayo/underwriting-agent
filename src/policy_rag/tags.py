"""Policy layer tags for chunk metadata (``program`` field)."""

from __future__ import annotations

import re

from models import PolicyLayer

# Filename → default layer when content heuristics do not override.
SOURCE_PROGRAM: dict[str, PolicyLayer] = {
    "12 CFR Part 202 (up to date as of 9-10-2026).pdf": PolicyLayer.COMPLIANCE_FLOOR,
    "Equal Credit Opportunity Act (Regulation B) _ NCUA.pdf": PolicyLayer.COMPLIANCE_FLOOR,
    "SOP 50 10 8.1 effective 10.1.2026_0.docx": PolicyLayer.SBA_7A,
    "cdfi_direct_accion_criteria.md": PolicyLayer.CDFI_DIRECT,
}

# SBA SOP passages that encode the shared categorical eligibility gate.
_ELIGIBILITY_GATE_PATTERNS = (
    re.compile(r"13\s*CFR\s*120\.(100|110)", re.I),
    re.compile(r"ineligible\s+business", re.I),
    re.compile(r"operating\s+business", re.I),
    re.compile(r"eligibility\s+requirements", re.I),
    re.compile(r"who\s*is\s+eligible", re.I),
    re.compile(r"citizenship", re.I),
)


def resolve_program(source_name: str, text: str = "") -> PolicyLayer:
    """Map a source (+ optional body text) to its policy layer tag."""
    default = SOURCE_PROGRAM.get(source_name)
    if default is None:
        lower = source_name.lower()
        if "cfr" in lower or "regulation b" in lower or "ecoa" in lower or "ncua" in lower:
            default = PolicyLayer.COMPLIANCE_FLOOR
        elif "accion" in lower or "cdfi" in lower:
            default = PolicyLayer.CDFI_DIRECT
        elif "sop" in lower or "sba" in lower:
            default = PolicyLayer.SBA_7A
        else:
            default = PolicyLayer.CDFI_DIRECT

    if default == PolicyLayer.SBA_7A and text and _looks_like_eligibility_gate(text):
        return PolicyLayer.ELIGIBILITY_GATE
    return default


def _looks_like_eligibility_gate(text: str) -> bool:
    return any(p.search(text) for p in _ELIGIBILITY_GATE_PATTERNS)
