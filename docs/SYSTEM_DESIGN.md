# System Design

Canonical diagram: [`underwriting_agent_system_design.png`](./underwriting_agent_system_design.png).

## 1. Requirements

### Functional

- Process inbound applications; auto-approve / deny within a confidence + risk envelope
- Human underwriters take over when auto-decision criteria are not met (HITL)
- Hard-reject bankruptcies and severe fraud alerts
- Escalate non-standard / conditional cases with a full reasoning trace
- Interpret policy clauses; produce compliance reports with citations
- Compute standard underwriting ratios; suggest term modifications when useful
- Log every retry cycle, report, and citation immutably (hash-chained audit trail)
- ECOA/Reg B adverse-action reasons on every denial

### Non-functional

| Metric | Target |
|--------|--------|
| Latency (clean path) | < 5s |
| Latency (retry chain) | < 15s |
| Escalation rate | < 25% |
| False-approve rate | 0% (hard gate) |
| Availability | 99.99% |
| Scale | ~1000 applications / day |

## 2. High-level architecture

```text
API Gateway (Backend API | MCP | Serverless)
        ↓
 Agent Runtime (LangGraph)
   Underwriter Agent
        ↓ fan-out
   Financial Analysis ║ Policy Compliance   (SubagentState each)
        ↓ fan-in (defer)
   Self Critic / Adversarial  ⟲ Send(rerun_targets)
        ↓
   Decision Node (CompositeScore + hard-coded risk ceiling)
        ↓                    ↓
   Approve/Decline      HITL → Human Capture → Human Review UI
        ↓                    ↓
           Immutable Audit Trail → END
```

## 3. Data model

| Entity | Role |
|--------|------|
| `Applicant` | Typed structured intake (+ bankruptcy / fraud flags) |
| `SubagentOutput` | Uniform financial/policy result (`FinancialMetrics`, citations, conflicts) |
| `CritiqueReport` | `PASS` / `RETRY` / `ESCALATE` + `rerun_targets` |
| `Decision` | Outcome, origin, `CompositeScore`, ceiling flag, adverse-action reasons |
| `EscalationPackage` / `HumanReviewRecord` | Review queue + maker-checker override |
| `AuditEntry` | Hash-chained append-only events |
| `GraphState` / `SubagentState` | LangGraph channels vs isolated subagent working set |

## 4. Failure modes

| Failure | Mitigation |
|---------|------------|
| Missed edge cases | Critic retry loop (`Send`) + HITL |
| Hallucination | Citation grounding fields + RAG (Week 3) |
| API / LLM outage | Fail closed to escalate; backoff |
| Over-conservative declines | Calibrate composite score + term-mod suggestions |
| Ceiling override abuse | Maker-checker (`override_confirmed_by`) |

## 5. Tradeoffs

- Uniform `SubagentOutput` so critique/decision treat agents identically
- Hard-coded risk ceiling in code (`RiskTier.PROHIBITED`), not prompts
- Selective `Send` retries with merge-by-key `subagent_outputs`
- Policy subagent later compared as LangGraph-native vs Claude Agent SDK
