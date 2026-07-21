# System Design

> Week 1 Day 2 deliverable. Expand using Guide 2 in `underwriting-agent-roadmap.html`.

## 1. Requirements

### Functional

- Accept structured SME applicant intake
- Retrieve relevant underwriting / fair-lending policy clauses
- Produce approve / deny / escalate with reasoning trace and citations
- Escalate via HITL when confidence is low or risk is high
- Enforce hard-coded risk ceiling in code

### Non-functional (initial targets)

- Latency p95 < 5s
- False-approve rate 0% on gold set
- LangSmith-traced runs for every decision path

## 2. High-level architecture

See Architecture tab in the roadmap HTML (Supervisor → Financial Analysis + Policy Compliance → Agentic RAG → Decision → Auto-decision | HITL).

## 3. Data model (sketch)

- **Applicant** — structured financial profile (no real PII)
- **Policy chunk** — source, citation, embedding, text
- **Audit log** — immutable record of inputs, retrieval, decision, ceiling trigger

## 4. Scaling

- Stateless API workers (ECS Fargate) + shared Postgres/pgvector
- Checkpoint store for LangGraph HITL resume

## 5. Failure modes

| Failure | Mitigation |
|---------|------------|
| LLM outage | Fail closed to escalate; optional thin OpenAI fallback later |
| Empty retrieval | Escalate; never auto-approve without citations |
| Conflicting policy clauses | Surface conflict in reasoning trace; prefer escalate |

## 6. Tradeoffs

- LangGraph for orchestration + Claude Agent SDK for policy subagent (comparison story)
- pgvector over a hosted vector DB (reuse Postgres operational knowledge)
- Risk ceiling in code, not prompt (non-negotiable safety property)
