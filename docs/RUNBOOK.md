# Runbook — Week 4 operations

Short operational notes for the FastAPI + LangGraph underwriting service.

## Services

| Piece | How to run | Health |
|-------|------------|--------|
| Postgres + pgvector | `docker compose up -d postgres` | `pg_isready` via compose healthcheck |
| API | `uv run underwriting-api` or `docker compose --profile api up -d --build api` | `GET /health` → `{ "status": "ok" }` |
| Readiness | depends on Postgres | `GET /ready` → `ready` / `not_ready` |
| Metrics | process-local counters | `GET /metrics` → decisions/day, escalation rate, latency p50/p95 |
| Web console | `cd web && pnpm dev` | Admin shows metrics + RAG status |
| Eval suite | `uv run underwriting-evals --mode graph --fail-on-gate` | hard gate = false-approve rate == 0 |

## If the LLM / embedding provider is down

- Deterministic path (financial tiering, program routing, risk ceiling, hard rejects) still runs without an LLM.
- Voyage / DeepSeek (`ChatOpenAI`) retry transient 429/5xx inside the SDK. The graph and `/rag/*` do **not** add another retry loop on top.
- Quota, billing, and auth errors are fatal — no retry, fail immediately.
- After the SDK fails on an otherwise-eligible file, the policy node fail-closes: the graph completes with `escalate` + a `provider_outage` audit event (not a 502, and not an auto-approve).
- Hard-reject / ineligible tracks still deny even if retrieval is down (they do not need citations).
- `/rag/search` and `/rag/ask` return **502** on the first surfaced provider error (playground is not a credit decision).
- `/rag/ask/stream` keeps the SSE open and emits an `error` event instead of a 502 once tokens have started.
- LLM judges (`--judge llm`) will fail; use `--judge skip` / heuristic for CI.
- Structured logs still emit `underwrite.decision` / `underwrite.error` JSON lines with outcome + latency.

## If retrieval returns nothing

- Empty retrieval (no exception) still yields **zero citations**. The critic may `Send` a selective retry; if the budget is exhausted it escalates.
- A raised provider error on an otherwise-eligible file is **not** treated as empty retrieval — it fail-closes as above.
- Mitigations: `docker compose up -d postgres`, confirm `VOYAGE_API_KEY`, re-ingest (`uv run underwriting-rag-ingest` or Admin → Ingest).

## Eval / CI failures

1. **HARD GATE FAILED: false_approve_rate > 0** — treat as a release blocker. Inspect the failing `case_id` in the uploaded `eval-report.json` artifact; never relax the gate.
2. Unit tests fail — fix before merging; graph smoke tests do not need live Voyage/Postgres.
3. Citation / faithfulness below target with `--judge heuristic` is expected when RAG is offline; re-check with `--judge llm` against an ingested corpus before calling Milestone 4 “quality complete.” CI gates **false-approve** only (citation needs live retrieval keys).

## Useful curls

```bash
curl -s http://127.0.0.1:8080/health
curl -s http://127.0.0.1:8080/ready
curl -s http://127.0.0.1:8080/metrics
curl -s -X POST http://127.0.0.1:8080/underwrite \
  -H 'Content-Type: application/json' \
  -d '{"applicant":{"business_name":"Acme","industry":"retail","annual_revenue":500000,"requested_loan_amount":75000,"years_in_business":5,"debt_service_coverage_ratio":1.4,"credit_score_proxy":720,"sbss_proxy":180}}'
```
