"""Lender config artifacts extracted / maintained beside the policy corpus.

``data/lenders/registry.json`` is the runtime offer-matrix source of truth
(loaded by ``agents.lenders``). Per-lender JSON files are written at ingest
from structured front-matter in lender policy docs and can later move to a
DB table without changing the routing interface.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[2]
LENDERS_DIR = _REPO_ROOT / "data" / "lenders"
REGISTRY_PATH = LENDERS_DIR / "registry.json"

_FRONT_MATTER_KEYS = {
    "lender_id",
    "lender_name",
    "program_id",
    "program_name",
    "source_type",
    "source_url",
    "last_verified",
    "document_version",
}


@dataclass
class LenderRules:
    """Optional numeric / boolean overlays parsed from lender policy text."""

    loan_amount_min: float | None = None
    loan_amount_max: float | None = None
    requires_us_citizen: bool | None = None
    excluded_states: list[str] = field(default_factory=list)


@dataclass
class LenderConfig:
    id: str
    display_name: str
    offered_programs: list[str]
    source_files: list[str] = field(default_factory=list)
    source_url: str | None = None
    document_version: str | None = None
    last_verified: str | None = None
    rules: LenderRules = field(default_factory=LenderRules)
    updated_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def lenders_dir() -> Path:
    return LENDERS_DIR


def registry_path() -> Path:
    return REGISTRY_PATH


def load_registry() -> dict[str, Any]:
    if not REGISTRY_PATH.is_file():
        return {"lenders": []}
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def load_lender_config(lender_id: str) -> LenderConfig | None:
    path = LENDERS_DIR / f"{lender_id}.json"
    if not path.is_file():
        return None
    raw = json.loads(path.read_text(encoding="utf-8"))
    rules_raw = raw.get("rules") or {}
    return LenderConfig(
        id=str(raw["id"]),
        display_name=str(raw.get("display_name") or raw["id"]),
        offered_programs=list(raw.get("offered_programs") or []),
        source_files=list(raw.get("source_files") or []),
        source_url=raw.get("source_url"),
        document_version=raw.get("document_version"),
        last_verified=raw.get("last_verified"),
        rules=LenderRules(
            loan_amount_min=_as_float(rules_raw.get("loan_amount_min")),
            loan_amount_max=_as_float(rules_raw.get("loan_amount_max")),
            requires_us_citizen=_as_bool(rules_raw.get("requires_us_citizen")),
            excluded_states=list(rules_raw.get("excluded_states") or []),
        ),
        updated_at=raw.get("updated_at"),
    )


def parse_front_matter_table(text: str) -> dict[str, str]:
    """Parse ``|key|value|`` rows from lender policy front matter."""
    found: dict[str, str] = {}
    for match in re.finditer(
        r"^\|\s*([a-z_]+)\s*\|\s*(.+?)\s*\|\s*$",
        text,
        flags=re.I | re.M,
    ):
        key = match.group(1).strip().lower()
        value = match.group(2).strip()
        if key in {"---", "key"} or key not in _FRONT_MATTER_KEYS:
            continue
        link = re.match(r"\[([^\]]*)\]\(([^)]+)\)", value)
        if link:
            value = link.group(2).strip() or link.group(1).strip()
        found[key] = value.rstrip("|").strip()
    return found


_US_STATES = {
    "alabama",
    "alaska",
    "arizona",
    "arkansas",
    "california",
    "colorado",
    "connecticut",
    "delaware",
    "florida",
    "georgia",
    "hawaii",
    "idaho",
    "illinois",
    "indiana",
    "iowa",
    "kansas",
    "kentucky",
    "louisiana",
    "maine",
    "maryland",
    "massachusetts",
    "michigan",
    "minnesota",
    "mississippi",
    "missouri",
    "montana",
    "nebraska",
    "nevada",
    "new hampshire",
    "new jersey",
    "new mexico",
    "new york",
    "north carolina",
    "north dakota",
    "ohio",
    "oklahoma",
    "oregon",
    "pennsylvania",
    "rhode island",
    "south carolina",
    "south dakota",
    "tennessee",
    "texas",
    "utah",
    "vermont",
    "virginia",
    "washington",
    "west virginia",
    "wisconsin",
    "wyoming",
    "district of columbia",
}


def extract_rules_from_text(text: str) -> LenderRules:
    """Best-effort numeric / flag extraction from Accion-style rule prose."""
    rules = LenderRules()
    amount = re.search(
        r"Loan amount range:\s*\$?\s*([\d,]+)\s*to\s*\$?\s*([\d,]+)",
        text,
        flags=re.I,
    )
    if amount:
        rules.loan_amount_min = float(amount.group(1).replace(",", ""))
        rules.loan_amount_max = float(amount.group(2).replace(",", ""))

    if re.search(r"must be a U\.?S\.?\s+citizen", text, flags=re.I):
        rules.requires_us_citizen = True

    # Prefer a full multi-page join; match known state names only.
    found_states: list[str] = []
    for match in re.finditer(
        r"\b("
        + "|".join(re.escape(s) for s in sorted(_US_STATES, key=len, reverse=True))
        + r")\b",
        text,
        flags=re.I,
    ):
        # Only collect states near an exclusion clause.
        start = max(0, match.start() - 80)
        window = text[start : match.end() + 20]
        if re.search(r"NOT be located|ineligible|excluded", window, flags=re.I):
            title = match.group(1).title()
            if title == "District Of Columbia":
                title = "District of Columbia"
            if title not in found_states:
                found_states.append(title)
    if found_states:
        rules.excluded_states = found_states

    return rules


def upsert_lender_config_from_text(
    *,
    text: str,
    source_file: str,
    catalog_lender_id: str | None = None,
    catalog_program: str | None = None,
    catalog_url: str | None = None,
) -> LenderConfig | None:
    """Parse lender front matter + rules and write ``data/lenders/{id}.json``."""
    meta = parse_front_matter_table(text)
    lender_id = meta.get("lender_id") or catalog_lender_id
    if not lender_id:
        return None

    program_id = meta.get("program_id") or catalog_program
    rules = extract_rules_from_text(text)
    existing = load_lender_config(lender_id)
    programs = list(existing.offered_programs) if existing else []
    if program_id and program_id not in programs:
        programs.append(program_id)
    if not programs and catalog_program:
        programs = [catalog_program]

    source_files = list(existing.source_files) if existing else []
    if source_file not in source_files:
        source_files.append(source_file)

    if existing is not None:
        if rules.loan_amount_min is None:
            rules.loan_amount_min = existing.rules.loan_amount_min
        if rules.loan_amount_max is None:
            rules.loan_amount_max = existing.rules.loan_amount_max
        if rules.requires_us_citizen is None:
            rules.requires_us_citizen = existing.rules.requires_us_citizen
        if not rules.excluded_states:
            rules.excluded_states = list(existing.rules.excluded_states)

    config = LenderConfig(
        id=lender_id,
        display_name=meta.get("lender_name")
        or (existing.display_name if existing else lender_id),
        offered_programs=sorted(programs),
        source_files=source_files,
        source_url=meta.get("source_url")
        or catalog_url
        or (existing.source_url if existing else None),
        document_version=meta.get("document_version")
        or (existing.document_version if existing else None),
        last_verified=meta.get("last_verified")
        or (existing.last_verified if existing else None),
        rules=rules,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    _write_lender_config(config)
    _sync_registry_entry(config)
    return config


def _write_lender_config(config: LenderConfig) -> None:
    LENDERS_DIR.mkdir(parents=True, exist_ok=True)
    path = LENDERS_DIR / f"{config.id}.json"
    path.write_text(
        json.dumps(config.to_dict(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    logger.info("Wrote lender config %s", path)


def _sync_registry_entry(config: LenderConfig) -> None:
    LENDERS_DIR.mkdir(parents=True, exist_ok=True)
    payload = load_registry()
    lenders = list(payload.get("lenders") or [])
    entry = {
        "id": config.id,
        "display_name": config.display_name,
        "offered_programs": list(config.offered_programs),
        "config_file": f"{config.id}.json",
    }
    replaced = False
    for i, row in enumerate(lenders):
        if isinstance(row, dict) and row.get("id") == config.id:
            lenders[i] = entry
            replaced = True
            break
    if not replaced:
        lenders.append(entry)
    # Keep stub lenders that have no extracted config yet.
    known_ids = {e["id"] for e in lenders if isinstance(e, dict)}
    for stub in _STUB_LENDERS:
        if stub["id"] not in known_ids:
            lenders.append(stub)
    payload["lenders"] = lenders
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    REGISTRY_PATH.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


_STUB_LENDERS = (
    {
        "id": "frontier_7a",
        "display_name": "Frontier 7(a)",
        "offered_programs": ["sba_7a"],
        "config_file": None,
    },
)


def _as_float(value: object) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _as_bool(value: object) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lower = value.strip().lower()
        if lower in {"true", "yes", "1"}:
            return True
        if lower in {"false", "no", "0"}:
            return False
    return None
