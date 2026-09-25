# Observability

Two layers, not one stack:

| Layer | What it is | When to look |
|-------|------------|----------------|
| **LLM traces** | LangSmith (LangGraph) + optional Braintrust (evals) | Why a node decided, retry, citation |
| **Service metrics** | Prometheus scrape + Grafana dashboard | Rate, latency, outcome mix, errors |
| **Request logs** | JSON lines on stdout with `request_id` | Correlate a playground click to a graph run |

We did **not** adopt the template’s JWT sessions, mem0, Langfuse, or cAdvisor. Those solve a different product (chat agent + user auth).

```text
Browser / playground
        │  X-Request-ID
        ▼
   FastAPI ── GET /metrics          JSON for Admin card
           ── GET /prometheus       scrape text
           ── underwrite.decision   JSON log + request_id
        │
        ├─ LangSmith / Braintrust   (existing)
        └─ Prometheus → Grafana :3300
```

## Request IDs

Every response includes `X-Request-ID`. Send your own or the API mints one. Underwrite logs include the same id:

```json
{"event":"underwrite.decision","request_id":"…","case_id":"gold-001","outcome":"approve"}
```

## Prometheus

Keep `GET /metrics` as the process-local JSON snapshot (Admin + `tests/test_metrics_api.py`). Scrapes use:

```bash
curl -s http://127.0.0.1:8080/prometheus | head
```

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | Counter | method, endpoint, status |
| `http_request_duration_seconds` | Histogram | method, endpoint |
| `underwrite_decisions_total` | Counter | outcome |
| `underwrite_errors_total` | Counter | — |
| `underwrite_latency_seconds` | Histogram | — |

`/health`, `/ready`, and `/prometheus` are excluded from HTTP counters so scrapes do not inflate traffic.

## Grafana

Port **3300** so it does not collide with the Next.js playground on 3000.

```bash
# API on the host (default local loop)
uv run underwriting-api

docker compose --profile observability up -d
# Prometheus  http://127.0.0.1:9090
# Grafana     http://127.0.0.1:3300  (admin / admin)
```

Provisioned dashboard: **Underwriting API** (`grafana/dashboards/underwriting.json`). Datasource is Prometheus at `http://prometheus:9090`.

Prometheus scrapes `host.docker.internal:8080` for a host-run API, and `api:8080` when `docker compose --profile api` is also up. The compose job is red if that profile is off — that is expected.

## What we skipped from the template (on purpose)

- **Langfuse** — LangSmith already traces this graph.
- **JWT / sessions / slowapi** — playground is operator-local; `/admin/*` already has `X-Admin-Key`.
- **mem0 + Alembic + Valkey** — policy RAG already uses pgvector; no chat memory store.
- **cAdvisor** — host/container inventory is not the demo story.
- **Renaming `src/` to `app/`** — would break `langgraph.json`, evals, and CI for no product gain.
