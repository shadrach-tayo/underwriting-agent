"""Runtime lender registry — offer matrix for program × lender routing.

Loads ``data/lenders/registry.json`` (refreshed at ingest from lender policy
front matter). Falls back to built-in stubs if the registry is missing.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from models import LoanProgram
from agents.lender_config import load_lender_config, load_registry

LENDER_ACCION = "accion"
LENDER_FRONTIER_7A = "frontier_7a"

_FALLBACK = (
    {
        "id": LENDER_ACCION,
        "display_name": "Accion Opportunity Fund",
        "offered_programs": ["sba_7a"],
    },
    {
        "id": LENDER_FRONTIER_7A,
        "display_name": "Frontier 7(a)",
        "offered_programs": ["sba_7a"],
    },
)


@dataclass(frozen=True)
class LenderProfile:
    """Which products a lender originates (and optional display metadata)."""

    id: str
    display_name: str
    offered_programs: frozenset[LoanProgram]


def _programs_from_raw(raw: object) -> frozenset[LoanProgram]:
    programs: set[LoanProgram] = set()
    if not isinstance(raw, list):
        return frozenset()
    for item in raw:
        try:
            programs.add(LoanProgram(str(item)))
        except ValueError:
            continue
    return frozenset(programs)


@lru_cache(maxsize=1)
def _profiles() -> dict[str, LenderProfile]:
    payload = load_registry()
    rows = payload.get("lenders") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or not rows:
        rows = list(_FALLBACK)
    out: dict[str, LenderProfile] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        lender_id = str(row.get("id") or "").strip()
        if not lender_id:
            continue
        out[lender_id] = LenderProfile(
            id=lender_id,
            display_name=str(row.get("display_name") or lender_id),
            offered_programs=_programs_from_raw(row.get("offered_programs")),
        )
    return out


def reload_lenders() -> None:
    """Clear cached profiles (call after ingest refreshes the registry)."""
    _profiles.cache_clear()


def list_lenders() -> tuple[LenderProfile, ...]:
    return tuple(_profiles()[k] for k in sorted(_profiles()))


def get_lender(lender_id: str | None) -> LenderProfile | None:
    if not lender_id:
        return None
    return _profiles().get(lender_id)


def known_lender_ids() -> frozenset[str]:
    return frozenset(_profiles())


# Imported by HTTP validation; refreshed via reload_lenders() + re-import not required
# because rag.py should call known_lender_ids() — keep a stable set for Literal defaults.
KNOWN_LENDER_IDS = frozenset({LENDER_ACCION, LENDER_FRONTIER_7A})


def is_known_lender(lender_id: str | None) -> bool:
    return bool(lender_id) and lender_id in _profiles()


def lender_offers(lender_id: str | None, program: LoanProgram | None) -> bool:
    """True when lender originates ``program``. Unknown lender → False."""
    if program is None:
        return False
    profile = get_lender(lender_id)
    if profile is None:
        return False
    return program in profile.offered_programs


def format_lender_label(lender_id: str | None) -> str:
    if not lender_id:
        return "—"
    profile = get_lender(lender_id)
    return profile.display_name if profile else lender_id


def lender_rule_overlay(lender_id: str | None) -> dict[str, object]:
    """Structured overlays from ``data/lenders/{id}.json`` (ingest-extracted)."""
    if not lender_id:
        return {}
    cfg = load_lender_config(lender_id)
    if cfg is None:
        return {}
    return {
        "loan_amount_min": cfg.rules.loan_amount_min,
        "loan_amount_max": cfg.rules.loan_amount_max,
        "requires_us_citizen": cfg.rules.requires_us_citizen,
        "excluded_states": list(cfg.rules.excluded_states),
    }
