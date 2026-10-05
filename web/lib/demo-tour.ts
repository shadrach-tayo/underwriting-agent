import type { DecisionOutcome } from "@/lib/underwrite"

export type DemoSpotlight =
  | "queue"
  | "memo"
  | "citations"
  | "hitl"
  | "apply"
  | "portal"
  | "switch"

export type DemoAction =
  | "play-apply"
  | "submit-apply"
  | "open-citation"
  | "record-hitl"
  | "goto"

export type DemoStep = {
  id: string
  title: string
  body: string
  bullets: string[]
  tryIt: string
  spotlight: DemoSpotlight
  href?: string
  caseId?: string
  hitlOutcome?: DecisionOutcome
  action: DemoAction
  holdMs: number
}

/** Seven steps for one labeled case. */
export const DEMO_STEPS: DemoStep[] = [
  {
    id: "apply-sample",
    title: "Fill the form from a labeled case",
    body: "Cedar Ridge Fabrication is gold-001, a working-capital applicant already in the catalog. One action copies those fields into the form.",
    bullets: [
      "Every field stays editable after the case loads",
      "The input is structured data, not uploaded documents",
    ],
    tryIt: "Load Cedar Ridge",
    spotlight: "apply",
    href: "/apply",
    caseId: "gold-001",
    action: "play-apply",
    holdMs: 900,
  },
  {
    id: "apply-submit",
    title: "Submit reviews the application",
    body: "The same review the lender desk runs. It checks the numbers and the policy, then returns a recommendation.",
    bullets: [
      "Each check reports as it finishes",
      "A recommendation to approve does not fund the loan",
    ],
    tryIt: "Submit application",
    spotlight: "apply",
    href: "/apply",
    action: "submit-apply",
    holdMs: 1200,
  },
  {
    id: "portal-review",
    title: "The status page reads this same case",
    body: "Progress, open questions, and the assigned officer. The loan is not funded.",
    bullets: [
      "The case id matches the lender desk",
      "Open questions are written for the applicant",
    ],
    tryIt: "Review status",
    spotlight: "portal",
    href: "/portal",
    action: "goto",
    holdMs: 3200,
  },
  {
    id: "switch-desk",
    title: "Switch into the officer seat",
    body: "Cedar Ridge is already selected and the review is finished. This is the lender view of that same case.",
    bullets: [
      "There is no second submission",
      "Changing seats keeps the case in place",
    ],
    tryIt: "Read the memo",
    spotlight: "memo",
    href: "/playground/underwrite",
    action: "goto",
    holdMs: 2600,
  },
  {
    id: "approve-memo",
    title: "Each check points at a policy clause",
    body: "Expected value next to what the case shows. Open a row to read the clause behind it.",
    bullets: [
      "Policy checks sit beside the source clause",
      "Opening a row shows the retrieved text",
    ],
    tryIt: "Open a citation",
    spotlight: "memo",
    href: "/playground/underwrite",
    action: "open-citation",
    holdMs: 2200,
  },
  {
    id: "approve-hitl",
    title: "Record the decision",
    body: "The recommendation is to approve. Save that decision on this case. Funding is a separate step.",
    bullets: [
      "The saved decision is what the desk keeps",
      "A case above the risk ceiling still cannot be approved",
    ],
    tryIt: "Record Approve",
    spotlight: "hitl",
    href: "/playground/underwrite",
    caseId: "gold-001",
    hitlOutcome: "approve",
    action: "record-hitl",
    holdMs: 1800,
  },
  {
    id: "portal-decided",
    title: "The status page shows the recorded outcome",
    body: "The applicant page refreshes on the same case and shows what the officer saved. The loan is still not funded.",
    bullets: [
      "One case id on both sides",
      "Lucky Star and Lakeside stay in the queue for the other two outcomes",
    ],
    tryIt: "Finish",
    spotlight: "portal",
    href: "/portal",
    action: "goto",
    holdMs: 3600,
  },
]

export const DEMO_INTRO = {
  kicker: "Demo walkthrough",
  title: "One case, inside the envelope.",
  body: "Cedar Ridge is clear enough to auto-decide, with the cited trace beside it. A case above the hard-coded risk ceiling cannot take that path.",
  hold: "Stays in this browser · seven steps",
} as const

export const DEMO_GRAPH_NODES = [
  { id: "underwriter", label: "Normalize the applicant" },
  { id: "financial_analysis", label: "Compute the ratios" },
  { id: "policy_compliance", label: "Match policy rules" },
  { id: "self_critic", label: "Self-critic" },
  { id: "decision", label: "Write the recommendation" },
] as const

export const DEMO_HITL_CAUSE: Record<string, string> = {
  "gold-001": "In envelope. Healthy DSCR, both programs, low risk.",
  "gold-006": "Eligibility gate — restricted industry.",
  "gold-010": "Borderline DSCR. Both programs eligible; needs a human.",
}

export const DEMO_FILE = {
  caseId: "gold-001",
  name: "Cedar Ridge Fabrication",
} as const
