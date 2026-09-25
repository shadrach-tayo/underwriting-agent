# Underwriting Decision & Escalation Agent

Agentic underwriting for SME loans: auto-decide inside a defined confidence and risk envelope, escalate everything else with a citation-grounded reasoning trace. A **hard-coded risk ceiling** in application code prevents any case above threshold from being auto-approved, regardless of model confidence.

Build tracker: open [`underwriting-agent-roadmap.html`](./underwriting-agent-roadmap.html) in a browser.

## Stack

| Layer | Choice |
|-------|--------|
| Orchestration | LangGraph (Python) |
| LLM | Claude (Sonnet) + thin OpenAI / DeepSeek fallback for RAG answers |
| Vector DB | pgvector on Postgres |
| API | FastAPI |
| MCP | FastMCP (stub tools under `src/mcp_server`) |
| Evals | DeepEval + Braintrust (+ RAGAS when importable) |
| Observability | Braintrust (evals) + LangSmith (LangGraph) + Prometheus / Grafana |
| Package / env | **uv** (`.venv`) |
| Web UI | Next.js + shadcn (`web/`) |
| CI | GitHub Actions — pytest + false-approve hard gate |
| Metrics | `GET /metrics` (JSON) + `GET /prometheus` + Grafana on :3300 |

## Eval snapshot (Week 4)

Graph harness (`uv run underwriting-evals --mode graph --judge skip --fail-on-gate`):

| Metric | Result | Target |
|--------|--------|--------|
| **False-approve rate** | **0.0** | **0** (hard gate) |
| Decision accuracy | 1.0 | ≥ 0.9 |
| Program-routing accuracy | 1.0 | ≥ 0.9 |
| Escalation precision | 1.0 | ≥ 0.8 |
| Latency p95 | ~215 ms | < 5 s |

Citation / faithfulness need `--judge llm` against an ingested corpus (see [`EVALS.md`](./EVALS.md)). Ops notes: [`docs/RUNBOOK.md`](./docs/RUNBOOK.md).

## Layout

```text
src/
  graph/          # GraphState/SubagentState, nodes, hash-chained audit
  agents/         # Financial, Policy, Critic (SubagentOutput / CritiqueReport)
  mcp_server/     # FastMCP tools
  http_api/       # FastAPI health/ready, underwrite, admin RAG
  policy_rag/     # Policy corpus ingest + RagPipeline adapter (≠ dependency `rag`)
  evals/          # Eval suite (Week 4)
  models.py       # Citations, decisions, HITL, audit value objects
  config.py       # Settings incl. hard-coded risk ceiling
web/              # Next.js console — Admin (RAG) + Playground (agents)
data/
  policy_sources/ # Public policy docs (Week 1)
  gold_set/       # Labeled synthetic applicants (Week 1)
  lenders/        # Lender offer-matrix overlays
docs/             # System design + RUNBOOK + OBSERVABILITY
prometheus/       # scrape config (profile: observability)
grafana/          # provisioned Underwriting API dashboard
terraform/        # AWS ECS + RDS (Week 5)
tests/
.github/workflows/ci.yml
Dockerfile
```

## Setup

Requires [uv](https://docs.astral.sh/uv/) and Python 3.12+.

```bash
# Install deps into project .venv (created automatically)
uv sync

# Copy env template and fill keys (LangSmith + Anthropic for local agent work)
cp .env.example .env

# Postgres + pgvector for RAG (policy ingest / retrieve)
docker compose up -d postgres

# Smoke-check
uv run underwriting-agent
uv run pytest

# Eval hard gate (false-approve must stay 0)
uv run underwriting-evals --mode graph --judge skip --fail-on-gate

# After VOYAGE_API_KEY is set and Postgres is healthy:
# uv run underwriting-rag-ingest
# or via admin API:
# uv run underwriting-api
# curl -X POST http://127.0.0.1:8080/admin/rag/ingest -H 'Content-Type: application/json' -d '{}'
# curl http://127.0.0.1:8080/admin/rag/status

# Web console (Admin + Playground)
cd web && pnpm install && pnpm dev
```

### API container

```bash
docker build -t underwriting-api .
docker run --rm -p 8080:8080 --env-file .env \
  -e API_HOST=0.0.0.0 -e API_RELOAD=false \
  -e POSTGRES_HOST=host.docker.internal -e POSTGRES_PORT=54326 \
  underwriting-api

# or compose profile (wires Postgres hostname automatically):
docker compose --profile api up -d --build api

# Prometheus :9090 + Grafana :3300 (scrapes GET /prometheus)
docker compose --profile observability up -d
```

Ops notes for traces vs scrapes: [`docs/OBSERVABILITY.md`](./docs/OBSERVABILITY.md).

### Local LangGraph + LangSmith

From the repo root (uses [`langgraph.json`](./langgraph.json)):

```bash
# Requires LANGSMITH_API_KEY in .env for Studio/tracing
uv run langgraph dev
```

This starts the LangGraph API server with hot reload (default `http://127.0.0.1:2024`) and opens LangGraph Studio. Traces land in the LangSmith project named by `LANGSMITH_PROJECT` (default `underwriting-agent`).

```bash
uv run langgraph validate   # check langgraph.json
uv run langgraph dev --no-browser
```

Graph ID: `underwriting` → `src/graph/__init__.py:graph`

`langchain-community` is pinned for RAGAS compatibility where needed. Revisit pins when upgrading evals.

## Hard-coded risk ceiling

`RISK_CEILING` (default `0.75`) is enforced in `graph.apply_risk_ceiling` — not in prompts. Cases at or above the ceiling always escalate. Prompt-injection bypass tests land in Week 2 Day 3.

## Roadmap pace

Week 1–3 foundations + RAG are in place. **Week 4** focuses on eval gates, containerization, and the runbook. Week 5 is AWS deploy + demo.

## License

**All Rights Reserved** — see [`LICENSE`](./LICENSE). Viewing for portfolio review is fine; reuse requires written permission.

An unused PolyForm Noncommercial draft remains at [`licenses/LICENSE.polyform-noncommercial`](./licenses/LICENSE.polyform-noncommercial) if you ever want to switch.
