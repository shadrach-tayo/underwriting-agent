"""Policy layer tags for chunk metadata (``program`` field)."""

from __future__ import annotations

import re

from models import PolicyLayer
from policy_rag.catalog import lookup_source, program_for_file

# SBA SOP passages that encode the shared categorical eligibility gate.
# Only applied to *generic* SBA SOP sources — not lender overlays.
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
    entry = lookup_source(source_name)
    default = entry.program if entry is not None else program_for_file(source_name)
    if default is None:
        lower = source_name.lower()
        if "cfr" in lower or "regulation b" in lower or "ecoa" in lower or "ncua" in lower:
            default = PolicyLayer.COMPLIANCE_FLOOR
        elif "accion" in lower and "sba" in lower:
            default = PolicyLayer.SBA_7A
        elif "cdfi" in lower:
            default = PolicyLayer.CDFI_DIRECT
        elif "sop" in lower or "sba" in lower:
            default = PolicyLayer.SBA_7A
        else:
            default = PolicyLayer.CDFI_DIRECT

    # Lender overlays keep their product program tag (do not promote to shared gate).
    if entry is not None and entry.lender_id:
        return default

    if default == PolicyLayer.SBA_7A and text and _looks_like_eligibility_gate(text):
        return PolicyLayer.ELIGIBILITY_GATE
    return default


def _looks_like_eligibility_gate(text: str) -> bool:
    return any(p.search(text) for p in _ELIGIBILITY_GATE_PATTERNS)
