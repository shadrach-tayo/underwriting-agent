"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import {
  buildUnderwritePayload,
  goldCaseToForm,
  type DecisionOutcome,
  type GoldSetCase,
  type UnderwriteForm,
  type UnderwriteRequestParams,
} from "@/lib/underwrite"

export type LastRunRecord = {
  outcome: DecisionOutcome
  at: string
}

export type HitlRecord = {
  outcome: DecisionOutcome
  cause: string
  at: string
  agentOutcome: DecisionOutcome
}

type UnderwriteState = {
  form: UnderwriteForm
  /** Last submitted run — drives TanStack Query + survives navigation. */
  activeRun: UnderwriteRequestParams | null
  formOpen: boolean
  selectedCaseId: string | null
  selectedApplicantId: string | null
  lastOutcomes: Record<string, LastRunRecord>
  hitlDecisions: Record<string, HitlRecord>
  updateField: <K extends keyof UnderwriteForm>(
    key: K,
    value: UnderwriteForm[K]
  ) => void
  setFormOpen: (open: boolean) => void
  loadGoldCase: (row: GoldSetCase) => void
  recordOutcome: (caseId: string, outcome: DecisionOutcome) => void
  recordHitl: (caseId: string, record: HitlRecord) => void
  commitRun: () => UnderwriteRequestParams | null
  clearResults: () => void
}

const initialForm: UnderwriteForm = {
  business_name: "Northside Supply Co.",
  industry: "wholesale trade",
  annual_revenue: "180000",
  requested_loan_amount: "75000",
  years_in_business: "3",
  debt_service_coverage_ratio: "1.35",
  credit_score_proxy: "690",
  sbss_proxy: "175",
  requested_program: "sba_7a",
  lender_id: "",
  has_bankruptcy: false,
  has_severe_fraud_alert: false,
  notes: "Synthetic applicant for dual-program routing demos.",
}

export const useUnderwriteStore = create<UnderwriteState>()(
  persist(
    (set, get) => ({
      form: initialForm,
      activeRun: null,
      formOpen: true,
      selectedCaseId: null,
      selectedApplicantId: null,
      lastOutcomes: {},
      hitlDecisions: {},
      updateField: (key, value) =>
        set((state) => ({
          form: { ...state.form, [key]: value },
        })),
      setFormOpen: (formOpen) => set({ formOpen }),
      loadGoldCase: (row) =>
        set({
          form: goldCaseToForm(row),
          selectedCaseId: row.case_id,
          selectedApplicantId: row.applicant_id,
          formOpen: true,
        }),
      recordOutcome: (caseId, outcome) =>
        set((state) => ({
          lastOutcomes: {
            ...state.lastOutcomes,
            [caseId]: { outcome, at: new Date().toISOString() },
          },
        })),
      recordHitl: (caseId, record) =>
        set((state) => ({
          hitlDecisions: {
            ...state.hitlDecisions,
            [caseId]: record,
          },
        })),
      commitRun: () => {
        try {
          const { form, selectedCaseId, selectedApplicantId } = get()
          const activeRun = buildUnderwritePayload(form, {
            case_id: selectedCaseId,
            applicant_id: selectedApplicantId,
          })
          set({ activeRun })
          return activeRun
        } catch {
          return null
        }
      },
      clearResults: () => set({ activeRun: null, formOpen: true }),
    }),
    {
      name: "underwriting.playground.underwrite.v6",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        form: state.form,
        activeRun: state.activeRun,
        formOpen: state.formOpen,
        selectedCaseId: state.selectedCaseId,
        selectedApplicantId: state.selectedApplicantId,
        lastOutcomes: state.lastOutcomes,
        hitlDecisions: state.hitlDecisions,
      }),
    }
  )
)
