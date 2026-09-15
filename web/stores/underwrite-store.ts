"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type UnderwriteForm = {
  business_name: string
  industry: string
  annual_revenue: string
  requested_loan_amount: string
  years_in_business: string
  notes: string
}

type UnderwriteState = {
  form: UnderwriteForm
  submitted: UnderwriteForm | null
  updateField: <K extends keyof UnderwriteForm>(
    key: K,
    value: UnderwriteForm[K]
  ) => void
  submitStub: () => void
  clearSubmitted: () => void
}

const initialForm: UnderwriteForm = {
  business_name: "Northside Supply Co.",
  industry: "wholesale trade",
  annual_revenue: "180000",
  requested_loan_amount: "75000",
  years_in_business: "3",
  notes: "Synthetic applicant for dual-program routing demos.",
}

export const useUnderwriteStore = create<UnderwriteState>()(
  persist(
    (set, get) => ({
      form: initialForm,
      submitted: null,
      updateField: (key, value) =>
        set((state) => ({
          form: { ...state.form, [key]: value },
        })),
      submitStub: () => set({ submitted: { ...get().form } }),
      clearSubmitted: () => set({ submitted: null }),
    }),
    {
      name: "underwriting.playground.underwrite",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        form: state.form,
        submitted: state.submitted,
      }),
    }
  )
)
