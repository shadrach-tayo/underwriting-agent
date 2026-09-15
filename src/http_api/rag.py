"""Public RAG search / optional agent-answer endpoints for the playground."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status

from config import Settings
from evals.tracing import span
from http_api.deps import SettingsDep
from http_api.errors import extract_error_message
from http_api.schemas import (
    RagAskResponse,
    RagHit,
    RagSearchRequest,
    RagSearchResponse,
)
from models import PolicyLayer
from policy_rag import citations_from_retrieval, get_policy_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["rag"])

_VALID_PROGRAMS = {p.value for p in PolicyLayer}


def _hits_from_result(result: Any, *, program: str | None) -> list[RagHit]:
    citations = citations_from_retrieval(result)
    hits: list[RagHit] = []
    for cite in citations:
        if program and cite.program.value != program:
            continue
        hits.append(
            RagHit(
                clause_id=cite.clause_id,
                text=cite.retrieved_text,
                score=cite.similarity_score,
                program=cite.program.value,
                source=cite.source.name,
                authority=cite.source.authority,
                url=cite.source.url,
                title=cite.source.title,
                metadata={
                    "version": cite.source.version,
                },
            )
        )
    return hits


@router.post("/search", response_model=RagSearchResponse)
def rag_search(body: RagSearchRequest, settings: SettingsDep) -> RagSearchResponse:
    """Dense retrieve policy chunks. Set ``with_answer`` to also call the LLM."""
    return _rag_search(body, settings)


def _rag_search(body: RagSearchRequest, settings: Settings) -> RagSearchResponse:
    query = body.query.strip()
    if not query:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="query must not be empty",
        )
    if body.program is not None and body.program not in _VALID_PROGRAMS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown program layer: {body.program}",
        )

    with span("http.rag.search") as current:
        if current is not None:
            current.log(
                input={
                    "query": query,
                    "top_k": body.top_k,
                    "program": body.program,
                    "with_answer": body.with_answer,
                }
            )

        # Over-fetch when filtering by program so we still return up to top_k hits.
        fetch_k = body.top_k * 3 if body.program else body.top_k
        pipeline = get_policy_pipeline(top_k=fetch_k)
        try:
            result = pipeline.retrieve(query, top_k=fetch_k)
        except Exception as exc:  # noqa: BLE001
            logger.exception("RAG retrieve failed")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=extract_error_message(exc),
            ) from exc

        hits = _hits_from_result(result, program=body.program)[: body.top_k]
        answer: str | None = None
        if body.with_answer:
            if not (settings.deepseek_api_key or "").strip():
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=(
                        "DeepSeek is not configured. Set DEEPSEEK_API_KEY in .env "
                        "for agent answers (OpenAI is not used for RAG generation)."
                    ),
                )
            try:
                generated = pipeline.generate(query, top_k=fetch_k)
                answer = str(generated.get("content") or "")
            except Exception as exc:  # noqa: BLE001
                logger.exception("RAG generate failed")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=extract_error_message(exc),
                ) from exc

        response = RagSearchResponse(
            query=query,
            index_name=settings.rag_index_name,
            strategy=settings.rag_strategy,
            program_filter=body.program,
            with_answer=body.with_answer,
            hits=hits,
            answer=answer,
        )
        if current is not None:
            current.log(
                output={
                    "n_hits": len(hits),
                    "with_answer": body.with_answer,
                    "answer_chars": len(answer or ""),
                }
            )
        return response


@router.post("/ask", response_model=RagAskResponse)
def rag_ask(body: RagSearchRequest, settings: SettingsDep) -> RagAskResponse:
    """Convenience alias: always generate an agent answer over retrieved context."""
    forced = body.model_copy(update={"with_answer": True})
    search = rag_search(forced, settings)
    return RagAskResponse(
        query=search.query,
        index_name=search.index_name,
        strategy=search.strategy,
        program_filter=search.program_filter,
        hits=search.hits,
        answer=search.answer or "",
    )
