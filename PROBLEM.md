# Problem Statement

> Week 1 Day 1 deliverable. Fill this before writing production agent logic.

## Who is the user, and what decision are they making?

- **User:** an SME loan underwriter using this as a decision-support and auto-decisioning tool.
- **Decision:** approve, deny, or escalate a small-business loan application.

## Cost of getting it wrong

A loan underwriting system can make two distinct errors, each with different economic and mathematical consequences. False approval is the highest-cost error and must trend to zero.

| Metric | Type I — False Positive (False Approval) | Type II — False Negative (False Rejection) |
|--------|------------------------------------------|--------------------------------------------|
| **Definition** | Approving a high-risk borrower who eventually defaults | Rejecting a creditworthy borrower who would have repaid |
| **Financial cost** | **Severe loss:** remaining loan principal plus high legal collection fees | **Opportunity cost:** lost net interest margin and future cross-selling revenue |
| **Systemic impact** | Destroys liquidity, depletes regulatory capital reserves, can lead to bank insolvency | Harms market share, limits business growth, increases customer acquisition costs |

Operational failure mode for this agent (third decision path):

| Error | Cost |
|-------|------|
| Over-escalation | Defeats automation; buries reviewers in noise |

## Success in numbers

| Metric | Target |
|--------|--------|
| False-approve rate | **0%** on labeled gold set (hard gate / build-blocking) |
| Decision accuracy | **90%+** vs ground truth on clear-cut cases |
| Program-routing accuracy | **90%+** vs gold expected program track(s) |
| Escalation rate | **15–25%** |
| Escalation precision | **80%+** |
| Citation accuracy | **95%+** |
| Retrieval precision / recall | **0.85+** |
| Latency p95 | **< 5s** |

## Out of scope

- Real money movement
- Real credit bureau integration
- Real applicant PII

## Notes

Dual-program fictional CDFI lender (SBA 7(a) + Accion-style direct), with ECOA/Reg B
as a compliance floor and SBA core eligibility as a shared categorical gate — not one
merged rulebook. Calibrate synthetic applicants against Fed Small Business Credit Survey
distributions; gold labels include outcome **and** expected program route (see `EVALS.md`).
