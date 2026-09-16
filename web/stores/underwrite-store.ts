"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import {
  buildUnderwritePayload,
  type UnderwriteForm,
  type UnderwriteRequestParams,
} from "@/lib/underwrite"

type UnderwriteState = {
  form: UnderwriteForm
  /** Last submitted run — drives TanStack Query + survives navigation. */
  activeRun: UnderwriteRequestParams | null
  formOpen: boolean
  updateField: <K extends keyof UnderwriteForm>(
    key: K,
    value: UnderwriteForm[K]
  ) => void
  setFormOpen: (open: boolean) => void
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
      updateField: (key, value) =>
        set((state) => ({
          form: { ...state.form, [key]: value },
        })),
      setFormOpen: (formOpen) => set({ formOpen }),
      commitRun: () => {
        try {
          const activeRun = buildUnderwritePayload(get().form)
          set({ activeRun })
          return activeRun
        } catch {
          return null
        }
      },
      clearResults: () => set({ activeRun: null, formOpen: true }),
    }),
    {
      name: "underwriting.playground.underwrite.v4",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        form: state.form,
        activeRun: state.activeRun,
        formOpen: state.formOpen,
      }),
    }
  )
)
