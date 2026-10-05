"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { DeskPersonaSeams } from "@/components/borrower-request"
import {
  demoSpotlightClass,
} from "@/components/playground/demo-tour"
import { GoldSetQueue } from "@/components/playground/gold-set-queue"
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
import { useGoldSetQuery } from "@/hooks/use-gold-set"
import { useUnderwriteQuery } from "@/hooks/use-underwrite"
import {
  formatIndustryLabel,
  GOLD_SET_INDUSTRIES,
  INELIGIBLE_INDUSTRIES,
} from "@/lib/industries"
import { DEMO_STEPS } from "@/lib/demo-tour"
import { cn } from "@/lib/utils"
import { useCaseSessionStore } from "@/stores/case-session-store"
import { useDemoTourStore } from "@/stores/demo-tour-store"
import { useUnderwriteStore } from "@/stores/underwrite-store"

export function UnderwritePanel() {
  const form = useUnderwriteStore((s) => s.form)
  const formOpen = useUnderwriteStore((s) => s.formOpen)
  const selectedCaseId = useUnderwriteStore((s) => s.selectedCaseId)
  const updateField = useUnderwriteStore((s) => s.updateField)
  const setFormOpen = useUnderwriteStore((s) => s.setFormOpen)
  const clearResults = useUnderwriteStore((s) => s.clearResults)
  const recordOutcome = useUnderwriteStore((s) => s.recordOutcome)
  const loadGoldCase = useUnderwriteStore((s) => s.loadGoldCase)
  const focusSessionCase = useUnderwriteStore((s) => s.focusSessionCase)
  const deskFocus = useCaseSessionStore((s) => s.deskFocus)
  const sessionCaseId = useCaseSessionStore((s) => s.caseId)
  const sessionApplicant = useCaseSessionStore((s) => s.applicant)
  const setDeskFocus = useCaseSessionStore((s) => s.setDeskFocus)
  const registerHandlers = useDemoTourStore((s) => s.registerHandlers)
  const tourActive = useDemoTourStore((s) => s.active)
  const tourSpotlight = useDemoTourStore(
    (s) => DEMO_STEPS[s.stepIndex]?.spotlight
  )

  React.useEffect(() => {
    if (tourActive) setFormOpen(false)
  }, [setFormOpen, tourActive])

  React.useEffect(() => {
    if (deskFocus !== "file") return
    function sync() {
      if (
        !useUnderwriteStore.persist.hasHydrated() ||
        !useCaseSessionStore.persist.hasHydrated()
      ) {
        return
      }
      focusSessionCase()
    }
    const unsubWrite = useUnderwriteStore.persist.onFinishHydration(sync)
    const unsubSession = useCaseSessionStore.persist.onFinishHydration(sync)
    sync()
    return () => {
      unsubWrite()
      unsubSession()
    }
  }, [deskFocus, sessionCaseId, focusSessionCase])
  const { catalog } = useGoldSetQuery()

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
      const data = await run({ force: true })
      const caseId = selectedCaseId ?? data.case_id
      if (caseId && data.decision?.outcome) {
        recordOutcome(caseId, data)
      }
      return data
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err))
      setFormOpen(true)
      throw err
    }
  }

  const onDemoLoadRun = React.useCallback(
    async (caseId: string) => {
      const row = catalog?.cases.find((item) => item.case_id === caseId)
      if (!row) {
        throw new Error(`Demo file ${caseId} is not in the gold-set catalog.`)
      }
      loadGoldCase(row)
      setLocalError(null)
      try {
        const data = await run({ force: true })
        const id = caseId || data.case_id
        if (id && data.decision?.outcome) {
          recordOutcome(id, data)
        }
        setFormOpen(false)
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : String(err))
        setFormOpen(true)
        throw err
      }
    },
    [catalog?.cases, loadGoldCase, recordOutcome, run, setFormOpen]
  )

  React.useEffect(() => {
    registerHandlers({ loadRun: onDemoLoadRun })
    return () => registerHandlers({ loadRun: null })
  }, [onDemoLoadRun, registerHandlers])

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
  const fileFocus =
    deskFocus === "file" && Boolean(sessionCaseId && sessionApplicant)
  const showCatalog = tourActive ? tourSpotlight === "queue" : !fileFocus

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {fileFocus
              ? sessionApplicant?.business_name ?? "Underwrite"
              : "Underwrite"}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {tourActive
              ? "Cedar Ridge is selected. The review is finished. Record the decision here."
              : fileFocus
                ? `Same application as the applicant page · ${sessionCaseId}.`
                : "Choose a labeled case or edit the form, then run a review."}
          </p>
        </div>
        {fileFocus && !tourActive ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDeskFocus("catalog")}
          >
            All labeled cases
          </Button>
        ) : null}
      </div>

      {showCatalog ? (
      <div
        data-demo="queue"
        className={demoSpotlightClass(
          tourActive && tourSpotlight === "queue"
        )}
      >
        <GoldSetQueue />
      </div>
      ) : null}

      {tourActive ? null : <DeskPersonaSeams />}

      <Collapsible open={formOpen} onOpenChange={setFormOpen}>
        <Card className="gap-0 py-0">
          <CollapsibleTrigger className="w-full text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <CardHeader className="border-b py-(--card-spacing)">
              <CardTitle>Applicant</CardTitle>
              <CardDescription>
                {locked
                  ? "Form locked while the review is running."
                  : formOpen
                    ? "Practice fields only. No real applicant data."
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
              {locked ? "Reviewing…" : "Run review"}
            </Button>
          </CardFooter>
        </Card>
      </Collapsible>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Decision packet
          </h2>
          <p className="text-sm text-muted-foreground">
            The recommendation, the policy checks, the source clauses, and the
            decision saved on this case.
          </p>
        </div>
        <div
          data-demo="memo"
          className={cn(
            "rounded-2xl border bg-card px-5 py-6 sm:px-8 sm:py-8",
            demoSpotlightClass(tourActive && tourSpotlight === "memo")
          )}
        >
          <UnderwriteResultView
            result={result}
            applicant={
              activeRun?.applicant ??
              (fileFocus ? sessionApplicant : null)
            }
            loading={isRunning}
          />
        </div>
      </section>

    </div>
  )
}
