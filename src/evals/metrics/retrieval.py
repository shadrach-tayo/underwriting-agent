"""RAG retrieval metrics: context precision/recall + faithfulness.

Primary path: DeepEval ContextualPrecision / ContextualRecall / Faithfulness.
Optional path: RAGAS when importable (currently blocked by langchain_community
vertexai import break on community>=0.4).
Deterministic fallback: token-overlap precision/recall for offline CI.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Literal

from evals.types import JudgeMode, Prediction

logger = logging.getLogger(__name__)

RetrievalBackend = Literal["deepeval", "ragas", "heuristic", "skip"]

_TOKEN = re.compile(r"[a-z0-9]{3,}", re.I)


def _tokens(text: str) -> set[str]:
    return {t.lower() for t in _TOKEN.findall(text or "")}


def _overlap(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def heuristic_context_precision(pred: Prediction) -> float | None:
    """Share of retrieved contexts that overlap a reference context."""
    retrieved = pred.retrieved_contexts
    refs = pred.reference_contexts
    if not retrieved:
        return None
    if not refs:
        return None
    hits = 0
    for ctx in retrieved:
        if any(_overlap(ctx, ref) >= 0.15 for ref in refs):
            hits += 1
    return hits / len(retrieved)


def heuristic_context_recall(pred: Prediction) -> float | None:
    """Share of reference contexts covered by at least one retrieval."""
    retrieved = pred.retrieved_contexts
    refs = pred.reference_contexts
    if not refs:
        return None
    if not retrieved:
        return 0.0
    hits = 0
    for ref in refs:
        if any(_overlap(ref, ctx) >= 0.15 for ctx in retrieved):
            hits += 1
    return hits / len(refs)


def heuristic_faithfulness(pred: Prediction) -> float | None:
    """Rationale token coverage by union of retrieved (+ citation) contexts."""
    contexts = list(pred.retrieved_contexts)
    contexts.extend(c.retrieved_text for c in pred.decision.citations if c.retrieved_text)
    if not contexts:
        return None
    rationale = pred.decision.rationale or ""
    rat_toks = _tokens(rationale)
    if not rat_toks:
        return None
    ctx_toks: set[str] = set()
    for c in contexts:
        ctx_toks |= _tokens(c)
    if not ctx_toks:
        return 0.0
    return len(rat_toks & ctx_toks) / len(rat_toks)


def _deepeval_rag_scores(pred: Prediction) -> dict[str, float | None]:
    from deepeval.metrics import (
        ContextualPrecisionMetric,
        ContextualRecallMetric,
        FaithfulnessMetric,
    )
    from deepeval.test_case import LLMTestCase, RetrievedContextData

    question = f"Underwrite applicant {pred.case_id}: outcome={pred.decision.outcome.value}"
    expected = " ".join(pred.reference_contexts) or pred.decision.rationale
    # list is invariant: list[str] is not a list[str | RetrievedContextData].
    raw_contexts = pred.retrieved_contexts or [
        c.retrieved_text for c in pred.decision.citations
    ]
    retrieval_context: list[str | RetrievedContextData] = [
        ctx for ctx in raw_contexts
    ]
    case = LLMTestCase(
        input=question,
        actual_output=pred.decision.rationale,
        expected_output=expected,
        retrieval_context=retrieval_context,
        context=pred.reference_contexts or None,
    )
    out: dict[str, float | None] = {
        "context_precision": None,
        "context_recall": None,
        "faithfulness": None,
    }
    if case.retrieval_context:
        try:
            m = FaithfulnessMetric(threshold=0.85, include_reason=False)
            m.measure(case)
            out["faithfulness"] = float(m.score or 0.0)
        except Exception as exc:  # noqa: BLE001
            logger.warning("FaithfulnessMetric failed: %s", exc)
        if pred.reference_contexts:
            try:
                m = ContextualPrecisionMetric(threshold=0.85, include_reason=False)
                m.measure(case)
                out["context_precision"] = float(m.score or 0.0)
            except Exception as exc:  # noqa: BLE001
                logger.warning("ContextualPrecisionMetric failed: %s", exc)
            try:
                m = ContextualRecallMetric(threshold=0.85, include_reason=False)
                m.measure(case)
                out["context_recall"] = float(m.score or 0.0)
            except Exception as exc:  # noqa: BLE001
                logger.warning("ContextualRecallMetric failed: %s", exc)
    return out


def _ragas_available() -> bool:
    try:
        import ragas  # noqa: F401
        from ragas.metrics import faithfulness  # noqa: F401

        return True
    except Exception:  # noqa: BLE001
        return False


def score_retrieval(
    pred: Prediction,
    *,
    mode: JudgeMode = "heuristic",
    backend: RetrievalBackend | None = None,
) -> tuple[dict[str, float | None], dict[str, Any]]:
    """Score context precision/recall + faithfulness for one prediction."""
    if mode == "skip":
        return (
            {"context_precision": None, "context_recall": None, "faithfulness": None},
            {"backend": "skip"},
        )

    chosen: RetrievalBackend
    if backend:
        chosen = backend
    elif mode == "llm":
        chosen = "deepeval"
    else:
        chosen = "heuristic"

    if chosen == "ragas" and not _ragas_available():
        logger.warning("RAGAS unavailable; falling back to heuristic retrieval scores")
        chosen = "heuristic"

    if chosen == "deepeval":
        try:
            scores = _deepeval_rag_scores(pred)
            return scores, {"backend": "deepeval"}
        except Exception as exc:  # noqa: BLE001
            logger.warning("DeepEval RAG metrics failed (%s); heuristic fallback", exc)
            chosen = "heuristic"

    scores = {
        "context_precision": heuristic_context_precision(pred),
        "context_recall": heuristic_context_recall(pred),
        "faithfulness": heuristic_faithfulness(pred),
    }
    return scores, {"backend": "heuristic"}
