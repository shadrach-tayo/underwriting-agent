"""Thin adapter around the shared RagPipeline (ai-engineering-boilerplate @ eval)."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from rag.pipeline import RagConfig, RagPipeline, RetrievalResult

from config import get_settings
from models import Citation, PolicyLayer, PolicySource

Authority = Literal["regulatory", "sba", "lender"]

__all__ = [
    "POLICY_INDEX",
    "RagConfig",
    "RagPipeline",
    "RetrievalResult",
    "build_policy_rag_config",
    "citations_from_retrieval",
    "get_policy_pipeline",
    "policy_sources_dir",
]

# Kept for backward-compatible imports; prefer Settings.rag_index_name.
POLICY_INDEX = "underwriting_policy_chunk_512"
_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_EFFECTIVE = datetime(2026, 1, 1, tzinfo=timezone.utc)

_LAYER_SYSTEM_PROMPT = """\
You are an underwriting policy assistant for a dual-program CDFI lender.

Policy is layered — never flatten into one scored rule set:
1. compliance_floor (ECOA/Reg B): boolean gate on every decision; never a credit score factor.
2. eligibility_gate (SBA core eligibility, 13 CFR 120.100/120.110): hard categorical yes/no before scoring.
3. Program underwriting: evaluate against sba_7a and/or cdfi_direct as separate products.

When clauses conflict across layers or programs, say so explicitly and route by layer \
(compliance → eligibility → program), then by which program(s) the applicant fits. \
Prefer recommending an alternate eligible program over a flat deny when only one track fails.
"""


def policy_sources_dir() -> Path:
    return _REPO_ROOT / "data" / "policy_sources"


def get_policy_pipeline(
    *,
    index_name: str | None = None,
    strategy: str | None = None,
    top_k: int | None = None,
) -> RagPipeline:
    """Configured pipeline for underwriting policy retrieval (settings-backed).

    Generation uses DeepSeek via the OpenAI-compatible ChatOpenAI client
    (``llm_model`` / ``llm_base_url`` / ``llm_api_key`` on ``RagConfig``).
    """
    return RagPipeline(build_policy_rag_config(
        index_name=index_name,
        strategy=strategy,
        top_k=top_k,
    ))


def build_policy_rag_config(
    *,
    index_name: str | None = None,
    strategy: str | None = None,
    top_k: int | None = None,
) -> RagConfig:
    """Build the shared ``RagConfig`` used by ingest, search, and agent answer."""
    settings = get_settings()
    return RagConfig(
        index_name=index_name or settings.rag_index_name,
        chunk_size=settings.rag_chunk_size,
        chunk_overlap=settings.rag_chunk_overlap,
        embedding_dim=settings.rag_embedding_dim,
        embedding_model=settings.rag_embedding_model,
        strategy=(strategy or settings.rag_strategy),  # type: ignore[arg-type]
        top_k=top_k if top_k is not None else settings.rag_top_k,
        rerank=False,
        llm_model=settings.rag_llm_model,
        llm_temperature=settings.rag_llm_temperature,
        llm_base_url=settings.deepseek_base_url,
        llm_api_key=settings.deepseek_api_key,
        system_prompt=_LAYER_SYSTEM_PROMPT,
    )


def citations_from_retrieval(result: RetrievalResult) -> list[Citation]:
    """Map RagPipeline hits into underwriting Citation value objects."""
    citations: list[Citation] = []
    for i, meta in enumerate(result.metadata):
        text = result.docs[i] if i < len(result.docs) else ""
        source_name = str(meta.get("source") or meta.get("file") or "unknown")
        clause_id = str(meta.get("clause_id") or f"{source_name}:p{meta.get('page', i)}")
        score = float(meta.get("score") or meta.get("similarity") or 0.0)
        similarity = max(0.0, min(1.0, score if 0.0 <= score <= 1.0 else 1.0 / (1.0 + abs(score))))
        effective = meta.get("effective_date")
        if not isinstance(effective, datetime):
            effective = _DEFAULT_EFFECTIVE
        program = _coerce_program(meta.get("program"), source_name)
        citations.append(
            Citation(
                clause_id=clause_id,
                source=PolicySource(
                    source_id=source_name,
                    name=source_name,
                    authority=_guess_authority(source_name, program),
                    version=str(meta.get("version") or "unknown"),
                    effective_date=effective,
                    program=program,
                ),
                retrieved_text=text,
                similarity_score=similarity,
                program=program,
            )
        )
    return citations


def _coerce_program(raw: object, source_name: str) -> PolicyLayer:
    if isinstance(raw, PolicyLayer):
        return raw
    if isinstance(raw, str):
        try:
            return PolicyLayer(raw)
        except ValueError:
            pass
    from policy_rag.tags import resolve_program

    return resolve_program(source_name)


def _guess_authority(source_name: str, program: PolicyLayer) -> Authority:
    if program == PolicyLayer.COMPLIANCE_FLOOR:
        return "regulatory"
    if program in {PolicyLayer.ELIGIBILITY_GATE, PolicyLayer.SBA_7A}:
        return "sba"
    if program == PolicyLayer.CDFI_DIRECT:
        return "lender"
    lower = source_name.lower()
    if "cfr" in lower or "regulation b" in lower or "ecoa" in lower or "ncua" in lower:
        return "regulatory"
    if "sop" in lower or "sba" in lower:
        return "sba"
    return "lender"
