"use client"

import * as React from "react"

import {
  CitationChips,
} from "@/components/playground/citation-drawer"
import { demoSpotlightClass } from "@/components/playground/demo-tour"
import { HitlBar } from "@/components/playground/hitl-bar"
import {
  PolicyResultsTable,
  buildPolicyRows,
} from "@/components/playground/policy-results-table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useGoldSetQuery } from "@/hooks/use-gold-set"
import { DEMO_STEPS, firstSbaCitationIndex } from "@/lib/demo-tour"
import {
  formatCurrency,
  formatLender,
  formatProgram,
  formatStatusLabel,
  friendlyDecision,
  normalizeRationale,
  outcomeTone,
  parseTraceFacts,
  type DecisionRationale,
  type ImprovementAction,
  type ImprovementPriority,
  type RationaleFact,
  type RationaleFactTone,
  type RationaleSection,
  type UnderwriteApplicantPayload,
  type UnderwriteResult,
} from "@/lib/underwrite"
import { cn } from "@/lib/utils"
import { useCitationViewerStore } from "@/stores/citation-viewer-store"
import { useDemoTourStore } from "@/stores/demo-tour-store"

type MetricGaugeProps = {
  label: string
  status: string
  statusTone?: "pass" | "fail" | "warn" | "neutral"
  valueLabel: string
  fill: number
  markerLabel?: string
  marker?: number
}

function MetricGauge({
  label,
  status,
  statusTone = "neutral",
  valueLabel,
  fill,
  markerLabel,
  marker,
}: MetricGaugeProps) {
  const clamped = Math.max(0, Math.min(1, fill))
  const markerPct =
    marker == null ? null : Math.max(0, Math.min(1, marker)) * 100

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </p>
        <span
          className={cn(
            "text-[11px] font-semibold tracking-[0.12em] uppercase",
            statusTone === "pass" && "text-emerald-700 dark:text-emerald-400",
            statusTone === "fail" && "text-red-600 dark:text-red-400",
            statusTone === "warn" && "text-amber-700 dark:text-amber-400",
            statusTone === "neutral" && "text-muted-foreground"
          )}
        >
          {status}
        </span>
      </div>
      <p className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
        {valueLabel}
      </p>
      <div className="relative pt-1">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              statusTone === "fail"
                ? "bg-red-600/80 dark:bg-red-500/70"
                : statusTone === "warn"
                  ? "bg-amber-600/80 dark:bg-amber-500/70"
                  : "bg-emerald-800 dark:bg-emerald-500"
            )}
            style={{ width: `${clamped * 100}%` }}
          />
        </div>
        {markerPct != null && markerLabel ? (
          <div
            className="absolute top-0 -translate-x-1/2"
            style={{ left: `${markerPct}%` }}
          >
            <div className="mx-auto h-3 w-px bg-foreground/40" />
            <p className="mt-1 whitespace-nowrap text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              {markerLabel}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function GatePill({ label, pass }: { label: string; pass: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide",
        pass
          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          pass ? "bg-emerald-600" : "bg-red-500"
        )}
      />
      {label} · {pass ? "Pass" : "Fail"}
    </span>
  )
}

function toneClass(tone: RationaleFactTone | undefined) {
  switch (tone) {
    case "pass":
      return "text-emerald-700 dark:text-emerald-400"
    case "fail":
      return "text-red-600 dark:text-red-400"
    case "warn":
      return "text-amber-700 dark:text-amber-400"
    case "info":
      return "text-sky-700 dark:text-sky-400"
    default:
      return "text-foreground"
  }
}

function toneDot(tone: RationaleFactTone | undefined) {
  switch (tone) {
    case "pass":
      return "bg-emerald-600"
    case "fail":
      return "bg-red-500"
    case "warn":
      return "bg-amber-500"
    case "info":
      return "bg-sky-500"
    default:
      return "bg-muted-foreground/50"
  }
}

function FactList({ facts }: { facts: RationaleFact[] }) {
  if (facts.length === 0) return null
  return (
    <dl className="divide-y divide-border/70 overflow-hidden rounded-lg border bg-background/70">
      {facts.map((fact) => (
        <div
          key={fact.key}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 px-3 py-2.5"
        >
          <dt className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn("size-1.5 shrink-0 rounded-full", toneDot(fact.tone))}
            />
            <span className="truncate">{fact.label}</span>
          </dt>
          <dd
            className={cn(
              "text-right text-sm font-medium tabular-nums capitalize",
              toneClass(fact.tone)
            )}
            title={fact.detail ?? undefined}
          >
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function isMachineTrace(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (t.includes("=")) return true
  if (/\[['\"]/.test(t)) return true
  if (/^[A-Z_]+:\s*\w+/.test(t)) return true
  if (/;\s*\w+=/.test(t)) return true
  return false
}

const NARRATIVE_STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "now",
  "are",
  "was",
  "were",
  "has",
  "have",
  "not",
  "but",
  "via",
])

/** True when body mostly restates values already shown in the fact list. */
function isRedundantWithFacts(body: string, facts: RationaleFact[]): boolean {
  if (!body.trim() || facts.length === 0) return false

  const factText = facts
    .flatMap((f) => [f.label, f.value, f.detail ?? "", f.key])
    .join(" ")
    .toLowerCase()

  const tokens =
    body
      .toLowerCase()
      .match(/[a-z0-9]+(?:\.[0-9]+)?%?x?/g)
      ?.filter((t) => t.length > 1 && !NARRATIVE_STOP.has(t)) ?? []

  if (tokens.length === 0) return true

  const covered = tokens.filter((token) => {
    if (factText.includes(token)) return true
    // "0.50" vs "50%", "1.35x" vs "1.35"
    const bare = token.replace(/%|x$/g, "")
    return bare.length > 1 && factText.includes(bare)
  }).length

  return covered / tokens.length >= 0.55
}

function SectionBody({ section }: { section: RationaleSection }) {
  const facts =
    section.facts && section.facts.length > 0
      ? section.facts
      : parseTraceFacts(section.body)

  const rawBody = section.body.trim()
  const narrative =
    rawBody &&
    !isMachineTrace(rawBody) &&
    !isRedundantWithFacts(rawBody, facts)
      ? rawBody
      : null

  return (
    <div className="space-y-3">
      {narrative ? (
        <p className="text-sm leading-relaxed text-foreground/90">{narrative}</p>
      ) : null}
      <FactList facts={facts} />
      {!narrative && facts.length === 0 && rawBody ? (
        <p className="text-sm leading-relaxed text-foreground/90">{rawBody}</p>
      ) : null}
    </div>
  )
}

function RationaleView({
  rationale: raw,
}: {
  rationale: DecisionRationale | string | null | undefined
}) {
  const rationale = normalizeRationale(raw)
  const uniqueSections = rationale.sections.filter(
    (section, index, all) =>
      !(
        section.body === rationale.summary &&
        (!section.facts || section.facts.length === 0) &&
        all.findIndex((s) => s.body === section.body) === index &&
        all.length === 1
      )
  )

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Rationale
        </p>
        <p className="font-heading text-lg font-medium tracking-tight text-balance">
          {rationale.summary || "No summary"}
        </p>
      </div>
      {uniqueSections.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {uniqueSections.map((section, index) => (
            <div
              key={`${section.kind}-${section.title}-${index}`}
              className="space-y-3 rounded-xl border bg-muted/20 px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {section.title}
                </p>
                {formatStatusLabel(section.kind).toLowerCase() !==
                section.title.trim().toLowerCase() ? (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {formatStatusLabel(section.kind)}
                  </Badge>
                ) : null}
              </div>
              <SectionBody section={section} />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function UnderwriteResultView({
  result,
  applicant,
  loading,
}: {
  result: UnderwriteResult | null
  applicant: UnderwriteApplicantPayload | null
  loading?: boolean
}) {
  const { catalog } = useGoldSetQuery()
  const openCitations = useCitationViewerStore((s) => s.open)
  const tourCitation = useDemoTourStore((s) => s.citationIndex)
  const tourActive = useDemoTourStore((s) => s.active)
  const tourSpotlight = useDemoTourStore(
    (s) => DEMO_STEPS[s.stepIndex]?.spotlight
  )

  React.useEffect(() => {
    if (tourCitation == null || !result?.citations.length) return
    openCitations(result.citations, firstSbaCitationIndex(result.citations))
  }, [openCitations, result, tourCitation])

  if (loading && !result) {
    return (
      <div className="space-y-8 p-1">
        <div className="space-y-3">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-52" />
        </div>
        <Skeleton className="h-14 w-48" />
        <div className="grid gap-8 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    )
  }

  if (!result || !applicant) {
    return (
      <div className="flex min-h-48 flex-col justify-center rounded-xl border border-dashed px-6 py-10 text-sm text-muted-foreground">
        <p className="font-heading text-lg font-medium text-foreground">
          No decision yet
        </p>
        <p className="mt-1 max-w-md">
          Choose a labeled case or edit the applicant, then run a review. The
          result stays on this page while you look around.
        </p>
      </div>
    )
  }

  const gold =
    catalog?.cases.find((row) => row.case_id === result.case_id) ?? null

  const { decision } = result
  const routing = result.program_routing ?? decision.program_routing
  const financial = result.subagent_outputs.financial_analysis
  const metrics = financial?.metrics ?? null
  const composite = decision.composite_score
  const escalationRationale = result.escalation
    ? normalizeRationale(result.escalation.rationale)
    : null
  const policyRows = buildPolicyRows(result, applicant, gold)

  const tone = outcomeTone(decision.outcome)
  const dscr = metrics?.debt_service_coverage ?? null
  const dti = metrics?.debt_to_income ?? null
  const riskScore = metrics?.risk_score ?? null
  const compositeScore = composite?.composite ?? null

  const dscrMin = 1.2
  const dscrFill = dscr == null ? 0 : Math.min(dscr / 2, 1)
  const dtiFill = dti == null ? 0 : Math.min(dti / 1, 1)
  const riskFill = riskScore == null ? 0 : 1 - riskScore

  const metaBits = [
    applicant.industry,
    applicant.requested_program
      ? formatProgram(applicant.requested_program)
      : null,
    applicant.lender_id ? formatLender(applicant.lender_id) : null,
    `${applicant.years_in_business} yrs`,
  ]
    .filter((bit): bit is string => Boolean(bit) && bit !== "—")
    .map((bit) => bit.toUpperCase())

  return (
    <div className={cn("space-y-8", loading && "opacity-60")}>
      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {applicant.business_name}
          </h2>
          <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            {metaBits.join(" · ")}
          </p>
        </div>

        <p
          className={cn(
            "flex items-center gap-2 text-sm font-semibold tracking-[0.14em] uppercase",
            tone === "approve" && "text-emerald-700 dark:text-emerald-400",
            tone === "deny" && "text-red-600 dark:text-red-400",
            tone === "escalate" && "text-amber-700 dark:text-amber-400",
            tone === "neutral" && "text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              tone === "approve" && "bg-emerald-600",
              tone === "deny" && "bg-red-500",
              tone === "escalate" && "bg-amber-500",
              tone === "neutral" && "bg-muted-foreground"
            )}
          />
          Recommendation · {friendlyDecision(decision.outcome)}
          {gold ? ` · expected ${friendlyDecision(gold.gold_outcome).toLowerCase()}` : ""}
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-8">
        <div>
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Requested amount
          </p>
          <p className="font-heading mt-1 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
            {formatCurrency(applicant.requested_loan_amount)}
          </p>
        </div>
        <Separator orientation="vertical" className="hidden h-14 sm:block" />
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Risk tier
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight capitalize">
              {formatStatusLabel(decision.risk_tier)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Program
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight">
              {formatProgram(routing?.recommended_program)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Latency
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
              {result.latency_ms != null
                ? `${Math.round(result.latency_ms)} ms`
                : "—"}
            </p>
          </div>
        </div>
      </section>

      {routing ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-semibold tracking-tight">
                Program routing
              </p>
              <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                Compliance · eligibility · product fit
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              {result.case_id}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <GatePill
              label="Compliance floor"
              pass={routing.compliance_floor_pass}
            />
            <GatePill
              label="Eligibility gate"
              pass={routing.eligibility_gate_pass}
            />
            {routing.eligible_programs.length > 0 ? (
              routing.eligible_programs.map((program) => (
                <Badge key={program} variant="secondary">
                  {formatProgram(program)}
                </Badge>
              ))
            ) : (
              <Badge variant="outline">No eligible programs</Badge>
            )}
          </div>
        </section>
      ) : null}

      <PolicyResultsTable rows={policyRows} />

      <section className="grid gap-8 border-y py-6 sm:grid-cols-3">
        <MetricGauge
          label="Base DSCR"
          status={
            dscr == null ? "n/a" : dscr >= dscrMin ? "Pass" : "Below min"
          }
          statusTone={
            dscr == null ? "neutral" : dscr >= dscrMin ? "pass" : "fail"
          }
          valueLabel={dscr == null ? "—" : `${dscr.toFixed(2)}x`}
          fill={dscrFill}
          marker={dscrMin / 2}
          markerLabel={`Min ${dscrMin.toFixed(2)}x`}
        />
        <MetricGauge
          label="Loan / revenue"
          status={
            dti == null
              ? "n/a"
              : dti <= 0.5
                ? "Pass"
                : dti <= 0.75
                  ? "Watch"
                  : "High"
          }
          statusTone={
            dti == null
              ? "neutral"
              : dti <= 0.5
                ? "pass"
                : dti <= 0.75
                  ? "warn"
                  : "fail"
          }
          valueLabel={dti == null ? "—" : `${(dti * 100).toFixed(0)}%`}
          fill={dtiFill}
          marker={0.5}
          markerLabel="Max 50%"
        />
        <MetricGauge
          label="Financial strength"
          status={
            riskScore == null
              ? "n/a"
              : riskScore <= 0.35
                ? "Strong"
                : riskScore <= 0.65
                  ? "Moderate"
                  : "Weak"
          }
          statusTone={
            riskScore == null
              ? "neutral"
              : riskScore <= 0.35
                ? "pass"
                : riskScore <= 0.65
                  ? "warn"
                  : "fail"
          }
          valueLabel={
            compositeScore != null
              ? `${Math.round(compositeScore * 100)}`
              : riskScore != null
                ? `${Math.round((1 - riskScore) * 100)}`
                : "—"
          }
          fill={compositeScore ?? riskFill}
          marker={0.5}
          markerLabel="Mid"
        />
      </section>

      <RationaleView rationale={decision.rationale} />

      {(decision.improvement_actions?.length ?? 0) > 0 ? (
        <ImprovementActionsView
          actions={decision.improvement_actions as ImprovementAction[]}
        />
      ) : decision.term_modifications.length > 0 ? (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Term modifications
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-foreground/90">
            {decision.term_modifications.map((mod) => (
              <li key={mod}>{mod}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {decision.adverse_action_reasons.length > 0 ? (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Adverse action reasons
          </p>
          <ul className="space-y-2">
            {decision.adverse_action_reasons.map((reason) => (
              <li
                key={reason.reason_code}
                className="rounded-lg border bg-muted/40 px-3 py-2 text-sm"
              >
                <span className="font-medium">
                  {formatStatusLabel(reason.reason_code)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {reason.description}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.escalation ? (
        <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-amber-800 uppercase dark:text-amber-300">
            Escalation package
          </p>
          <p className="text-sm font-medium">{result.escalation.reason}</p>
          {escalationRationale?.summary ? (
            <p className="text-sm text-muted-foreground">
              {escalationRationale.summary}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {result.escalation.financial_summary ? (
              <div className="space-y-2 rounded-lg border border-amber-200/70 bg-background/60 px-3 py-2.5 dark:border-amber-900/40">
                <p className="text-[10px] font-semibold tracking-[0.12em] uppercase">
                  Financial
                </p>
                <SectionBody
                  section={{
                    kind: "financial",
                    title: "Financial",
                    body: result.escalation.financial_summary,
                    facts: parseTraceFacts(result.escalation.financial_summary),
                  }}
                />
              </div>
            ) : null}
            {result.escalation.compliance_summary ? (
              <div className="space-y-2 rounded-lg border border-amber-200/70 bg-background/60 px-3 py-2.5 dark:border-amber-900/40">
                <p className="text-[10px] font-semibold tracking-[0.12em] uppercase">
                  Compliance
                </p>
                <SectionBody
                  section={{
                    kind: "policy",
                    title: "Compliance",
                    body: result.escalation.compliance_summary,
                    facts: parseTraceFacts(
                      result.escalation.compliance_summary
                    ),
                  }}
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {result.citations.length > 0 ? (
        <section
          data-demo="citations"
          className={cn(
            "space-y-3 border-t pt-6",
            demoSpotlightClass(tourActive && tourSpotlight === "citations")
          )}
        >
          <div>
            <p className="text-sm font-semibold tracking-tight">
              Source clauses
            </p>
            <p className="text-xs text-muted-foreground">
              Open a clause to see it on the source page.
            </p>
          </div>
          <CitationChips
            citations={result.citations}
            onSelect={(index) => openCitations(result.citations, index)}
          />
        </section>
      ) : null}

      <div
        data-demo="hitl"
        className={demoSpotlightClass(tourActive && tourSpotlight === "hitl")}
      >
        <HitlBar
          caseId={result.case_id}
          agentOutcome={decision.outcome}
          gold={gold}
        />
      </div>
    </div>
  )
}

function priorityTone(priority: ImprovementPriority) {
  switch (priority) {
    case "high":
      return "fail" as const
    case "medium":
      return "warn" as const
    default:
      return "info" as const
  }
}

function ImprovementActionsView({
  actions,
}: {
  actions: ImprovementAction[]
}) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          How to improve approval odds
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Concrete changes that would move this file closer to auto-approve.
        </p>
      </div>
      <div className="space-y-2">
        {actions.map((action) => (
          <div
            key={`${action.area}-${action.title}`}
            className="rounded-xl border bg-muted/20 px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase",
                  toneClass(priorityTone(action.priority))
                )}
              >
                {formatStatusLabel(action.priority)}
              </Badge>
              <Badge variant="secondary" className="text-[10px] capitalize">
                {formatStatusLabel(action.area)}
              </Badge>
            </div>
            <p className="mt-2 text-sm font-medium tracking-tight">
              {action.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {action.detail}
            </p>
            {action.target ? (
              <p className="mt-2 font-mono text-[11px] text-foreground/80">
                Target · {action.target}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

