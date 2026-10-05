import { z } from "zod"

import type { UnderwriteForm } from "@/lib/underwrite"

const requiredMessage = "This field is required."

function requiredText() {
  return z.string().trim().min(1, requiredMessage)
}

function requiredNumber() {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .refine((value) => Number.isFinite(Number(value)), "Must be a number.")
}

function optionalNumber() {
  return z
    .string()
    .trim()
    .refine(
      (value) => value === "" || Number.isFinite(Number(value)),
      "Must be a number."
    )
}

export const applyFormSchema = z.object({
  business_name: requiredText(),
  contact_email: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Enter a valid email."
    ),
  requested_program: z
    .string()
    .refine(
      (value) => value === "sba_7a" || value === "cdfi_direct",
      requiredMessage
    ),
  industry: requiredText(),
  years_in_business: requiredNumber(),
  annual_revenue: requiredNumber(),
  requested_loan_amount: requiredNumber(),
  debt_service_coverage_ratio: optionalNumber(),
  credit_score_proxy: optionalNumber(),
  sbss_proxy: optionalNumber(),
  has_bankruptcy: z.boolean(),
  has_severe_fraud_alert: z.boolean(),
})

export type ApplyFormValues = z.input<typeof applyFormSchema>
export type ApplyFieldName = keyof ApplyFormValues

export const APPLY_STEPS = [
  {
    id: "contact",
    label: "Borrower information",
    title: "Contact",
    description: "Who is applying, and how this file can be reached.",
    fields: ["business_name", "contact_email"],
  },
  {
    id: "financing",
    label: "Financing",
    title: "Program",
    description: "Which credit product this application is asking for.",
    fields: ["requested_program"],
  },
  {
    id: "business",
    label: "Business profile",
    title: "Business",
    description: "Industry, tenure, and revenue used in routing and ratios.",
    fields: ["industry", "years_in_business", "annual_revenue"],
  },
  {
    id: "loan",
    label: "Loan details",
    title: "Loan",
    description: "Requested amount and the credit proxies on this file.",
    fields: [
      "requested_loan_amount",
      "debt_service_coverage_ratio",
      "credit_score_proxy",
      "sbss_proxy",
    ],
  },
  {
    id: "review",
    label: "Review & submit",
    title: "Review",
    description: "Confirm the fields before you submit.",
    fields: [],
  },
] as const satisfies readonly {
  id: string
  label: string
  title: string
  description: string
  fields: readonly ApplyFieldName[]
}[]

export type ApplyStepId = (typeof APPLY_STEPS)[number]["id"]

export const APPLY_FORM_FIELDS: ApplyFieldName[] = APPLY_STEPS.flatMap(
  (step) => [...step.fields]
)

export function fieldsForStep(step: number): ApplyFieldName[] {
  return [...(APPLY_STEPS[step]?.fields ?? [])]
}

export function toApplyFormValues(
  form: UnderwriteForm,
  contactEmail: string
): ApplyFormValues {
  return {
    business_name: form.business_name,
    contact_email: contactEmail,
    requested_program: form.requested_program,
    industry: form.industry,
    years_in_business: form.years_in_business,
    annual_revenue: form.annual_revenue,
    requested_loan_amount: form.requested_loan_amount,
    debt_service_coverage_ratio: form.debt_service_coverage_ratio,
    credit_score_proxy: form.credit_score_proxy,
    sbss_proxy: form.sbss_proxy,
    has_bankruptcy: form.has_bankruptcy,
    has_severe_fraud_alert: form.has_severe_fraud_alert,
  }
}

export function firstInvalidApplyStep(
  errors: Partial<Record<ApplyFieldName, unknown>>
) {
  const index = APPLY_STEPS.findIndex((step) =>
    step.fields.some((field) => errors[field])
  )
  return index === -1 ? APPLY_STEPS.length - 1 : index
}

export function reviewChecks(form: UnderwriteForm): {
  label: string
  ok: boolean
  value: string
  money?: boolean
}[] {
  return [
    {
      label: "Business name",
      ok: Boolean(form.business_name.trim()),
      value: form.business_name,
    },
    {
      label: "Industry",
      ok: Boolean(form.industry.trim()),
      value: form.industry,
    },
    {
      label: "Years in business",
      ok: Boolean(form.years_in_business.trim()),
      value: form.years_in_business,
    },
    {
      label: "Annual revenue",
      ok: Boolean(form.annual_revenue.trim()),
      value: form.annual_revenue,
      money: true,
    },
    {
      label: "Loan amount",
      ok: Boolean(form.requested_loan_amount.trim()),
      value: form.requested_loan_amount,
      money: true,
    },
    {
      label: "Program",
      ok: Boolean(form.requested_program),
      value:
        form.requested_program === "sba_7a"
          ? "SBA 7(a)"
          : form.requested_program === "cdfi_direct"
            ? "CDFI Direct"
            : "Not selected",
    },
    {
      label: "DSCR proxy",
      ok: true,
      value: form.debt_service_coverage_ratio.trim() || "Not provided",
    },
    {
      label: "FICO proxy",
      ok: true,
      value: form.credit_score_proxy.trim() || "Not provided",
    },
    {
      label: "SBSS proxy",
      ok: true,
      value: form.sbss_proxy.trim() || "Not provided",
    },
  ]
}
