"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { ApplyAssistant } from "@/components/apply-assistant"
import { ApplySidebar } from "@/components/apply-sidebar"
import { DemoGraphOverlay } from "@/components/demo-graph-overlay"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { useGoldSetQuery } from "@/hooks/use-gold-set"
import { useUnderwriteQuery } from "@/hooks/use-underwrite"
import {
  APPLY_FORM_FIELDS,
  APPLY_STEPS,
  applyFormSchema,
  fieldsForStep,
  firstInvalidApplyStep,
  reviewChecks,
  toApplyFormValues,
  type ApplyFieldName,
  type ApplyFormValues,
} from "@/lib/apply-wizard"
import { EMPTY_APPLY_FORM, SAMPLE_FILES } from "@/lib/case-session"
import {
  formatIndustryLabel,
  GOLD_SET_INDUSTRIES,
  INELIGIBLE_INDUSTRIES,
} from "@/lib/industries"
import { formatCurrency } from "@/lib/underwrite"
import { cn } from "@/lib/utils"
import {
  useCaseSessionHydrated,
  useCaseSessionStore,
} from "@/stores/case-session-store"
import { useDemoTourStore } from "@/stores/demo-tour-store"
import { useUnderwriteStore } from "@/stores/underwrite-store"

export function ApplyWizard() {
  const router = useRouter()
  const form = useUnderwriteStore((s) => s.form)
  const updateField = useUnderwriteStore((s) => s.updateField)
  const replaceForm = useUnderwriteStore((s) => s.replaceForm)
  const loadGoldCase = useUnderwriteStore((s) => s.loadGoldCase)
  const recordOutcome = useUnderwriteStore((s) => s.recordOutcome)
  const selectedCaseId = useUnderwriteStore((s) => s.selectedCaseId)
  const { catalog } = useGoldSetQuery()
  const { run } = useUnderwriteQuery()

  const wizardStep = useCaseSessionStore((s) => s.wizardStep)
  const setWizardStep = useCaseSessionStore((s) => s.setWizardStep)
  const contactEmail = useCaseSessionStore((s) => s.contactEmail) ?? ""
  const setContactEmail = useCaseSessionStore((s) => s.setContactEmail)
  const setPersona = useCaseSessionStore((s) => s.setPersona)
  const beginBlankApply = useCaseSessionStore((s) => s.beginBlankApply)
  const caseId = useCaseSessionStore((s) => s.caseId)
  const registerHandlers = useDemoTourStore((s) => s.registerHandlers)
  const scoring = useDemoTourStore((s) => s.scoring)
  const tourActive = useDemoTourStore((s) => s.active)

  const applyValues = React.useMemo(
    () => toApplyFormValues(form, contactEmail),
    [contactEmail, form]
  )
  const methods = useForm<ApplyFormValues>({
    resolver: zodResolver(applyFormSchema),
    values: applyValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
    resetOptions: { keepErrors: true },
  })
  const { trigger, setValue, clearErrors, formState, getFieldState } = methods
  const errors = formState.errors

  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const hydrated = useCaseSessionHydrated()
  const startedEmpty = React.useRef(false)
  const skipScroll = React.useRef(true)

  React.useEffect(() => {
    if (!hydrated) return
    setPersona("applicant")
    const session = useCaseSessionStore.getState()
    const deskCaseId = useUnderwriteStore.getState().selectedCaseId
    if (
      !session.caseId &&
      !session.applicant &&
      !deskCaseId &&
      !startedEmpty.current
    ) {
      startedEmpty.current = true
      replaceForm(EMPTY_APPLY_FORM)
    }
  }, [hydrated, replaceForm, setPersona])

  const commit = React.useCallback(
    (name: ApplyFieldName, value: ApplyFormValues[ApplyFieldName]) => {
      if (name === "contact_email") {
        setContactEmail(String(value))
      } else if (name === "has_bankruptcy" || name === "has_severe_fraud_alert") {
        updateField(name, Boolean(value))
      } else {
        updateField(name, String(value))
      }
      setValue(name, value as ApplyFormValues[typeof name], {
        shouldDirty: true,
        shouldValidate: getFieldState(name).invalid,
      })
    },
    [getFieldState, setContactEmail, setValue, updateField]
  )

  const resetDraft = React.useCallback(() => {
    setWizardStep(0)
    clearErrors()
    setError(null)
  }, [clearErrors, setWizardStep])

  const submitApplication = React.useCallback(async () => {
    const valid = await trigger(APPLY_FORM_FIELDS)
    if (!valid) {
      setWizardStep(firstInvalidApplyStep(methods.formState.errors))
      throw new Error("Fix the highlighted fields before submitting.")
    }
    setError(null)
    setSubmitting(true)
    try {
      const data = await run({ force: true })
      const id = selectedCaseId ?? data.case_id
      if (id) recordOutcome(id, data)
      router.push("/portal")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      throw err
    } finally {
      setSubmitting(false)
    }
  }, [methods, recordOutcome, router, run, selectedCaseId, setWizardStep, trigger])

  const loadSample = React.useCallback(
    async (id: string) => {
      const row = catalog?.cases.find((item) => item.case_id === id)
      if (!row) throw new Error(`Sample ${id} is not in the gold-set catalog.`)
      setPersona("applicant")
      loadGoldCase(row)
      resetDraft()
    },
    [catalog?.cases, loadGoldCase, resetDraft, setPersona]
  )

  const playApply = React.useCallback(
    async (id: string) => {
      const row = catalog?.cases.find((item) => item.case_id === id)
      if (!row) throw new Error(`Sample ${id} is not in the gold-set catalog.`)
      beginBlankApply()
      replaceForm(EMPTY_APPLY_FORM)
      resetDraft()
      await wait(280)
      setPersona("applicant")
      loadGoldCase(row)
      setContactEmail("ops@cedarridge.example")
      for (let index = 0; index < APPLY_STEPS.length; index += 1) {
        setWizardStep(index)
        await wait(index === 0 ? 700 : 560)
      }
    },
    [
      beginBlankApply,
      catalog?.cases,
      loadGoldCase,
      replaceForm,
      resetDraft,
      setContactEmail,
      setPersona,
      setWizardStep,
    ]
  )

  React.useEffect(() => {
    registerHandlers({
      playApply: catalog ? playApply : null,
      submitApply: submitApplication,
    })
    return () => {
      registerHandlers({ playApply: null, submitApply: null })
    }
  }, [catalog, playApply, registerHandlers, submitApplication])

  async function onNext() {
    const valid = await trigger(fieldsForStep(wizardStep))
    if (!valid) {
      document
        .getElementById(`apply-step-${wizardStep}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }
    setError(null)
    setWizardStep(Math.min(wizardStep + 1, APPLY_STEPS.length - 1))
  }

  React.useEffect(() => {
    if (skipScroll.current) {
      skipScroll.current = false
      return
    }
    document
      .getElementById(`apply-step-${wizardStep}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [wizardStep])

  const samples = SAMPLE_FILES.map((sample) => ({
    ...sample,
    row: catalog?.cases.find((item) => item.case_id === sample.caseId),
  }))

  const sawRun = React.useRef(false)
  if (submitting) sawRun.current = true
  if (!scoring) sawRun.current = false

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 overflow-hidden bg-background">
      <DemoGraphOverlay
        active={scoring}
        done={sawRun.current && !submitting}
      />
      <ApplySidebar
        wizardStep={wizardStep}
        onStep={setWizardStep}
        tourActive={tourActive}
        samples={samples}
        selectedCaseId={selectedCaseId}
        onLoadSample={(id) => void loadSample(id)}
        onStartEmpty={() => {
          beginBlankApply()
          replaceForm(EMPTY_APPLY_FORM)
          useUnderwriteStore.setState({
            selectedCaseId: null,
            selectedApplicantId: null,
            activeRun: null,
          })
          resetDraft()
        }}
      />

      <form
        noValidate
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          tourActive && "pb-28"
        )}
        onSubmit={(event) => {
          event.preventDefault()
          if (wizardStep < APPLY_STEPS.length - 1) void onNext()
          else void submitApplication()
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-10 lg:px-12">
          <div className="w-full min-w-0 max-w-5xl">
            <ApplyStep index={0} current={wizardStep}>
              <ApplySection
                title={APPLY_STEPS[0].title}
                description={APPLY_STEPS[0].description}
              >
                <FieldGrid>
                  <ApplyTextField
                    name="business_name"
                    label="Business name"
                    required
                    placeholder="Cedar Ridge Fabrication"
                    error={errors.business_name?.message}
                    value={form.business_name}
                    onChange={(value) => commit("business_name", value)}
                  />
                  <ApplyTextField
                    name="contact_email"
                    label="Email"
                    type="email"
                    placeholder="you@business.example"
                    error={errors.contact_email?.message}
                    value={contactEmail}
                    onChange={(value) => commit("contact_email", value)}
                  />
                </FieldGrid>
              </ApplySection>
            </ApplyStep>

            <ApplyStep index={1} current={wizardStep}>
              <ApplySection
                title={APPLY_STEPS[1].title}
                description={APPLY_STEPS[1].description}
              >
                <div className="space-y-2">
                  <FieldGrid>
                    <ProgramCard
                      title="SBA 7(a)"
                      body="Working capital and general purpose. Typical for established firms that clear the 7(a) floor."
                      selected={form.requested_program === "sba_7a"}
                      invalid={Boolean(errors.requested_program)}
                      onSelect={() => commit("requested_program", "sba_7a")}
                    />
                    <ProgramCard
                      title="CDFI Direct"
                      body="Community development credit. Use this track when 7(a) is a stretch."
                      selected={form.requested_program === "cdfi_direct"}
                      invalid={Boolean(errors.requested_program)}
                      onSelect={() => commit("requested_program", "cdfi_direct")}
                    />
                  </FieldGrid>
                  {errors.requested_program?.message ? (
                    <p
                      id="requested_program-error"
                      role="alert"
                      className="text-sm text-destructive"
                    >
                      {errors.requested_program.message}
                    </p>
                  ) : null}
                </div>
              </ApplySection>
            </ApplyStep>

            <ApplyStep index={2} current={wizardStep}>
              <ApplySection
                title={APPLY_STEPS[2].title}
                description={APPLY_STEPS[2].description}
              >
                <Field
                  label="Industry"
                  htmlFor="industry"
                  required
                  error={errors.industry?.message}
                >
                  <Combobox
                    items={[...GOLD_SET_INDUSTRIES]}
                    value={form.industry || null}
                    onValueChange={(value) => {
                      commit("industry", typeof value === "string" ? value : "")
                    }}
                    autoHighlight
                  >
                    <ComboboxInput
                      id="industry"
                      placeholder="Search industries…"
                      className="h-10 w-full"
                      showClear={Boolean(form.industry)}
                      aria-invalid={Boolean(errors.industry)}
                      aria-describedby={
                        errors.industry ? "industry-error" : undefined
                      }
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
                                  Ineligible
                                </span>
                              ) : null}
                            </span>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </Field>
                <FieldGrid>
                  <ApplyTextField
                    name="years_in_business"
                    label="Years in business"
                    required
                    inputMode="decimal"
                    error={errors.years_in_business?.message}
                    value={form.years_in_business}
                    onChange={(value) => commit("years_in_business", value)}
                  />
                  <ApplyTextField
                    name="annual_revenue"
                    label="Annual revenue"
                    required
                    inputMode="decimal"
                    error={errors.annual_revenue?.message}
                    value={form.annual_revenue}
                    onChange={(value) => commit("annual_revenue", value)}
                  />
                </FieldGrid>
              </ApplySection>
            </ApplyStep>

            <ApplyStep index={3} current={wizardStep}>
              <ApplySection
                title="Loan amount"
                description="How much working capital this file is asking for."
              >
                <ApplyTextField
                  name="requested_loan_amount"
                  label="Requested amount"
                  required
                  inputMode="decimal"
                  error={errors.requested_loan_amount?.message}
                  value={form.requested_loan_amount}
                  onChange={(value) => commit("requested_loan_amount", value)}
                />
              </ApplySection>
              <ApplySection
                title="Credit proxies"
                description="Ratios and scores used in the review. Leave blank if they are not on file."
              >
                <FieldGrid cols={3}>
                  <ApplyTextField
                    name="debt_service_coverage_ratio"
                    label="DSCR"
                    inputMode="decimal"
                    error={errors.debt_service_coverage_ratio?.message}
                    value={form.debt_service_coverage_ratio}
                    onChange={(value) =>
                      commit("debt_service_coverage_ratio", value)
                    }
                  />
                  <ApplyTextField
                    name="credit_score_proxy"
                    label="FICO proxy"
                    inputMode="numeric"
                    error={errors.credit_score_proxy?.message}
                    value={form.credit_score_proxy}
                    onChange={(value) => commit("credit_score_proxy", value)}
                  />
                  <ApplyTextField
                    name="sbss_proxy"
                    label="SBSS proxy"
                    inputMode="numeric"
                    error={errors.sbss_proxy?.message}
                    value={form.sbss_proxy}
                    onChange={(value) => commit("sbss_proxy", value)}
                  />
                </FieldGrid>
                <div className="flex flex-wrap items-center gap-6 pt-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="has_bankruptcy"
                      checked={form.has_bankruptcy}
                      onCheckedChange={(checked) =>
                        commit("has_bankruptcy", checked === true)
                      }
                    />
                    <Label htmlFor="has_bankruptcy" className="font-normal">
                      Prior bankruptcy
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="has_fraud"
                      checked={form.has_severe_fraud_alert}
                      onCheckedChange={(checked) =>
                        commit("has_severe_fraud_alert", checked === true)
                      }
                    />
                    <Label htmlFor="has_fraud" className="font-normal">
                      Severe fraud alert
                    </Label>
                  </div>
                </div>
              </ApplySection>
            </ApplyStep>

            <ApplyStep index={4} current={wizardStep}>
              <ApplySection
                title={APPLY_STEPS[4].title}
                description={APPLY_STEPS[4].description}
              >
                <p className="text-sm text-muted-foreground">
                  Review the structured fields before submit
                  {caseId ? ` · ${caseId}.` : "."}
                </p>
                <ul className="divide-y rounded-xl border">
                  {reviewChecks(form).map((check) => (
                    <li
                      key={check.label}
                      className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <span className="text-muted-foreground">{check.label}</span>
                      <span
                        className={cn(
                          "text-end font-medium",
                          !check.ok && "text-destructive"
                        )}
                      >
                        {check.money
                          ? formatMaybeMoney(check.value)
                          : check.value || "Missing"}
                      </span>
                    </li>
                  ))}
                </ul>
              </ApplySection>
            </ApplyStep>

            {error ? (
              <p role="alert" className="pt-4 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t bg-background px-6 py-4 sm:px-10">
          {tourActive ? null : (
            <Link
              href="/portal"
              className={cn(buttonVariants({ variant: "ghost" }), "me-auto")}
              onClick={() => setPersona("applicant")}
            >
              Open status page
            </Link>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={wizardStep === 0 || submitting}
            onClick={() => {
              setError(null)
              setWizardStep(Math.max(0, wizardStep - 1))
            }}
          >
            Back
          </Button>
          {wizardStep < APPLY_STEPS.length - 1 ? (
            <Button type="submit">Continue</Button>
          ) : (
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit application"}
            </Button>
          )}
        </div>
      </form>

      {tourActive ? null : <ApplyAssistant />}
    </div>
  )
}

const applyControlClass = "h-10"

function ApplyStep({
  index,
  current,
  children,
}: {
  index: number
  current: number
  children: React.ReactNode
}) {
  return (
    <div
      id={`apply-step-${index}`}
      data-demo={current === index ? "apply" : undefined}
      className="scroll-mt-4"
    >
      {children}
    </div>
  )
}

function ApplySection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="flex w-full flex-col items-start gap-5 border-b border-border/70 py-8 first:pt-0 last:border-b-0 md:flex-row md:gap-10">
      <div className="w-full shrink-0 space-y-1 md:w-56">
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="min-w-0 w-full flex-1 space-y-5">{children}</div>
    </section>
  )
}

function FieldGrid({
  cols = 2,
  children,
}: {
  cols?: 2 | 3
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "grid w-full min-w-0 gap-x-4 gap-y-5",
        cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
      )}
    >
      {children}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  required,
  error,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase"
      >
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function ApplyTextField({
  name,
  label,
  required,
  error,
  value,
  onChange,
  type,
  inputMode,
  placeholder,
}: {
  name: string
  label: string
  required?: boolean
  error?: string
  value: string
  onChange: (value: string) => void
  type?: React.ComponentProps<"input">["type"]
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  placeholder?: string
}) {
  return (
    <Field label={label} htmlFor={name} required={required} error={error}>
      <Input
        id={name}
        type={type}
        inputMode={inputMode}
        className={applyControlClass}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

function ProgramCard({
  title,
  body,
  selected,
  invalid,
  onSelect,
}: {
  title: string
  body: string
  selected: boolean
  invalid?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-invalid={invalid && !selected ? true : undefined}
      className={cn(
        "rounded-xl border px-4 py-4 text-start transition-colors",
        selected
          ? "border-foreground bg-muted"
          : invalid
            ? "border-destructive"
            : "border-border/80 hover:bg-muted/40"
      )}
    >
      <p className="font-heading text-base font-medium">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </button>
  )
}

function formatMaybeMoney(value: string) {
  const n = Number(value)
  return Number.isFinite(n) && value.trim() ? formatCurrency(n) : value || "Missing"
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
