"""Filename → origin catalog for policy documents used in the RAG pipeline.

``data/policy_sources/catalog.json`` is the source of truth for display title,
download/origin URL, authority, default program layer, and optional lender
overlay (``lender_id``). Edit URLs there; ingest stamps them onto chunk
metadata and citation mapping falls back to this file when older index rows
omit ``url`` / ``lender_id``.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

from models import PolicyLayer

Authority = Literal["regulatory", "sba", "lender"]

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = _REPO_ROOT / "data" / "policy_sources" / "catalog.json"

_AUTHORITIES = {"regulatory", "sba", "lender"}


@dataclass(frozen=True)
class SourceCatalogEntry:
    file: str
    title: str
    url: str | None
    authority: Authority
    program: PolicyLayer
    lender_id: str | None = None
    version: str | None = None
    effective_date: str | None = None
    notes: str | None = None


def catalog_path() -> Path:
    return CATALOG_PATH


@lru_cache(maxsize=1)
def load_catalog() -> tuple[SourceCatalogEntry, ...]:
    path = CATALOG_PATH
    if not path.is_file():
        logger.warning("Policy source catalog missing: %s", path)
        return ()
    payload = json.loads(path.read_text(encoding="utf-8"))
    raw_sources = payload.get("sources") if isinstance(payload, dict) else None
    if not isinstance(raw_sources, list):
        raise ValueError(f"Catalog {path} must contain a top-level 'sources' array")
    entries: list[SourceCatalogEntry] = []
    seen: set[str] = set()
    for raw in raw_sources:
        if not isinstance(raw, dict):
            raise ValueError(f"Catalog {path} entries must be objects")
        entry = _parse_entry(raw, path)
        if entry.file in seen:
            raise ValueError(f"Duplicate catalog file {entry.file!r} in {path}")
        seen.add(entry.file)
        entries.append(entry)
    return tuple(entries)


def lookup_source(filename: str) -> SourceCatalogEntry | None:
    """Return the catalog row for a local filename, if any."""
    if not filename:
        return None
    return _by_file().get(filename) or _by_file().get(Path(filename).name)


def resolve_catalog_file(filename: str) -> Path | None:
    """Return the on-disk policy file if it is catalogued and present."""
    name = Path(filename).name
    if lookup_source(name) is None:
        return None
    root = CATALOG_PATH.parent.resolve()
    path = (root / name).resolve()
    try:
        path.relative_to(root)
    except ValueError:
        return None
    if not path.is_file():
        return None
    return path


def program_for_file(filename: str) -> PolicyLayer | None:
    entry = lookup_source(filename)
    return None if entry is None else entry.program


def _by_file() -> dict[str, SourceCatalogEntry]:
    return {entry.file: entry for entry in load_catalog()}


def _parse_entry(raw: dict[str, object], path: Path) -> SourceCatalogEntry:
    file = _required_str(raw, "file", path)
    title = _required_str(raw, "title", path)
    authority_raw = _required_str(raw, "authority", path)
    if authority_raw not in _AUTHORITIES:
        raise ValueError(f"Catalog {path} has unknown authority {authority_raw!r} for {file}")
    program_raw = _required_str(raw, "program", path)
    try:
        program = PolicyLayer(program_raw)
    except ValueError as exc:
        raise ValueError(f"Catalog {path} has unknown program {program_raw!r} for {file}") from exc
    return SourceCatalogEntry(
        file=file,
        title=title,
        url=_normalize_url(raw.get("url")),
        authority=authority_raw,  # type: ignore[arg-type]
        program=program,
        lender_id=_optional_str(raw.get("lender_id")),
        version=_optional_str(raw.get("version")),
        effective_date=_optional_str(raw.get("effective_date")),
        notes=_optional_str(raw.get("notes")),
    )


def _required_str(raw: dict[str, object], key: str, path: Path) -> str:
    value = raw.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Catalog {path} entry missing {key!r}")
    return value.strip()


def _optional_str(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _normalize_url(value: object) -> str | None:
    url = _optional_str(value)
    if url is None:
        return None
    if url.startswith(("http://", "https://")):
        return url
    logger.warning("Ignoring non-http catalog url: %s", url)
    return None
