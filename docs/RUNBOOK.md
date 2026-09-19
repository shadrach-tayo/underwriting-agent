# Runbook — Week 4 operations

Short operational notes for the FastAPI + LangGraph underwriting service.

## Services

| Piece | How to run | Health |
|-------|------------|--------|
| Postgres + pgvector | `docker compose up -d postgres` | `pg_isready` via compose healthcheck |
| API | `uv run underwriting-api` or `docker compose --profile api up -d --build api` | `GET /health` → `{ "status": "ok" }` |
| Readiness | depends on Postgres | `GET /ready` → `ready` / `not_ready` |
| Web console | `cd web && pnpm dev` | http://127.0.0.1:3000 |
| Eval suite | `uv run underwriting-evals --mode graph --fail-on-gate` | hard gate = false-approve rate == 0 |

## If the LLM provider is down

- Deterministic path (financial tiering, program routing, risk ceiling, hard rejects) still runs without an LLM.
- Policy RAG generation (`with_answer`) and LLM judges (`--judge llm`) will fail; use `--judge skip` / heuristic for CI.
- `/underwrite` continues to return approve / deny / escalate from the graph; citation lists may be empty if Voyage/DeepSeek are unreachable.

## If retrieval returns nothing

- Policy subagent logs a warning and continues with **zero citations**.
- Decision still uses program routing + financial envelope; composite evidence coverage drops (harder to auto-approve when scores are borderline).
- Mitigations: `docker compose up -d postgres`, confirm `VOYAGE_API_KEY`, re-ingest (`uv run underwriting-rag-ingest` or Admin → Ingest).

## Eval / CI failures

1. **HARD GATE FAILED: false_approve_rate > 0** — treat as a release blocker. Inspect the failing `case_id` in the uploaded `eval-report.json` artifact; never relax the gate.
2. Unit tests fail — fix before merging; graph smoke tests do not need live Voyage/Postgres.
3. Citation / faithfulness below target with `--judge heuristic` is expected when RAG is offline; re-check with `--judge llm` against an ingested corpus before calling Milestone 4 “quality complete.”

## Useful curls

```bash
curl -s http://127.0.0.1:8080/health
curl -s http://127.0.0.1:8080/ready
curl -s -X POST http://127.0.0.1:8080/underwrite \
  -H 'Content-Type: application/json' \
  -d '{"applicant":{"business_name":"Acme","industry":"retail","annual_revenue":500000,"requested_loan_amount":75000,"years_in_business":5,"debt_service_coverage_ratio":1.4,"credit_score_proxy":720,"sbss_proxy":180}}'
```
