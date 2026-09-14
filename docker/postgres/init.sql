-- underwriting_db bootstrap (pgvector image)
-- Future multi-tenant: one schema (or DB) per lender; keep public for shared demo corpus.

CREATE EXTENSION IF NOT EXISTS vector;

-- Placeholder for lender-scoped RAG indexes (Week 3+ multi-tenant demos).
-- Example: CREATE SCHEMA IF NOT EXISTS lender_accion;
CREATE SCHEMA IF NOT EXISTS shared_policy;
COMMENT ON SCHEMA shared_policy IS
  'Default policy corpus (ECOA/Reg B, SBA SOP, CDFI direct). Per-lender schemas come later.';
