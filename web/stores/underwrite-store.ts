"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { makeCaseId } from "@/lib/case-session"
import {
  applicantToForm,
  buildUnderwritePayload,
  extractReviewFlags,
  goldCaseToForm,
  type DecisionOutcome,
  type GoldSetCase,
  type UnderwriteForm,
  type UnderwriteRequestParams,
  type UnderwriteResult,
} from "@/lib/underwrite"
import { useCaseSessionStore } from "@/stores/case-session-store"

export type LastRunRecord = {
  outcome: DecisionOutcome
  at: string
  flags?: string[]
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
  replaceForm: (form: UnderwriteForm) => void
  setFormOpen: (open: boolean) => void
  loadGoldCase: (row: GoldSetCase) => void
  focusSessionCase: () => void
  ensureCaseIds: () => { caseId: string; applicantId: string }
  recordOutcome: (caseId: string, result: UnderwriteResult) => void
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
      replaceForm: (form) => set({ form }),
      setFormOpen: (formOpen) => set({ formOpen }),
      loadGoldCase: (row) => {
        useCaseSessionStore.getState().openGoldCase(row)
        set({
          form: goldCaseToForm(row),
          selectedCaseId: row.case_id,
          selectedApplicantId: row.applicant_id,
          formOpen: true,
        })
      },
      focusSessionCase: () => {
        const session = useCaseSessionStore.getState()
        if (!session.caseId || !session.applicant) return
        const current = get()
        if (current.selectedCaseId === session.caseId) {
          set({
            formOpen: current.activeRun ? false : current.formOpen,
          })
          return
        }
        const form = applicantToForm(session.applicant)
        const applicantId =
          session.applicantId ||
          session.applicant.applicant_id ||
          session.caseId
        set({
          form,
          selectedCaseId: session.caseId,
          selectedApplicantId: applicantId,
          formOpen: !current.activeRun || current.activeRun.case_id !== session.caseId,
          activeRun:
            current.activeRun?.case_id === session.caseId
              ? current.activeRun
              : null,
        })
      },
      ensureCaseIds: () => {
        const current = get()
        if (current.selectedCaseId) {
          return {
            caseId: current.selectedCaseId,
            applicantId: current.selectedApplicantId || current.selectedCaseId,
          }
        }
        const caseId = makeCaseId()
        const applicantId = `app-${caseId}`
        useCaseSessionStore.setState({ caseId, applicantId })
        set({ selectedCaseId: caseId, selectedApplicantId: applicantId })
        return { caseId, applicantId }
      },
      recordOutcome: (caseId, result) => {
        const session = useCaseSessionStore.getState()
        if (session.caseId === caseId) {
          session.markGraphRan(result.decision.outcome, result.decision)
        }
        set((state) => ({
          lastOutcomes: {
            ...state.lastOutcomes,
            [caseId]: {
              outcome: result.decision.outcome,
              at: new Date().toISOString(),
              flags: extractReviewFlags(result),
            },
          },
        }))
      },
      recordHitl: (caseId, record) => {
        const session = useCaseSessionStore.getState()
        if (session.caseId === caseId) {
          session.recordHitl(record.outcome, record.cause)
        }
        set((state) => ({
          hitlDecisions: {
            ...state.hitlDecisions,
            [caseId]: record,
          },
        }))
      },
      commitRun: () => {
        try {
          const { caseId, applicantId } = get().ensureCaseIds()
          const { form } = get()
          const activeRun = buildUnderwritePayload(form, {
            case_id: caseId,
            applicant_id: applicantId,
          })
          useCaseSessionStore.getState().setApplicant(activeRun.applicant)
          useCaseSessionStore.getState().markSubmitted()
          set({ activeRun, selectedCaseId: caseId, selectedApplicantId: applicantId })
          return activeRun
        } catch {
          return null
        }
      },
      clearResults: () => set({ activeRun: null, formOpen: true }),
    }),
    {
      name: "underwriting.playground.underwrite.v7",
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
