"""Public RAG search / optional agent-answer endpoints for the playground."""

from __future__ import annotations

import json
import logging
from collections.abc import Iterator
from typing import Any, NoReturn

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from rag.pipeline import RagPipeline, RetrievalResult

from agents.lenders import is_known_lender
from config import Settings
from evals.tracing import span
from http_api.deps import SettingsDep
from http_api.errors import extract_error_message, public_dependency_error
from http_api.schemas import (
    RagAskResponse,
    RagAskStreamRequest,
    RagChatMessage,
    RagHit,
    RagSearchRequest,
    RagSearchResponse,
)
from models import Citation, PolicyLayer
from policy_rag import (
    citations_from_generate,
    citations_from_retrieval,
    generate_payload_from_retrieval,
    get_policy_pipeline,
    llm_text_from_content,
)
from policy_rag.filters import ensure_regulatory_citations, filter_citations

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["rag"])

_VALID_PROGRAMS = {p.value for p in PolicyLayer}


def _hits_from_citations(citations: list[Any]) -> list[RagHit]:
    hits: list[RagHit] = []
    for cite in citations:
        meta = {"version": cite.source.version}
        if cite.source.lender_id:
            meta["lender_id"] = cite.source.lender_id
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
                lender_id=cite.source.lender_id,
                metadata=meta,
            )
        )
    return hits


def _validate_search(body: RagSearchRequest) -> str:
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
    if body.lender_id is not None and not is_known_lender(body.lender_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown lender_id: {body.lender_id}",
        )
    return query


def _scope_citations(
    pool: list[Citation],
    body: RagSearchRequest,
    *,
    top_k: int,
) -> list[Citation]:
    include_shared = not body.exact_program
    scoped = filter_citations(
        pool,
        program=body.program,
        lender_id=body.lender_id,
        include_shared_layers=include_shared,
    )
    # Always try to keep regulatory evidence when not debugging a single layer.
    if not body.exact_program or body.program in (None, "compliance_floor"):
        scoped = ensure_regulatory_citations(scoped, pool)
    return scoped[:top_k]


def _require_generate_key(settings: Settings) -> None:
    if not (settings.deepseek_api_key or "").strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "DeepSeek is not configured. Set DEEPSEEK_API_KEY in .env "
                "for agent answers (OpenAI is not used for RAG generation)."
            ),
        )


def _fetch_k(body: RagSearchRequest) -> int:
    filtering = body.program is not None or body.lender_id is not None
    return body.top_k * 4 if filtering else body.top_k


def _raise_dependency(exc: Exception) -> NoReturn:
    status_code, detail = public_dependency_error(exc)
    raise HTTPException(status_code=status_code, detail=detail) from exc


def _retrieve_or_502(pipeline: RagPipeline, query: str, fetch_k: int) -> RetrievalResult:
    try:
        return pipeline.retrieve(query, top_k=fetch_k)
    except Exception as exc:  # noqa: BLE001
        logger.exception("RAG retrieve failed")
        _raise_dependency(exc)


def _generate_or_502(
    pipeline: RagPipeline,
    query: str,
    fetch_k: int,
) -> dict[str, Any]:
    try:
        return pipeline.generate(query, top_k=fetch_k)
    except Exception as exc:  # noqa: BLE001
        logger.exception("RAG generate failed")
        _raise_dependency(exc)


def _hits_from_generate(
    generated: dict[str, Any],
    body: RagSearchRequest,
    *,
    fallback: list[Citation] | None = None,
) -> list[RagHit]:
    pool = citations_from_generate(generated)
    if not pool and fallback:
        pool = fallback
    return _hits_from_citations(_scope_citations(pool, body, top_k=body.top_k))


@router.post("/search", response_model=RagSearchResponse)
def rag_search(body: RagSearchRequest, settings: SettingsDep) -> RagSearchResponse:
    """Dense retrieve policy chunks. Set ``with_answer`` to also call the LLM."""
    return _rag_search(body, settings)


def _rag_search(body: RagSearchRequest, settings: Settings) -> RagSearchResponse:
    query = _validate_search(body)
    fetch_k = _fetch_k(body)
    pipeline = get_policy_pipeline(top_k=fetch_k)

    with span("http.rag.search") as current:
        if current is not None:
            current.log(
                input={
                    "query": query,
                    "top_k": body.top_k,
                    "program": body.program,
                    "lender_id": body.lender_id,
                    "exact_program": body.exact_program,
                    "with_answer": body.with_answer,
                }
            )

        answer: str | None = None
        if body.with_answer:
            _require_generate_key(settings)
            generated = _generate_or_502(pipeline, query, fetch_k)
            answer = llm_text_from_content(generated.get("content"))
            hits = _hits_from_generate(generated, body)
        else:
            result = _retrieve_or_502(pipeline, query, fetch_k)
            hits = _hits_from_citations(
                _scope_citations(citations_from_retrieval(result), body, top_k=body.top_k)
            )

        response = RagSearchResponse(
            query=query,
            index_name=settings.rag_index_name,
            strategy=settings.rag_strategy,
            program_filter=body.program,
            lender_filter=body.lender_id,
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
        lender_filter=search.lender_filter,
        hits=search.hits,
        answer=search.answer or "",
    )


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, default=str)}\n\n"


def _chunk_reasoning(chunk: object) -> str:
    extra = getattr(chunk, "additional_kwargs", None)
    if not isinstance(extra, dict):
        return ""
    for key in ("reasoning_content", "reasoning"):
        value = extra.get(key)
        if isinstance(value, str) and value:
            return value
    return ""


def _history_messages(
    messages: list[RagChatMessage],
    query: str,
) -> list[dict[str, str]]:
    history: list[dict[str, str]] = []
    for item in messages:
        content = item.content.strip()
        if not content:
            continue
        history.append({"role": item.role, "content": content})
    if history and history[-1]["role"] == "user" and history[-1]["content"] == query:
        history = history[:-1]
    return history


@router.post("/ask/stream")
def rag_ask_stream(body: RagAskStreamRequest, settings: SettingsDep) -> StreamingResponse:
    """Stream a generate-style answer: sources first, then tokens (and optional thinking)."""
    query = _validate_search(body)
    _require_generate_key(settings)
    fetch_k = _fetch_k(body)
    pipeline = get_policy_pipeline(top_k=fetch_k)

    def events() -> Iterator[str]:
        with span("http.rag.ask.stream") as current:
            if current is not None:
                current.log(
                    input={
                        "query": query,
                        "top_k": body.top_k,
                        "program": body.program,
                        "lender_id": body.lender_id,
                        "exact_program": body.exact_program,
                        "n_messages": len(body.messages),
                    }
                )
            yield _sse({"type": "status", "text": "Retrieving policy clauses…"})
            try:
                result = pipeline.retrieve(query, top_k=fetch_k)
            except Exception as exc:  # noqa: BLE001
                logger.exception("RAG retrieve failed")
                yield _sse({"type": "error", "detail": extract_error_message(exc)})
                return

            generated = generate_payload_from_retrieval(result, question=query)
            hits = _hits_from_generate(
                generated,
                body,
                fallback=citations_from_retrieval(result),
            )
            yield _sse(
                {
                    "type": "sources",
                    "hits": [hit.model_dump() for hit in hits],
                    "index_name": settings.rag_index_name,
                    "strategy": settings.rag_strategy,
                    "program_filter": body.program,
                    "lender_filter": body.lender_id,
                }
            )

            context_texts = [hit.text for hit in hits if hit.text.strip()]
            if not context_texts:
                context_texts = list(generated.get("retrieval_context") or [])
            context = "\n\n".join(context_texts)
            instructions = f"""{pipeline.config.system_prompt}

        <context>
        {context}
        </context>"""
            chat = [{"role": "system", "content": instructions}]
            chat.extend(_history_messages(body.messages, query))
            chat.append({"role": "user", "content": query})

            yield _sse({"type": "status", "text": "Generating an answer from retrieved sources…"})
            answer_parts: list[str] = []
            try:
                llm = pipeline._get_llm()
                for chunk in llm.stream(chat):
                    reasoning = _chunk_reasoning(chunk)
                    if reasoning:
                        yield _sse({"type": "reasoning", "text": reasoning})
                    token = llm_text_from_content(getattr(chunk, "content", None))
                    if token:
                        answer_parts.append(token)
                        yield _sse({"type": "token", "text": token})
            except Exception as exc:  # noqa: BLE001
                logger.exception("RAG generate stream failed")
                yield _sse({"type": "error", "detail": extract_error_message(exc)})
                return

            answer = "".join(answer_parts)
            if current is not None:
                current.log(
                    output={
                        "n_hits": len(hits),
                        "answer_chars": len(answer),
                    }
                )
            yield _sse({"type": "done", "answer": answer})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
