import { apiBase, jsonHeaders, readApiError } from "@/lib/api"

export type UnderwriteProgram = "" | "sba_7a" | "cdfi_direct"
export type UnderwriteLender = "" | "accion" | "frontier_7a"
export type LoanProgram = "sba_7a" | "cdfi_direct"
export type LenderId = "accion" | "frontier_7a"
export type DecisionOutcome = "approve" | "deny" | "escalate"
export type RiskTier = "low" | "medium" | "high" | "prohibited"
export type RationaleKind =
  | "financial"
  | "policy"
  | "critic"
  | "envelope"
  | "hard_reject"
  | "human"
  | "routing"
  | "general"

export type UnderwriteForm = {
  business_name: string
  industry: string
  annual_revenue: string
  requested_loan_amount: string
  years_in_business: string
  debt_service_coverage_ratio: string
  credit_score_proxy: string
  sbss_proxy: string
  requested_program: UnderwriteProgram
  lender_id: UnderwriteLender
  has_bankruptcy: boolean
  has_severe_fraud_alert: boolean
  notes: string
}

export type UnderwriteApplicantPayload = {
  applicant_id?: string | null
  business_name: string
  industry: string
  annual_revenue: number
  requested_loan_amount: number
  years_in_business: number
  debt_service_coverage_ratio: number | null
  credit_score_proxy: number | null
  sbss_proxy: number | null
  has_bankruptcy: boolean
  has_severe_fraud_alert: boolean
  requested_program: LoanProgram | null
  lender_id: LenderId | null
  notes: string | null
}

export type UnderwriteRequestParams = {
  applicant: UnderwriteApplicantPayload
  case_id?: string | null
}

export type GoldSetCase = {
  case_id: string
  applicant_id: string
  business_name: string
  industry: string
  annual_revenue: number
  requested_loan_amount: number
  years_in_business: number
  debt_service_coverage_ratio: number | null
  credit_score_proxy: number | null
  sbss_proxy: number | null
  has_bankruptcy: boolean
  has_severe_fraud_alert: boolean
  requested_program: LoanProgram | null
  gold_outcome: DecisionOutcome
  gold_risk_tier: string
  gold_program: LoanProgram | null
  gold_rationale: string
}

export type GoldSetResponse = {
  n_cases: number
  counts: Record<string, number>
  cases: GoldSetCase[]
}

export type RationaleFactTone = "pass" | "fail" | "warn" | "neutral" | "info"

export type RationaleFact = {
  key: string
  label: string
  value: string
  tone: RationaleFactTone
  detail?: string | null
}

export type RationaleSection = {
  kind: RationaleKind
  title: string
  body: string
  facts?: RationaleFact[]
}

export type DecisionRationale = {
  summary: string
  sections: RationaleSection[]
}

export type CompositeScore = {
  subagent_agreement: number
  evidence_coverage: number
  calibration_adjustment: number
  composite: number
}

export type AdverseActionReason = {
  reason_code: string
  description: string
  supporting_citations: string[]
}

export type PolicySource = {
  source_id: string
  name: string
  authority: string
  version: string
  effective_date: string
  program: string
  title?: string | null
  url?: string | null
  lender_id?: string | null
}

export type Citation = {
  clause_id: string
  source: PolicySource
  retrieved_text: string
  similarity_score: number
  program: string
  grounding_score: number | null
  grounded: boolean | null
}

export type ProgramRouting = {
  compliance_floor_pass: boolean
  eligibility_gate_pass: boolean
  eligible_programs: LoanProgram[]
  recommended_program: LoanProgram | null
  ineligible_reasons: Record<string, string>
}

export type FinancialMetrics = {
  debt_to_income: number | null
  debt_service_coverage: number | null
  risk_score: number
  risk_tier: RiskTier
  recommended_term_mods: string[]
  extras: Record<string, number>
}

export type SubagentOutput = {
  agent: string
  conclusion: string
  confidence: number
  reasoning_trace: string
  citations: Citation[]
  conflicts: unknown[]
  metrics: FinancialMetrics | null
  program_routing: ProgramRouting | null
  hard_reject: boolean
  hard_reject_reason: string | null
  provider_outage?: boolean
  provider_outage_reason?: string | null
  retry_index: number
  produced_at: string
}

export type ImprovementArea =
  | "financial"
  | "credit"
  | "policy"
  | "program"
  | "structure"

export type ImprovementPriority = "high" | "medium" | "low"

export type ImprovementAction = {
  area: ImprovementArea
  priority: ImprovementPriority
  title: string
  detail: string
  target: string | null
}

export type Decision = {
  outcome: DecisionOutcome
  origin: string
  risk_tier: RiskTier
  ceiling_triggered: boolean
  composite_score: CompositeScore | null
  rationale: DecisionRationale
  program_routing: ProgramRouting | null
  adverse_action_reasons: AdverseActionReason[]
  term_modifications: string[]
  improvement_actions?: ImprovementAction[]
  citations: Citation[]
  decided_at: string
}

export type EscalationPackage = {
  reason: string
  rationale: DecisionRationale
  financial_summary: string
  compliance_summary: string
  citations: Citation[]
  critic_notes: string
  sla_queue: string
}

export type UnderwriteResult = {
  case_id: string
  decision: Decision
  program_routing: ProgramRouting | null
  citations: Citation[]
  subagent_outputs: Record<string, SubagentOutput>
  escalation: EscalationPackage | null
  latency_ms: number | null
}

export const underwriteKeys = {
  all: ["underwrite"] as const,
  goldSet: () => [...underwriteKeys.all, "gold-set"] as const,
  runs: () => [...underwriteKeys.all, "run"] as const,
  run: (params: UnderwriteRequestParams) =>
    [...underwriteKeys.runs(), params] as const,
}

function toNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export function buildUnderwritePayload(
  form: UnderwriteForm,
  extras?: { case_id?: string | null; applicant_id?: string | null }
): UnderwriteRequestParams {
  const annual_revenue = toNumber(form.annual_revenue)
  const requested_loan_amount = toNumber(form.requested_loan_amount)
  const years_in_business = toNumber(form.years_in_business)
  if (
    annual_revenue == null ||
    requested_loan_amount == null ||
    years_in_business == null
  ) {
    throw new Error(
      "Revenue, loan amount, and years in business are required numbers."
    )
  }
  return {
    case_id: extras?.case_id || undefined,
    applicant: {
      applicant_id: extras?.applicant_id || undefined,
      business_name: form.business_name.trim(),
      industry: form.industry.trim(),
      annual_revenue,
      requested_loan_amount,
      years_in_business,
      debt_service_coverage_ratio: toNumber(form.debt_service_coverage_ratio),
      credit_score_proxy: toNumber(form.credit_score_proxy),
      sbss_proxy: toNumber(form.sbss_proxy),
      has_bankruptcy: form.has_bankruptcy,
      has_severe_fraud_alert: form.has_severe_fraud_alert,
      requested_program: form.requested_program || null,
      lender_id: form.lender_id || null,
      notes: form.notes.trim() || null,
    },
  }
}

/** Tenure the way a lender says it: "8-year", "7-month". */
export function formatTenureLabel(years: number | null | undefined): string {
  if (years == null || !Number.isFinite(years)) return "operating"
  if (years < 1) {
    const months = Math.max(1, Math.round(years * 12))
    return `${months}-month`
  }
  const rounded = Number.isInteger(years)
    ? String(years)
    : years.toFixed(1).replace(/\.0$/, "")
  return `${rounded}-year`
}

/** File note a lender would write — not a gold-set catalog id. */
export function describeGoldCase(row: GoldSetCase): string {
  const tenure = formatTenureLabel(row.years_in_business)
  const industry = row.industry.trim()
  const amount = formatCurrency(row.requested_loan_amount)
  const product = row.requested_program
    ? ` ${formatProgram(row.requested_program)}`
    : ""
  const bits = [
    `${tenure} ${industry} firm seeking ${amount}${product}.`,
    `Revenue ${formatCurrency(row.annual_revenue)}.`,
  ]
  if (row.debt_service_coverage_ratio != null) {
    bits.push(`DSCR ${row.debt_service_coverage_ratio.toFixed(2)}x.`)
  }
  if (row.has_bankruptcy) bits.push("Prior bankruptcy on file.")
  if (row.has_severe_fraud_alert) bits.push("Severe fraud alert on file.")
  return bits.join(" ")
}

export function goldCaseToForm(row: GoldSetCase): UnderwriteForm {
  return {
    business_name: row.business_name,
    industry: row.industry,
    annual_revenue: String(row.annual_revenue),
    requested_loan_amount: String(row.requested_loan_amount),
    years_in_business: String(row.years_in_business),
    debt_service_coverage_ratio:
      row.debt_service_coverage_ratio == null
        ? ""
        : String(row.debt_service_coverage_ratio),
    credit_score_proxy:
      row.credit_score_proxy == null ? "" : String(row.credit_score_proxy),
    sbss_proxy: row.sbss_proxy == null ? "" : String(row.sbss_proxy),
    requested_program: row.requested_program ?? "",
    lender_id: "",
    has_bankruptcy: row.has_bankruptcy,
    has_severe_fraud_alert: row.has_severe_fraud_alert,
    notes: describeGoldCase(row),
  }
}

export function applicantToForm(
  applicant: UnderwriteApplicantPayload
): UnderwriteForm {
  return {
    business_name: applicant.business_name,
    industry: applicant.industry,
    annual_revenue: String(applicant.annual_revenue),
    requested_loan_amount: String(applicant.requested_loan_amount),
    years_in_business: String(applicant.years_in_business),
    debt_service_coverage_ratio:
      applicant.debt_service_coverage_ratio == null
        ? ""
        : String(applicant.debt_service_coverage_ratio),
    credit_score_proxy:
      applicant.credit_score_proxy == null
        ? ""
        : String(applicant.credit_score_proxy),
    sbss_proxy:
      applicant.sbss_proxy == null ? "" : String(applicant.sbss_proxy),
    requested_program: applicant.requested_program ?? "",
    lender_id: applicant.lender_id ?? "",
    has_bankruptcy: applicant.has_bankruptcy,
    has_severe_fraud_alert: applicant.has_severe_fraud_alert,
    notes: applicant.notes ?? "",
  }
}

export async function fetchGoldSet(): Promise<GoldSetResponse> {
  const res = await fetch(`${apiBase()}/gold-set`)
  if (!res.ok) {
    throw new Error(await readApiError(res, "Gold set failed"))
  }
  return (await res.json()) as GoldSetResponse
}

export async function runUnderwrite(
  params: UnderwriteRequestParams
): Promise<UnderwriteResult> {
  const res = await fetch(`${apiBase()}/underwrite`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    throw new Error(await readApiError(res, "Underwrite failed"))
  }
  return (await res.json()) as UnderwriteResult
}

export function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

/** Snake/kebab status tokens → Title Case labels for UI (spaces, not em dashes). */
export function formatStatusLabel(value: string | null | undefined): string {
  if (!value) return "—"
  const known: Record<string, string> = {
    approve: "Approve",
    deny: "Deny",
    escalate: "Escalate",
    hard_reject: "Hard reject",
    low: "Low",
    medium: "Medium",
    high: "High",
    prohibited: "Prohibited",
    financial: "Financial",
    policy: "Policy",
    critic: "Critic",
    envelope: "Envelope",
    human: "Human",
    routing: "Routing",
    general: "General",
  }
  if (known[value]) return known[value]
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

/** Decision words for sentences and status lines. Deny reads as decline. */
export function friendlyDecision(outcome: string | null | undefined): string {
  if (outcome === "deny") return "Decline"
  return formatStatusLabel(outcome)
}

export function formatProgram(value: string | null | undefined) {
  if (!value) return "—"
  if (value === "sba_7a") return "SBA 7(a)"
  if (value === "cdfi_direct") return "CDFI Direct"
  if (value === "compliance_floor") return "Compliance floor"
  if (value === "eligibility_gate") return "Eligibility gate"
  return formatStatusLabel(value)
}

export function formatLender(value: string | null | undefined) {
  if (!value) return "—"
  if (value === "accion") return "Accion"
  if (value === "frontier_7a") return "Frontier 7(a)"
  return formatStatusLabel(value)
}

export function outcomeTone(outcome: string | null | undefined) {
  switch (outcome) {
    case "approve":
      return "approve" as const
    case "deny":
      return "deny" as const
    case "escalate":
      return "escalate" as const
    default:
      return "neutral" as const
  }
}

export function rationaleText(rationale: DecisionRationale | null | undefined) {
  if (!rationale) return ""
  const parts = [rationale.summary]
  for (const section of rationale.sections ?? []) {
    if (section.body && section.body !== rationale.summary) {
      parts.push(section.body)
    }
  }
  return parts.filter(Boolean).join("; ")
}

/** Coerce API/cache shapes (legacy string or partial object) into DecisionRationale. */
export function normalizeRationale(
  value: DecisionRationale | string | null | undefined
): DecisionRationale {
  if (value == null) {
    return { summary: "", sections: [] }
  }
  if (typeof value === "string") {
    const summary = value.trim()
    if (!summary) return { summary: "", sections: [] }
    return {
      summary,
      sections: [
        {
          kind: "general",
          title: "General",
          body: summary,
          facts: parseTraceFacts(summary),
        },
      ],
    }
  }
  const summary =
    typeof value.summary === "string" ? value.summary : rationaleText(value)
  const sections = Array.isArray(value.sections)
    ? value.sections.map((section) => ({
        ...section,
        body: section.body ?? "",
        facts:
          Array.isArray(section.facts) && section.facts.length > 0
            ? section.facts
            : parseTraceFacts(section.body ?? ""),
      }))
    : []
  return { summary, sections }
}

const FACT_LABELS: Record<string, string> = {
  loan_to_revenue: "Loan / revenue",
  risk_tier: "Risk tier",
  dscr: "DSCR",
  risk_score: "Risk score",
  compliance_floor: "Compliance floor",
  eligibility_gate: "Eligibility gate",
  eligible: "Eligible programs",
  eligible_programs: "Eligible programs",
  recommended: "Recommended",
  recommended_program: "Recommended",
  citations: "Citations",
  borderline: "Borderline",
  hard_reject: "Hard reject",
  reuse_evidence: "Reuse evidence",
  critic_feedback: "Critic feedback",
}

function inferFactTone(key: string, raw: string): RationaleFactTone {
  const v = raw.trim().toLowerCase()
  if (["pass", "true", "yes"].includes(v)) return "pass"
  if (["fail", "false", "no", "none"].includes(v)) return "fail"
  if (key.includes("reject") || v.includes("reject")) return "fail"
  if (key === "risk_tier") {
    if (v === "low") return "pass"
    if (v === "medium") return "warn"
    return "fail"
  }
  if (key === "dscr") {
    const n = Number(v)
    if (!Number.isFinite(n)) return "neutral"
    if (n >= 1.25) return "pass"
    if (n >= 1.2) return "warn"
    return "fail"
  }
  if (key === "loan_to_revenue" || key === "risk_score") {
    const n = Number(v)
    if (!Number.isFinite(n)) return "neutral"
    if (key === "loan_to_revenue") {
      if (n <= 0.5) return "pass"
      if (n <= 0.75) return "warn"
      return "fail"
    }
    if (n <= 0.35) return "pass"
    if (n <= 0.65) return "warn"
    return "fail"
  }
  return "neutral"
}

function formatParsedValue(key: string, raw: string): string {
  const v = raw.trim()
  if (key === "loan_to_revenue") {
    const n = Number(v)
    if (Number.isFinite(n) && n <= 5) return `${(n * 100).toFixed(1)}%`
  }
  if (key === "dscr") {
    const n = Number(v)
    if (Number.isFinite(n)) return `${n.toFixed(2)}x`
  }
  if (["pass", "fail"].includes(v.toLowerCase())) {
    return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()
  }
  if (v.includes("_") || v.includes("-")) return formatStatusLabel(v)
  return v
}

/** Parse legacy `key=value; key=value` (or space-separated) traces into UI facts. */
export function parseTraceFacts(trace: string): RationaleFact[] {
  const text = trace.trim()
  if (!text || !text.includes("=")) return []

  // Normalize "tier=medium score=0.50" → semicolon-separated pairs.
  const normalized = text
    .replace(/,\s*(?=\w+=)/g, "; ")
    .replace(/\s+(?=\w[\w_]*=)/g, "; ")

  const chunks = normalized
    .split(/;\s*/)
    .map((part) => part.trim())
    .filter(Boolean)

  const facts: RationaleFact[] = []
  for (const chunk of chunks) {
    const eq = chunk.indexOf("=")
    const colon = chunk.indexOf(":")
    let key = ""
    let raw = ""
    if (eq > 0 && (colon < 0 || eq < colon)) {
      key = chunk.slice(0, eq).trim()
      raw = chunk.slice(eq + 1).trim()
    } else if (colon > 0 && !chunk.includes("=")) {
      key = chunk.slice(0, colon).trim()
      raw = chunk.slice(colon + 1).trim()
    } else {
      continue
    }
    // Drop leading prose glued to the first key ("Financial risk tier").
    const keyParts = key.split(/\s+/)
    key = keyParts[keyParts.length - 1] ?? key
    raw = raw.replace(/^\[|\]$/g, "").replaceAll("'", "").replaceAll('"', "")
    if (!key || !raw) continue
    const normalizedKey = key.toLowerCase().replaceAll(" ", "_")
    if (normalizedKey.length < 2) continue
    facts.push({
      key: normalizedKey,
      label: FACT_LABELS[normalizedKey] ?? formatStatusLabel(normalizedKey),
      value: formatParsedValue(normalizedKey, raw),
      tone: inferFactTone(normalizedKey, raw),
      detail: raw !== formatParsedValue(normalizedKey, raw) ? raw : null,
    })
  }
  return facts
}

/** Short critic / envelope flags for the lender queue. */
export function extractReviewFlags(result: UnderwriteResult): string[] {
  const flags: string[] = []
  const seen = new Set<string>()
  const add = (label: string) => {
    const trimmed = label.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    flags.push(trimmed)
  }

  const routing = result.decision.program_routing ?? result.program_routing
  if (routing && !routing.eligibility_gate_pass) add("Eligibility")
  if (routing && !routing.compliance_floor_pass) add("Compliance")
  if (result.decision.ceiling_triggered) add("Risk ceiling")
  if (result.decision.risk_tier === "prohibited") add("Prohibited")
  if (result.decision.risk_tier === "high") add("High risk")

  const critic = result.subagent_outputs?.critic
  if (critic?.hard_reject) add("Hard reject")
  for (const section of result.decision.rationale?.sections ?? []) {
    if (section.kind !== "critic" && section.kind !== "envelope") continue
    for (const fact of section.facts ?? []) {
      if (fact.tone === "fail") add(fact.label)
    }
  }
  for (const action of result.decision.improvement_actions ?? []) {
    if (action.priority === "high") add(action.title)
  }
  return flags.slice(0, 3)
}
