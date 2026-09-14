# Underwriting Decision & Escalation Agent

Agentic underwriting for SME loans: auto-decide inside a defined confidence and risk envelope, escalate everything else with a citation-grounded reasoning trace. A **hard-coded risk ceiling** in application code prevents any case above threshold from being auto-approved, regardless of model confidence.

Build tracker: open [`underwriting-agent-roadmap.html`](./underwriting-agent-roadmap.html) in a browser.

## Stack

| Layer | Choice |
|-------|--------|
| Orchestration | LangGraph (Python) |
| Secondary framework | Claude Agent SDK |
| LLM | Claude (Sonnet) + thin OpenAI fallback |
| Vector DB | pgvector on Postgres |
| API | FastAPI |
| MCP | FastMCP |
| Evals | DeepEval + RAGAS + custom LLM-as-judge |
| Observability | LangSmith |
| Package / env | **uv** (`.venv`) |

## Layout

```text
src/underwriting_agent/
  graph/          # GraphState/SubagentState, nodes, hash-chained audit
  agents/         # Financial, Policy, Critic (SubagentOutput / CritiqueReport)
  mcp_server/     # FastMCP tools
  api/            # FastAPI health/ready shell (Week 4 expands)
  evals/          # Eval suite (Week 4)
  models.py       # Citations, decisions, HITL, audit value objects
  config.py       # Settings incl. hard-coded risk ceiling
data/
  policy_sources/ # Public policy docs (Week 1)
  gold_set/       # Labeled synthetic applicants (Week 1)
docs/             # System design (+ underwriting_agent_system_design.png)
terraform/        # AWS ECS + RDS (Week 5)
tests/
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

# After VOYAGE_API_KEY is set and Postgres is healthy:
# uv run underwriting-rag-ingest
```

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

Graph ID: `underwriting` → `src/underwriting_agent/graph/__init__.py:graph`

`langchain-community` is pinned to `0.3.29` so `ragas` can import (newer community builds dropped `chat_models.vertexai`). Revisit when upgrading evals in Week 4.

## Hard-coded risk ceiling

`RISK_CEILING` (default `0.75`) is enforced in `underwriting_agent.graph.apply_risk_ceiling` — not in prompts. Cases at or above the ceiling always escalate. Prompt-injection bypass tests land in Week 2 Day 3.

## Roadmap pace

Week 1 is docs + data (`PROBLEM.md`, system design, policy sources, gold set, `EVALS.md`). Agentic core starts Week 2. Do not skip the false-approve-rate eval design.

## License

**All Rights Reserved** — see [`LICENSE`](./LICENSE). Viewing for portfolio review is fine; reuse requires written permission.

An unused PolyForm Noncommercial draft remains at [`licenses/LICENSE.polyform-noncommercial`](./licenses/LICENSE.polyform-noncommercial) if you ever want to switch.
