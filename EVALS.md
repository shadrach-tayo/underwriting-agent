# Eval Success Criteria

> Week 1 Day 5 deliverable. Implement metrics in code in Week 4; this doc is the contract.

## Hard gate

| Metric | Target | Notes |
|--------|--------|-------|
| **False-approve rate** | **0%** | Build-blocking. CI must fail merges that regress this. |

## Target thresholds

| Metric | Target | Tool (Week 4) |
|--------|--------|----------------|
| Decision accuracy | 90%+ | DeepEval custom |
| Escalation precision | 80%+ | LLM-as-judge |
| Citation accuracy | 95%+ | LLM-as-judge |
| **Program-routing accuracy** | **90%+** | Exact match vs gold `expected_program` / `ProgramRouting` |
| Retrieval precision / recall | 0.85+ | RAGAS (optionally stratified by `program` layer) |
| Latency p95 | < 5s | Instrumentation |

### Program-routing accuracy

Gold applicants are labeled with which product track(s) they should fit after the
compliance floor + eligibility gate: `sba_7a`, `cdfi_direct`, both, or neither.

Score = fraction of cases where the agent's `Decision.program_routing` matches
the gold route (recommended program + eligibility flags). This is a free extra
eval dimension from the dual-program design — routing is a first-class decision,
not a side effect of picking a conflicting clause.

## Baseline log

Record first full eval pass numbers here after Week 4 Day 1.

| Date | False-approve | Decision acc. | Citation acc. | Program route | Escalation prec. | Notes |
|------|---------------|---------------|---------------|---------------|------------------|-------|
| — | — | — | — | — | — | not run yet |
