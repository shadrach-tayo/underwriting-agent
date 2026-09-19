# Eval Success Criteria

> Week 1 Day 5 deliverable. **Week 4 implementation lives in `src/evals/`.**

## Hard gate

| Metric | Target | Notes |
|--------|--------|-------|
| **False-approve rate** | **0%** | Build-blocking. CI must fail merges that regress this. |

## Target thresholds

| Metric | Target | Tool (Week 4) |
|--------|--------|----------------|
| Decision accuracy | 90%+ | DeepEval custom (`DecisionAccuracyMetric`) |
| Escalation precision | 80%+ | Exact match among predicted escalations |
| Citation accuracy | 95%+ | Heuristic overlap + optional DeepEval/LLM judge |
| **Program-routing accuracy** | **90%+** | Exact match vs gold `eligible_programs` / `recommended_program` |
| Context precision / recall | 0.85+ | DeepEval Contextual\* (RAGAS optional; see note) |
| Faithfulness | 0.85+ | DeepEval `FaithfulnessMetric` (+ heuristic fallback) |
| Latency p95 | < 5s | Instrumentation on harness |

### Program-routing accuracy

Gold applicants are labeled with which product track(s) they should fit after the
compliance floor + eligibility gate: `sba_7a`, `cdfi_direct`, both, or neither.

Score = fraction of cases where the agent's `Decision.program_routing` matches
the gold route (recommended program + eligibility flags). This is a free extra
eval dimension from the dual-program design — routing is a first-class decision,
not a side effect of picking a conflicting clause.

## Run the suite

```bash
# Harness smoke (oracle = replay gold labels — proves metrics/gates)
uv run underwriting-evals --mode oracle

# Sync gold set → versioned Braintrust dataset (needs BRAINTRUST_API_KEY)
uv run underwriting-evals --sync-dry-run    # preview record plan
uv run underwriting-evals --sync-dataset    # upsert + flush

# Against the live LangGraph agent
uv run underwriting-evals --mode graph --fail-on-gate

# LLM judges for citation + RAG metrics (needs ANTHROPIC/OPENAI keys)
uv run underwriting-evals --mode graph --judge llm

# Run Braintrust Eval against the remote dataset
BRAINTRUST_TRACING=true uv run underwriting-evals --mode oracle --braintrust
```

Dataset layout on Braintrust ([docs](https://www.braintrust.dev/docs/annotate/datasets)):

| Field | Content |
|-------|---------|
| `id` | Stable `case_id` (re-sync dedupes / versions) |
| `input` | `{ case_id, applicant }` |
| `expected` | Gold `label` (outcome, routing, rationale, …) |
| `metadata` | Outcome, risk tier, programs, policy flags |
| `tags` | Calibration tags + `outcome:*` / `program:*` / `policy:*` |

Env: `BRAINTRUST_PROJECT` (default `underwriting-agent`), `BRAINTRUST_DATASET` (default `underwriting-gold-set`).

Layout:

| Path | Role |
|------|------|
| `src/evals/runner.py` | Suite orchestration + DeepEval case scoring |
| `src/evals/metrics/` | False-approve, decision, routing, citation, retrieval |
| `src/evals/harness.py` | `oracle` / `graph` / `predictions` adapters |
| `src/evals/tracing.py` | Braintrust logger + spans (no-op without API key) |
| `src/evals/thresholds.py` | EVALS.md targets as code |

### RAGAS note

`ragas` currently fails to import with `langchain-community>=0.4` (missing
`chat_models.vertexai`). Retrieval metrics default to **DeepEval** + a
deterministic token-overlap fallback so the suite runs offline. Re-enable RAGAS
when the community/ragas pin is compatible.

## Baseline log

Record first full eval pass numbers here after Week 4 Day 1.

| Date | False-approve | Decision acc. | Citation acc. | Program route | Escalation prec. | Notes |
|------|---------------|---------------|---------------|---------------|------------------|-------|
| 2026-09-19 | 0.0 | 1.0 | n/a (`--judge skip`) | 1.0 | 1.0 | Graph harness; hard gate + suite pass offline. Re-check citation/faithfulness with `--judge llm` + ingested RAG. |
