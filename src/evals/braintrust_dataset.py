"""Sync local gold set → versioned Braintrust dataset.

See: https://www.braintrust.dev/docs/annotate/datasets
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from evals.gold_set import GOLD_SET_PATH, GoldCase, load_gold_cases
from evals.tracing import project_name

logger = logging.getLogger(__name__)

DEFAULT_DATASET_NAME = "underwriting-gold-set"


def dataset_name() -> str:
    return (os.getenv("BRAINTRUST_DATASET") or DEFAULT_DATASET_NAME).strip()


def braintrust_api_configured() -> bool:
    """True when an API key is present (dataset sync does not require tracing opt-in)."""
    return bool((os.getenv("BRAINTRUST_API_KEY") or "").strip())


def gold_case_to_record(case: GoldCase) -> dict[str, Any]:
    """Map a gold case to Braintrust dataset fields (input / expected / metadata / tags)."""
    tags = list(case.label.calibration_tags)
    tags.append(f"outcome:{case.label.outcome.value}")
    if case.label.recommended_program:
        tags.append(f"program:{case.label.recommended_program}")
    for layer in case.label.policy_refs:
        tags.append(f"policy:{layer}")

    return {
        # Stable id → re-sync upserts / dedupes the same case across versions.
        "id": case.case_id,
        "input": {
            "case_id": case.case_id,
            "applicant": case.applicant.model_dump(mode="json"),
        },
        "expected": case.label.model_dump(mode="json"),
        "metadata": {
            "case_id": case.case_id,
            "outcome": case.label.outcome.value,
            "risk_tier": case.label.risk_tier.value,
            "eligible_programs": list(case.label.eligible_programs),
            "recommended_program": case.label.recommended_program,
            "compliance_floor_pass": case.label.compliance_floor_pass,
            "eligibility_gate_pass": case.label.eligibility_gate_pass,
            "source": "data/gold_set/applicants.jsonl",
            **(case.metadata or {}),
        },
        "tags": tags,
    }


def sync_gold_dataset(
    *,
    gold_path: Path | None = None,
    project: str | None = None,
    name: str | None = None,
    limit: int | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Create/update the Braintrust gold dataset from local JSONL and flush.

    Records use stable ``id=case_id`` so re-runs version the dataset without
    duplicating cases (Braintrust dedupes on id).
    """
    cases = load_gold_cases(gold_path or GOLD_SET_PATH)
    if limit is not None:
        cases = cases[:limit]
    records = [gold_case_to_record(c) for c in cases]
    summary = {
        "project": project or project_name(),
        "dataset": name or dataset_name(),
        "n_records": len(records),
        "case_ids": [r["id"] for r in records],
        "dry_run": dry_run,
    }
    if dry_run:
        return summary

    if not braintrust_api_configured():
        raise RuntimeError(
            "BRAINTRUST_API_KEY is required to sync the gold dataset. "
            "See https://www.braintrust.dev/docs/annotate/datasets"
        )

    from braintrust import init_dataset

    ds = init_dataset(
        project=summary["project"],
        name=summary["dataset"],
        description=(
            "SME underwriting gold set (SBCS-calibrated). "
            "Synced from data/gold_set/applicants.jsonl via underwriting-evals --sync-dataset."
        ),
    )
    for record in records:
        ds.insert(
            id=record["id"],
            input=record["input"],
            expected=record["expected"],
            metadata=record["metadata"],
            tags=record["tags"],
        )
    ds.flush()
    summary["flushed"] = True
    logger.info(
        "Synced %s cases → Braintrust dataset %s/%s",
        len(records),
        summary["project"],
        summary["dataset"],
    )
    return summary


def load_braintrust_dataset(
    *,
    project: str | None = None,
    name: str | None = None,
) -> Any:
    """Return an ``init_dataset`` handle for use as ``Eval(..., data=...)``."""
    if not braintrust_api_configured():
        raise RuntimeError("BRAINTRUST_API_KEY is required to load a Braintrust dataset")
    from braintrust import init_dataset

    return init_dataset(project=project or project_name(), name=name or dataset_name())
