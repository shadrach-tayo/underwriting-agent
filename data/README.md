# Data (local only)

Policy PDFs, the gold-set JSONL, lender overlays, and calibration sources stay on this machine. They are not in git.

```bash
uv run underwriting-gold-set   # writes data/gold_set/applicants.jsonl
# Place policy files under data/policy_sources/ then:
uv run underwriting-rag-ingest
```

CI regenerates the gold set the same way. Playground `/gold-set` and RAG ingest need these files locally.
