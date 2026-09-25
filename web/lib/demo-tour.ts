import type { DecisionOutcome } from "@/lib/underwrite"

export type DemoSpotlight = "queue" | "memo" | "citations" | "hitl"

export type DemoStep = {
  id: string
  title: string
  body: string
  spotlight: DemoSpotlight
  caseId?: string
  hitlOutcome?: DecisionOutcome
  tryIt?: {
    label: string
    action: "load-run" | "open-citation" | "record-hitl"
  }
}

/** Three-outcome walk: approve, deny, escalate. About four minutes. */
export const DEMO_STEPS: DemoStep[] = [
  {
    id: "book",
    title: "The book",
    body: "Forty-two labeled files. We walk three: an auto-approve, an eligibility deny, and a borderline escalate.",
    spotlight: "queue",
  },
  {
    id: "approve-run",
    title: "Auto-approve",
    body: "Cedar Ridge Fabrication — 7-year manufacturer seeking $250,000 SBA 7(a). Should clear the envelope.",
    spotlight: "queue",
    caseId: "gold-001",
    tryIt: { label: "Run Cedar Ridge", action: "load-run" },
  },
  {
    id: "approve-memo",
    title: "Read the memo",
    body: "Policy table is expected versus actual. Open a clause if you want the source.",
    spotlight: "memo",
    tryIt: { label: "Open a citation", action: "open-citation" },
  },
  {
    id: "approve-hitl",
    title: "Officer records the call",
    body: "The agent does not book the loan. Record Approve on this file.",
    spotlight: "hitl",
    caseId: "gold-001",
    hitlOutcome: "approve",
    tryIt: { label: "Record Approve", action: "record-hitl" },
  },
  {
    id: "deny-run",
    title: "Auto-deny",
    body: "Lucky Star Gaming Lounge fails the eligibility gate — restricted industry, not a credit-score call.",
    spotlight: "queue",
    caseId: "gold-006",
    tryIt: { label: "Run Lucky Star", action: "load-run" },
  },
  {
    id: "deny-hitl",
    title: "Record the deny",
    body: "Match the gate. Officer Deny.",
    spotlight: "hitl",
    caseId: "gold-006",
    hitlOutcome: "deny",
    tryIt: { label: "Record Deny", action: "record-hitl" },
  },
  {
    id: "escalate-run",
    title: "Escalate",
    body: "Lakeside HVAC clears both programs, but DSCR is borderline. The envelope sends it to a human.",
    spotlight: "queue",
    caseId: "gold-010",
    tryIt: { label: "Run Lakeside HVAC", action: "load-run" },
  },
  {
    id: "escalate-hitl",
    title: "Send to review",
    body: "Officer Escalate. That is the product: recommend, cite, then a human records the call.",
    spotlight: "hitl",
    caseId: "gold-010",
    hitlOutcome: "escalate",
    tryIt: { label: "Record Escalate", action: "record-hitl" },
  },
]

export const DEMO_HITL_CAUSE: Record<string, string> = {
  "gold-001": "In envelope. Healthy DSCR, both programs, low risk.",
  "gold-006": "Eligibility gate — restricted industry.",
  "gold-010": "Borderline DSCR. Both programs eligible; needs a human.",
}
