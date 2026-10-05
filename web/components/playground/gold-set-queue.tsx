"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useGoldSetQuery } from "@/hooks/use-gold-set"
import {
  formatCurrency,
  formatProgram,
  formatStatusLabel,
  formatTenureLabel,
  outcomeTone,
  type DecisionOutcome,
  type GoldSetCase,
} from "@/lib/underwrite"
import { officerDecisionLabel } from "@/lib/case-session"
import { cn } from "@/lib/utils"
import {
  useUnderwriteStore,
  type LastRunRecord,
} from "@/stores/underwrite-store"

const FILTERS: { value: "all" | DecisionOutcome; label: string }[] = [
  { value: "all", label: "All" },
  { value: "approve", label: "Approve" },
  { value: "deny", label: "Deny" },
  { value: "escalate", label: "Escalate" },
]

function toneClass(outcome: string | null | undefined) {
  const tone = outcomeTone(outcome)
  return cn(
    tone === "approve" && "text-emerald-700 dark:text-emerald-400",
    tone === "deny" && "text-red-600 dark:text-red-400",
    tone === "escalate" && "text-amber-700 dark:text-amber-400",
    tone === "neutral" && "text-muted-foreground"
  )
}

export function GoldSetQueue() {
  const { catalog, isLoading, errorMessage } = useGoldSetQuery()
  const selectedCaseId = useUnderwriteStore((s) => s.selectedCaseId)
  const lastOutcomes = useUnderwriteStore((s) => s.lastOutcomes)
  const hitlDecisions = useUnderwriteStore((s) => s.hitlDecisions)
  const loadGoldCase = useUnderwriteStore((s) => s.loadGoldCase)

  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["value"]>(
    "all"
  )
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    setReady(true)
  }, [])

  const rows = React.useMemo(() => {
    const cases = catalog?.cases ?? []
    const q = query.trim().toLowerCase()
    return cases.filter((row) => {
      if (filter !== "all" && row.gold_outcome !== filter) return false
      if (!q) return true
      return (
        row.business_name.toLowerCase().includes(q) ||
        row.case_id.toLowerCase().includes(q) ||
        row.industry.toLowerCase().includes(q)
      )
    })
  }, [catalog?.cases, filter, query])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Gold-set queue
          </h2>
          <p className="text-sm text-muted-foreground">
            {catalog
              ? `${catalog.n_cases} labeled cases · ${catalog.counts.approve} approve · ${catalog.counts.deny} deny · ${catalog.counts.escalate} escalate`
              : "42 labeled cases from data/gold_set. Choose one to fill the form."}
          </p>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cases…"
          className="max-w-xs"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide uppercase",
              filter === item.value
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            {catalog && item.value !== "all"
              ? ` ${catalog.counts[item.value] ?? 0}`
              : catalog
                ? ` ${catalog.n_cases}`
                : ""}
          </button>
        ))}
      </div>

      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Borrower</th>
              <th className="px-3 py-2.5 font-semibold">Gold label</th>
              <th className="px-3 py-2.5 font-semibold">Program</th>
              <th className="px-3 py-2.5 font-semibold">Amount</th>
              <th className="px-3 py-2.5 font-semibold">Last run</th>
            </tr>
          </thead>
          <tbody>
            {!ready || isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td colSpan={5} className="px-3 py-3">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => (
                  <QueueRow
                    key={row.case_id}
                    row={row}
                    selected={selectedCaseId === row.case_id}
                    lastRun={lastOutcomes[row.case_id]}
                    flags={lastOutcomes[row.case_id]?.flags ?? []}
                    officer={hitlDecisions[row.case_id]?.outcome}
                    onSelect={() => loadGoldCase(row)}
                  />
                ))}
          </tbody>
        </table>
        {ready && !isLoading && rows.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground">
            No cases match that filter.
          </p>
        ) : null}
      </div>
    </section>
  )
}

function QueueRow({
  row,
  selected,
  lastRun,
  flags,
  officer,
  onSelect,
}: {
  row: GoldSetCase
  selected: boolean
  lastRun?: LastRunRecord
  flags: string[]
  officer?: LastRunRecord["outcome"]
  onSelect: () => void
}) {
  return (
    <tr
      className={cn(
        "cursor-pointer border-b last:border-0 hover:bg-muted/40",
        selected && "bg-muted/60"
      )}
    >
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={onSelect}
          className="block w-full text-start"
        >
          <span className="font-medium">{row.business_name}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {formatTenureLabel(row.years_in_business)} {row.industry}
            {" · "}
            {formatCurrency(row.requested_loan_amount)}
            {row.requested_program
              ? ` ${formatProgram(row.requested_program)}`
              : ""}
          </span>
        </button>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn("text-xs font-semibold uppercase", toneClass(row.gold_outcome))}>
          {formatStatusLabel(row.gold_outcome)}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs">
        {formatProgram(row.gold_program)}
      </td>
      <td className="px-3 py-2.5 tabular-nums">
        {formatCurrency(row.requested_loan_amount)}
      </td>
      <td className="px-3 py-2.5">
        {lastRun || officer ? (
          <div className="flex flex-wrap gap-1">
            {lastRun ? (
              <Badge
                variant="outline"
                className={cn("text-[10px]", toneClass(lastRun.outcome))}
              >
                {formatStatusLabel(lastRun.outcome)}
              </Badge>
            ) : null}
            {officer ? (
              <Badge
                variant="secondary"
                className={cn("text-[10px]", toneClass(officer))}
              >
                Officer {officerDecisionLabel(officer).toLowerCase()}
              </Badge>
            ) : null}
            {flags.map((flag) => (
              <Badge
                key={flag}
                variant="outline"
                className="text-[10px] text-amber-800 dark:text-amber-300"
              >
                {flag}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Not run</span>
        )}
      </td>
    </tr>
  )
}
