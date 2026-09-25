"use client"

import {
  formatProgram,
  formatStatusLabel,
  type GoldSetCase,
  type UnderwriteApplicantPayload,
  type UnderwriteResult,
} from "@/lib/underwrite"
import { cn } from "@/lib/utils"

type PolicyTone = "pass" | "fail" | "warn"
type PolicySeverity = "high" | "medium" | "low"

export type PolicyRow = {
  id: string
  rule: string
  expected: string
  actual: string
  outcome: PolicyTone
  severity: PolicySeverity
}

const DSCR_MIN = 1.2
const LOAN_REVENUE_MAX = 0.5
const RISK_CEILING = 0.75
const REVIEW_THRESHOLD = 0.75

function toneClass(tone: PolicyTone) {
  return cn(
    tone === "pass" && "text-emerald-700 dark:text-emerald-400",
    tone === "fail" && "text-red-600 dark:text-red-400",
    tone === "warn" && "text-amber-700 dark:text-amber-400"
  )
}

export function buildPolicyRows(
  result: UnderwriteResult,
  applicant: UnderwriteApplicantPayload,
  gold: GoldSetCase | null
): PolicyRow[] {
  const { decision } = result
  const routing = result.program_routing ?? decision.program_routing
  const financial = result.subagent_outputs.financial_analysis
  const policy = result.subagent_outputs.policy_compliance
  const metrics = financial?.metrics ?? null
  const dscr = metrics?.debt_service_coverage ?? applicant.debt_service_coverage_ratio
  const dti = metrics?.debt_to_income ?? null
  const riskScore = metrics?.risk_score ?? null
  const composite = decision.composite_score?.composite ?? null
  const criticNotes = result.escalation?.critic_notes?.trim() ?? ""

  const rows: PolicyRow[] = []

  if (routing) {
    rows.push({
      id: "compliance",
      rule: "Compliance floor",
      expected: "Pass",
      actual: routing.compliance_floor_pass ? "Pass" : "Fail",
      outcome: routing.compliance_floor_pass ? "pass" : "fail",
      severity: "high",
    })
    rows.push({
      id: "eligibility",
      rule: "Eligibility gate",
      expected: "Pass",
      actual: routing.eligibility_gate_pass ? "Pass" : "Fail",
      outcome: routing.eligibility_gate_pass ? "pass" : "fail",
      severity: "high",
    })

    const expectedProgram = gold?.gold_program
      ? formatProgram(gold.gold_program)
      : "At least one eligible"
    const actualPrograms =
      routing.eligible_programs.length > 0
        ? routing.eligible_programs.map(formatProgram).join(", ")
        : "None"
    const programMatch = gold?.gold_program
      ? routing.recommended_program === gold.gold_program ||
        routing.eligible_programs.includes(gold.gold_program)
      : routing.eligible_programs.length > 0
    rows.push({
      id: "program",
      rule: "Eligible program",
      expected: expectedProgram,
      actual: routing.recommended_program
        ? `${formatProgram(routing.recommended_program)} · ${actualPrograms}`
        : actualPrograms,
      outcome: programMatch ? "pass" : "fail",
      severity: "medium",
    })
  }

  rows.push({
    id: "dscr",
    rule: "DSCR envelope",
    expected: `≥ ${DSCR_MIN.toFixed(2)}x`,
    actual: dscr == null ? "Missing" : `${dscr.toFixed(2)}x`,
    outcome:
      dscr == null ? "warn" : dscr >= DSCR_MIN ? "pass" : dscr >= 1.15 ? "warn" : "fail",
    severity: "high",
  })

  rows.push({
    id: "leverage",
    rule: "Loan / revenue",
    expected: `≤ ${(LOAN_REVENUE_MAX * 100).toFixed(0)}%`,
    actual: dti == null ? "n/a" : `${(dti * 100).toFixed(0)}%`,
    outcome:
      dti == null ? "warn" : dti <= LOAN_REVENUE_MAX ? "pass" : dti <= 0.75 ? "warn" : "fail",
    severity: "medium",
  })

  rows.push({
    id: "ceiling",
    rule: "Risk ceiling",
    expected: `< ${RISK_CEILING.toFixed(2)}`,
    actual:
      riskScore == null
        ? "n/a"
        : `${riskScore.toFixed(2)}${decision.ceiling_triggered ? " · triggered" : ""}`,
    outcome:
      decision.ceiling_triggered || (riskScore != null && riskScore >= RISK_CEILING)
        ? "fail"
        : riskScore == null
          ? "warn"
          : "pass",
    severity: "high",
  })

  if (composite != null) {
    rows.push({
      id: "review",
      rule: "Composite / review",
      expected: `≥ ${Math.round(REVIEW_THRESHOLD * 100)} to auto-decide`,
      actual: `${Math.round(composite * 100)}`,
      outcome: composite >= REVIEW_THRESHOLD ? "pass" : "warn",
      severity: "medium",
    })
  }

  if (policy?.hard_reject) {
    rows.push({
      id: "hard-reject",
      rule: "Hard reject",
      expected: "None",
      actual: policy.hard_reject_reason || "Triggered",
      outcome: "fail",
      severity: "high",
    })
  }

  if (criticNotes) {
    rows.push({
      id: "critic",
      rule: "Critic",
      expected: "No unresolved deficiencies",
      actual: criticNotes,
      outcome: "warn",
      severity: "medium",
    })
  }

  return rows
}

export function PolicyResultsTable({ rows }: { rows: PolicyRow[] }) {
  if (rows.length === 0) return null
  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-semibold tracking-tight">Policy results</p>
        <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
          Expected vs actual · engine envelope
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Rule</th>
              <th className="px-3 py-2.5 font-semibold">Expected</th>
              <th className="px-3 py-2.5 font-semibold">Actual</th>
              <th className="px-3 py-2.5 font-semibold">Outcome</th>
              <th className="px-3 py-2.5 font-semibold">Severity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-2.5 font-medium">{row.rule}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.expected}</td>
                <td className="px-3 py-2.5">{row.actual}</td>
                <td
                  className={cn(
                    "px-3 py-2.5 text-xs font-semibold uppercase",
                    toneClass(row.outcome)
                  )}
                >
                  {formatStatusLabel(row.outcome)}
                </td>
                <td className="px-3 py-2.5 text-xs uppercase text-muted-foreground">
                  {formatStatusLabel(row.severity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
