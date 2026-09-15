"""Citation accuracy — heuristic overlap + optional DeepEval/LLM judge."""

from __future__ import annotations

import re
from typing import Any

from evals.types import JudgeMode, Prediction
from models import Citation


_TOKEN = re.compile(r"[a-z0-9]{3,}", re.I)


def _tokens(text: str) -> set[str]:
    return {t.lower() for t in _TOKEN.findall(text or "")}


def citation_grounding_score(citation: Citation, rationale: str) -> float:
    """How well this citation supports the rationale (token recall into cite)."""
    cite_toks = _tokens(citation.retrieved_text) | _tokens(citation.clause_id)
    rationale_toks = _tokens(rationale)
    if not rationale_toks or not cite_toks:
        return 0.0
    return len(rationale_toks & cite_toks) / len(rationale_toks)


def heuristic_citation_accuracy(pred: Prediction) -> float:
    citations = pred.decision.citations
    if not citations:
        return 0.0
    # Union of citation text should cover the rationale ("cites what it claims").
    cite_toks: set[str] = set()
    for c in citations:
        cite_toks |= _tokens(c.retrieved_text) | _tokens(c.clause_id)
    rationale_toks = _tokens(pred.decision.rationale.text)
    if not rationale_toks:
        return 0.0
    if not cite_toks:
        return 0.0
    return len(rationale_toks & cite_toks) / len(rationale_toks)


def score_citation_accuracy(
    pred: Prediction,
    *,
    mode: JudgeMode = "heuristic",
) -> tuple[float | None, dict[str, Any]]:
    """Return (score, details). ``skip`` yields (None, …)."""
    if mode == "skip":
        return None, {"mode": "skip"}
    if mode == "heuristic":
        score = heuristic_citation_accuracy(pred)
        return score, {"mode": "heuristic", "n_citations": len(pred.decision.citations)}

    # LLM path via DeepEval Faithfulness-style judge on cited text as context.
    try:
        from deepeval.metrics import FaithfulnessMetric
        from deepeval.test_case import LLMTestCase
    except ImportError as exc:  # pragma: no cover
        return heuristic_citation_accuracy(pred), {
            "mode": "heuristic_fallback",
            "error": str(exc),
        }

    contexts = [c.retrieved_text for c in pred.decision.citations if c.retrieved_text]
    if not contexts:
        return 0.0, {"mode": "llm", "error": "no_citation_texts"}

    metric = FaithfulnessMetric(threshold=0.95, include_reason=True)
    case = LLMTestCase(
        input="Underwriting decision rationale must be grounded in cited policy.",
        actual_output=pred.decision.rationale.text,
        retrieval_context=contexts,
    )
    metric.measure(case)
    return float(metric.score or 0.0), {
        "mode": "llm",
        "reason": getattr(metric, "reason", None),
        "success": metric.is_successful(),
    }
