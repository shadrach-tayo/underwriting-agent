"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { UnderwriteResultView } from "@/components/playground/underwrite-result"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useUnderwriteQuery } from "@/hooks/use-underwrite"
import {
  formatIndustryLabel,
  GOLD_SET_INDUSTRIES,
  INELIGIBLE_INDUSTRIES,
} from "@/lib/industries"
import { cn } from "@/lib/utils"
import { useUnderwriteStore } from "@/stores/underwrite-store"

export function UnderwritePanel() {
  const form = useUnderwriteStore((s) => s.form)
  const formOpen = useUnderwriteStore((s) => s.formOpen)
  const updateField = useUnderwriteStore((s) => s.updateField)
  const setFormOpen = useUnderwriteStore((s) => s.setFormOpen)
  const clearResults = useUnderwriteStore((s) => s.clearResults)

  const { result, errorMessage, isRunning, activeRun, run } =
    useUnderwriteQuery()

  const [localError, setLocalError] = React.useState<string | null>(null)
  const locked = isRunning

  React.useEffect(() => {
    void useUnderwriteStore.persist.rehydrate()
  }, [])

  async function onRun() {
    setLocalError(null)
    try {
      await run({ force: true })
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err))
      setFormOpen(true)
    }
  }

  const displayError = localError ?? errorMessage
  const loanSummary = (() => {
    const n = Number(form.requested_loan_amount)
    if (!form.requested_loan_amount.trim() || !Number.isFinite(n)) return null
    return `$${n.toLocaleString()}`
  })()
  const summaryBits = [
    form.business_name.trim() || "Untitled applicant",
    form.industry.trim() || null,
    loanSummary,
  ].filter(Boolean)

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Underwrite
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Submit a synthetic applicant to{" "}
          <code className="font-mono text-xs">POST /underwrite</code>. Draft
          form and last run persist across navigation; the decision always
          reflects the committed request.
        </p>
      </div>

      <Collapsible open={formOpen} onOpenChange={setFormOpen}>
        <Card className="gap-0 py-0">
          <CollapsibleTrigger className="w-full text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <CardHeader className="border-b py-(--card-spacing)">
              <CardTitle>Applicant</CardTitle>
              <CardDescription>
                {locked
                  ? "Form locked while the graph run is in flight."
                  : formOpen
                    ? "Synthetic / non-PII fields aligned with the graph Applicant model."
                    : summaryBits.join(" · ")}
              </CardDescription>
              <CardAction>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  strokeWidth={2}
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    formOpen && "rotate-180"
                  )}
                />
              </CardAction>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent className="overflow-hidden data-open:animate-accordion-down data-closed:animate-accordion-up">
            <CardContent className="space-y-5 py-(--card-spacing)">
              <fieldset
                disabled={locked}
                className="space-y-5 disabled:opacity-60"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="business_name">Business name</Label>
                    <Input
                      id="business_name"
                      value={form.business_name}
                      onChange={(e) =>
                        updateField("business_name", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Combobox
                      items={[...GOLD_SET_INDUSTRIES]}
                      value={form.industry || null}
                      onValueChange={(value) => {
                        updateField(
                          "industry",
                          typeof value === "string" ? value : ""
                        )
                      }}
                      disabled={locked}
                      autoHighlight
                    >
                      <ComboboxInput
                        id="industry"
                        placeholder="Search gold-set industries…"
                        className="w-full"
                        disabled={locked}
                        showClear={Boolean(form.industry)}
                      />
                      <ComboboxContent className="w-(--anchor-width)">
                        <ComboboxEmpty>No industries match.</ComboboxEmpty>
                        <ComboboxList>
                          {(industry) => (
                            <ComboboxItem key={industry} value={industry}>
                              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                <span className="truncate">
                                  {formatIndustryLabel(industry)}
                                </span>
                                {INELIGIBLE_INDUSTRIES.has(industry) ? (
                                  <span className="shrink-0 text-[10px] font-medium tracking-wide text-amber-700 uppercase dark:text-amber-400">
                                    Gate demo
                                  </span>
                                ) : null}
                              </span>
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="annual_revenue">Revenue</Label>
                    <Input
                      id="annual_revenue"
                      inputMode="decimal"
                      value={form.annual_revenue}
                      onChange={(e) =>
                        updateField("annual_revenue", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requested_loan_amount">Loan amount</Label>
                    <Input
                      id="requested_loan_amount"
                      inputMode="decimal"
                      value={form.requested_loan_amount}
                      onChange={(e) =>
                        updateField("requested_loan_amount", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="years_in_business">Years in biz</Label>
                    <Input
                      id="years_in_business"
                      inputMode="decimal"
                      value={form.years_in_business}
                      onChange={(e) =>
                        updateField("years_in_business", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="dscr">DSCR</Label>
                    <Input
                      id="dscr"
                      inputMode="decimal"
                      value={form.debt_service_coverage_ratio}
                      onChange={(e) =>
                        updateField(
                          "debt_service_coverage_ratio",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fico">FICO proxy</Label>
                    <Input
                      id="fico"
                      inputMode="numeric"
                      min={300}
                      max={850}
                      value={form.credit_score_proxy}
                      onChange={(e) =>
                        updateField("credit_score_proxy", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sbss">SBSS proxy</Label>
                    <Input
                      id="sbss"
                      inputMode="numeric"
                      min={0}
                      max={300}
                      value={form.sbss_proxy}
                      onChange={(e) =>
                        updateField("sbss_proxy", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requested_program">Program</Label>
                    <Select
                      value={form.requested_program || "none"}
                      disabled={locked}
                      onValueChange={(value) => {
                        if (value == null) return
                        updateField(
                          "requested_program",
                          value === "none"
                            ? ""
                            : (value as "sba_7a" | "cdfi_direct")
                        )
                      }}
                    >
                      <SelectTrigger id="requested_program" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="sba_7a">SBA 7(a)</SelectItem>
                        <SelectItem value="cdfi_direct">CDFI Direct</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lender_id">Lender</Label>
                    <Select
                      value={form.lender_id || "none"}
                      disabled={locked}
                      onValueChange={(value) => {
                        if (value == null) return
                        updateField(
                          "lender_id",
                          value === "none"
                            ? ""
                            : (value as "accion" | "frontier_7a")
                        )
                      }}
                    >
                      <SelectTrigger id="lender_id" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (generic)</SelectItem>
                        <SelectItem value="accion">Accion</SelectItem>
                        <SelectItem value="frontier_7a">
                          Frontier 7(a)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="has_bankruptcy"
                      checked={form.has_bankruptcy}
                      disabled={locked}
                      onCheckedChange={(checked) =>
                        updateField("has_bankruptcy", checked === true)
                      }
                    />
                    <Label htmlFor="has_bankruptcy" className="font-normal">
                      Bankruptcy
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="has_fraud"
                      checked={form.has_severe_fraud_alert}
                      disabled={locked}
                      onCheckedChange={(checked) =>
                        updateField("has_severe_fraud_alert", checked === true)
                      }
                    />
                    <Label htmlFor="has_fraud" className="font-normal">
                      Severe fraud alert
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                  />
                </div>
              </fieldset>
            </CardContent>
          </CollapsibleContent>

          {displayError ? (
            <div
              role="alert"
              className="border-t border-destructive/30 bg-destructive/5 px-(--card-spacing) py-2.5 text-sm text-destructive"
            >
              {displayError}
            </div>
          ) : null}

          <CardFooter className="justify-between gap-2">
            {activeRun ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={locked}
                onClick={() => {
                  clearResults()
                  setLocalError(null)
                }}
              >
                Clear result
              </Button>
            ) : (
              <span />
            )}
            <Button disabled={locked} onClick={() => void onRun()}>
              {locked ? "Running graph…" : "Run underwrite"}
            </Button>
          </CardFooter>
        </Card>
      </Collapsible>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Decision
          </h2>
          <p className="text-sm text-muted-foreground">
            Recommendation, routing gates, gauges, and structured rationale from
            the LangGraph run.
          </p>
        </div>
        <div className="rounded-2xl border bg-card px-5 py-6 sm:px-8 sm:py-8">
          <UnderwriteResultView
            result={result}
            applicant={activeRun?.applicant ?? null}
            loading={isRunning}
          />
        </div>
      </section>
    </div>
  )
}
