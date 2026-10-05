import type {
  Decision,
  DecisionOutcome,
  GoldSetCase,
  ImprovementAction,
  UnderwriteApplicantPayload,
  UnderwriteForm,
} from "@/lib/underwrite"

export type Persona = "lender" | "applicant"

export type DeskFocus = "catalog" | "file"

export type CaseStage = "draft" | "submitted" | "in_review" | "decided"

export type CaseActivityKind =
  | "opened"
  | "submitted"
  | "graph_ran"
  | "hitl_recorded"
  | "request_sent"

export type CaseActivity = {
  id: string
  at: string
  kind: CaseActivityKind
  message: string
}

export type BorrowerRequest = {
  id: string
  at: string
  message: string
}

export type OutstandingItem = {
  id: string
  title: string
  detail: string
  source: "officer" | "policy" | "credit" | "file"
}

export type CaseSession = {
  caseId: string | null
  applicantId: string | null
  persona: Persona
  deskFocus: DeskFocus
  stage: CaseStage
  applicant: UnderwriteApplicantPayload | null
  contactEmail: string | null
  decision: Decision | null
  agentOutcome: DecisionOutcome | null
  hitlOutcome: DecisionOutcome | null
  hitlCause: string | null
  requests: BorrowerRequest[]
  activity: CaseActivity[]
  wizardStep: number
}

export const EMPTY_CASE_SESSION: CaseSession = {
  caseId: null,
  applicantId: null,
  persona: "lender",
  deskFocus: "catalog",
  stage: "draft",
  applicant: null,
  contactEmail: null,
  decision: null,
  agentOutcome: null,
  hitlOutcome: null,
  hitlCause: null,
  requests: [],
  activity: [],
  wizardStep: 0,
}

export const EMPTY_APPLY_FORM: UnderwriteForm = {
  business_name: "",
  industry: "",
  annual_revenue: "",
  requested_loan_amount: "",
  years_in_business: "",
  debt_service_coverage_ratio: "",
  credit_score_proxy: "",
  sbss_proxy: "",
  requested_program: "",
  lender_id: "",
  has_bankruptcy: false,
  has_severe_fraud_alert: false,
  notes: "",
}

export const SAMPLE_FILES = [
  { caseId: "gold-001", label: "Cedar Ridge Fabrication" },
  { caseId: "gold-006", label: "Lucky Star Gaming Lounge" },
  { caseId: "gold-010", label: "Lakeside HVAC" },
] as const

export const NAMED_OFFICER = "Morgan Hale"

export const PORTAL_TRACK = [
  { id: "received", label: "Received" },
  { id: "submitted", label: "Submitted" },
  { id: "review", label: "Under review" },
  { id: "decision", label: "Decision" },
] as const

export function goldCaseToApplicant(row: GoldSetCase): UnderwriteApplicantPayload {
  return {
    applicant_id: row.applicant_id,
    business_name: row.business_name,
    industry: row.industry,
    annual_revenue: row.annual_revenue,
    requested_loan_amount: row.requested_loan_amount,
    years_in_business: row.years_in_business,
    debt_service_coverage_ratio: row.debt_service_coverage_ratio,
    credit_score_proxy: row.credit_score_proxy,
    sbss_proxy: row.sbss_proxy,
    has_bankruptcy: row.has_bankruptcy,
    has_severe_fraud_alert: row.has_severe_fraud_alert,
    requested_program: row.requested_program,
    lender_id: null,
    notes: null,
  }
}

export function formatCaseStage(stage: CaseStage): string {
  switch (stage) {
    case "draft":
      return "Draft"
    case "submitted":
      return "Submitted"
    case "in_review":
      return "Under review"
    case "decided":
      return "Decision recorded"
  }
}

export function portalStepIndex(stage: CaseStage): number {
  switch (stage) {
    case "draft":
      return 0
    case "submitted":
      return 1
    case "in_review":
      return 2
    case "decided":
      return 3
  }
}

export function makeCaseId(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : String(Date.now())
  return `apply-${suffix}`
}

export function makeActivity(
  kind: CaseActivityKind,
  message: string
): CaseActivity {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `act-${Date.now()}`
  return { id, at: new Date().toISOString(), kind, message }
}

export function friendlyActivityMessage(message: string): string {
  const recommended = /^Graph recommended (approve|deny|escalate)\./.exec(message)
  if (recommended) {
    return recommendationActivity(recommended[1] as DecisionOutcome)
  }
  const recorded = /^Officer recorded (approve|deny|escalate)(?:\.|: (.*))?$/.exec(
    message
  )
  if (recorded) {
    return officerDecisionActivity(recorded[1] as DecisionOutcome, recorded[2])
  }
  const opened = /^Opened (.+) \([^)]+\)\.$/.exec(message)
  if (opened) return `Opened ${opened[1]}.`
  return message
}

export function recommendationActivity(outcome: DecisionOutcome): string {
  switch (outcome) {
    case "approve":
      return "We recommend approval. An officer has not decided yet."
    case "deny":
      return "We recommend a decline. An officer has not decided yet."
    case "escalate":
      return "This application needs an officer to review it."
  }
}

export function officerDecisionActivity(
  outcome: DecisionOutcome,
  cause?: string | null
): string {
  const base =
    outcome === "approve"
      ? "Your officer approved this application."
      : outcome === "deny"
        ? "Your officer declined this application."
        : "Your officer sent this application for further review."
  const note = cause?.trim()
  return note ? `${base} ${note}` : base
}

export function officerDecisionLabel(outcome: DecisionOutcome): string {
  switch (outcome) {
    case "approve":
      return "Approved"
    case "deny":
      return "Declined"
    case "escalate":
      return "Needs review"
  }
}

export function borrowerOutcomeCopy(
  hitl: DecisionOutcome | null,
  agent: DecisionOutcome | null
): { title: string; body: string } {
  if (hitl === "approve") {
    return {
      title: "Your officer approved this application",
      body: "That decision is saved. It does not fund the loan by itself.",
    }
  }
  if (hitl === "deny") {
    return {
      title: "Your officer declined this application",
      body: "Open items explain what stood in the way.",
    }
  }
  if (hitl === "escalate") {
    return {
      title: "Your officer asked for another review",
      body: "The first recommendation is not the final decision.",
    }
  }
  if (agent === "approve") {
    return {
      title: "We recommend approval",
      body: "An officer still needs to confirm. Nothing is funded yet.",
    }
  }
  if (agent === "deny") {
    return {
      title: "We recommend a decline",
      body: "An officer still needs to confirm before this is final.",
    }
  }
  if (agent === "escalate") {
    return {
      title: "An officer needs to review this",
      body: "It did not auto-decide. Nothing is final until an officer decides.",
    }
  }
  return {
    title: "Application received",
    body: "An officer can review it from the desk.",
  }
}

export function outstandingFromSession(session: Pick<
  CaseSession,
  "requests" | "decision"
>): OutstandingItem[] {
  const items: OutstandingItem[] = []
  for (const request of session.requests ?? []) {
    items.push({
      id: request.id,
      title: "Question from the desk",
      detail: request.message,
      source: "officer",
    })
  }
  for (const action of session.decision?.improvement_actions ?? []) {
    items.push({
      id: `improve-${action.area}-${action.title}`,
      title: action.title,
      detail: action.detail,
      source: areaToSource(action),
    })
  }
  for (const reason of session.decision?.adverse_action_reasons ?? []) {
    items.push({
      id: `aar-${reason.reason_code}`,
      title: reason.description,
      detail: reason.reason_code,
      source: "policy",
    })
  }
  return items
}

function areaToSource(action: ImprovementAction): OutstandingItem["source"] {
  if (action.area === "policy" || action.area === "program") return "policy"
  if (action.area === "credit" || action.area === "financial") return "credit"
  return "file"
}
