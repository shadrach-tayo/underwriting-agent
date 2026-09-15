"""LangSmith env bootstrap + compiled-graph accessors for FastAPI / evals."""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Any
from uuid import uuid4

from config import Settings, get_settings
from models import Applicant, Decision

logger = logging.getLogger(__name__)


def configure_langsmith(settings: Settings | None = None) -> None:
    """Mirror Settings into the env vars LangGraph/LangChain read for tracing.

    Does not require deploying to LangSmith Cloud — local ``invoke``/``ainvoke``
    still ships spans when ``LANGSMITH_API_KEY`` + tracing are set.
    """
    # Keep unit tests offline / quiet even if the developer .env enables tracing.
    if os.environ.get("PYTEST_CURRENT_TEST") or os.environ.get(
        "UNDERWRITING_DISABLE_LANGSMITH"
    ):
        os.environ["LANGSMITH_TRACING"] = "false"
        os.environ["LANGCHAIN_TRACING_V2"] = "false"
        return
    cfg = settings or get_settings()
    if cfg.langsmith_api_key:
        os.environ.setdefault("LANGSMITH_API_KEY", cfg.langsmith_api_key)
    if cfg.langsmith_project:
        os.environ.setdefault("LANGSMITH_PROJECT", cfg.langsmith_project)
        os.environ.setdefault("LANGCHAIN_PROJECT", cfg.langsmith_project)
    if cfg.langsmith_tracing or cfg.langchain_tracing_v2:
        os.environ.setdefault("LANGSMITH_TRACING", "true")
        os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")


@lru_cache
def get_compiled_graph():
    """Process-wide compiled graph (shared by API + eval harness)."""
    configure_langsmith()
    # Prefer the module singleton so Studio (`graph.graph`) and API share one compile.
    from graph import graph as compiled

    return compiled


def run_underwrite(
    applicant: Applicant,
    *,
    case_id: str | None = None,
    max_retries: int = 3,
) -> dict[str, Any]:
    """Invoke the underwriting graph and return the final state dict."""
    configure_langsmith()
    graph = get_compiled_graph()
    resolved_case_id = case_id or f"case-{uuid4().hex[:12]}"
    result: dict[str, Any] = graph.invoke(
        {
            "case_id": resolved_case_id,
            "applicant": applicant,
            "retry_count": 0,
            "max_retries": max_retries,
        },
        config={
            "configurable": {"thread_id": resolved_case_id},
            "run_name": f"underwrite:{resolved_case_id}",
            "tags": ["underwrite", "api"],
            "metadata": {
                "case_id": resolved_case_id,
                "applicant_id": applicant.applicant_id,
            },
        },
    )
    return result


def decision_from_state(state: dict[str, Any]) -> Decision:
    decision = state.get("decision")
    if decision is None:
        raise RuntimeError("Graph returned no decision")
    if isinstance(decision, Decision):
        return decision
    return Decision.model_validate(decision)
