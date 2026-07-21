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
| Retrieval precision / recall | 0.85+ | RAGAS |
| Latency p95 | < 5s | Instrumentation |

## Baseline log

Record first full eval pass numbers here after Week 4 Day 1.

| Date | False-approve | Decision acc. | Citation acc. | Escalation prec. | Notes |
|------|---------------|---------------|---------------|------------------|-------|
| — | — | — | — | — | not run yet |
