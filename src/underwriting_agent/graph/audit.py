"""Append-only hash-chained audit helpers."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from underwriting_agent.models import AuditEntry


def _canonical(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))


def make_audit_entry(
    *,
    case_id: str,
    event: str,
    payload: dict[str, Any],
    prev_hash: str | None,
) -> AuditEntry:
    material = _canonical(
        {
            "case_id": case_id,
            "event": event,
            "payload": payload,
            "prev_hash": prev_hash,
        }
    )
    entry_hash = hashlib.sha256(material.encode("utf-8")).hexdigest()
    return AuditEntry(
        case_id=case_id,
        event=event,
        payload=payload,
        prev_hash=prev_hash,
        entry_hash=entry_hash,
    )


def last_audit_hash(trail: list[AuditEntry] | None) -> str | None:
    if not trail:
        return None
    return trail[-1].entry_hash
