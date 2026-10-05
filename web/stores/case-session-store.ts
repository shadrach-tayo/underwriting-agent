"use client"

import * as React from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import {
  EMPTY_CASE_SESSION,
  formatCaseStage,
  goldCaseToApplicant,
  makeActivity,
  officerDecisionActivity,
  recommendationActivity,
  type CaseSession,
  type DeskFocus,
  type Persona,
} from "@/lib/case-session"
import type {
  Decision,
  DecisionOutcome,
  GoldSetCase,
  UnderwriteApplicantPayload,
} from "@/lib/underwrite"

type CaseSessionState = CaseSession & {
  setPersona: (persona: Persona) => void
  setDeskFocus: (deskFocus: DeskFocus) => void
  openLenderDesk: (deskFocus?: DeskFocus) => void
  setContactEmail: (email: string) => void
  setWizardStep: (step: number) => void
  setApplicant: (applicant: UnderwriteApplicantPayload | null) => void
  openGoldCase: (row: GoldSetCase, persona?: Persona) => void
  beginBlankApply: () => void
  markSubmitted: () => void
  markGraphRan: (outcome: DecisionOutcome, decision?: Decision | null) => void
  recordHitl: (outcome: DecisionOutcome, cause?: string) => void
  requestFromBorrower: (message: string) => void
  clearSession: () => void
}

const MAX_ACTIVITY = 40

function pushActivity(
  activity: CaseSession["activity"],
  kind: Parameters<typeof makeActivity>[0],
  message: string
) {
  return [...activity, makeActivity(kind, message)].slice(-MAX_ACTIVITY)
}

export const useCaseSessionStore = create<CaseSessionState>()(
  persist(
    (set) => ({
      ...EMPTY_CASE_SESSION,
      setPersona: (persona) => set({ persona }),
      setDeskFocus: (deskFocus) => set({ deskFocus }),
      openLenderDesk: (deskFocus = "catalog") =>
        set({ persona: "lender", deskFocus }),
      setContactEmail: (email) => set({ contactEmail: email.trim() || null }),
      setWizardStep: (step) => set({ wizardStep: step }),
      setApplicant: (applicant) => set({ applicant }),
      openGoldCase: (row, persona) =>
        set((state) => ({
          caseId: row.case_id,
          applicantId: row.applicant_id,
          persona: persona ?? state.persona,
          stage: "draft",
          applicant: goldCaseToApplicant(row),
          decision: null,
          agentOutcome: null,
          hitlOutcome: null,
          hitlCause: null,
          requests: [],
          wizardStep: 0,
          activity: pushActivity(
            [],
            "opened",
            `Opened ${row.business_name}.`
          ),
        })),
      beginBlankApply: () =>
        set({
          ...EMPTY_CASE_SESSION,
          persona: "applicant",
          deskFocus: "file",
          wizardStep: 0,
        }),
      markSubmitted: () =>
        set((state) => {
          if (!state.caseId) return state
          return {
            stage: state.stage === "draft" ? "submitted" : state.stage,
            activity: pushActivity(
              state.activity,
              "submitted",
              "Application submitted for underwriting."
            ),
          }
        }),
      markGraphRan: (outcome, decision) =>
        set((state) => {
          if (!state.caseId) return state
          return {
            stage: state.stage === "decided" ? "decided" : "in_review",
            agentOutcome: outcome,
            decision: decision ?? state.decision,
            activity: pushActivity(
              state.activity,
              "graph_ran",
              recommendationActivity(outcome)
            ),
          }
        }),
      recordHitl: (outcome, cause) =>
        set((state) => {
          if (!state.caseId) return state
          return {
            stage: "decided",
            hitlOutcome: outcome,
            hitlCause: cause?.trim() || state.hitlCause,
            activity: pushActivity(
              state.activity,
              "hitl_recorded",
              officerDecisionActivity(outcome, cause)
            ),
          }
        }),
      requestFromBorrower: (message) =>
        set((state) => {
          if (!state.caseId || !message.trim()) return state
          const request = {
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `req-${Date.now()}`,
            at: new Date().toISOString(),
            message: message.trim(),
          }
          return {
            requests: [...state.requests, request],
            activity: pushActivity(
              state.activity,
              "request_sent",
              `Officer asked the applicant: ${message.trim()}`
            ),
          }
        }),
      clearSession: () => set({ ...EMPTY_CASE_SESSION }),
    }),
    {
      name: "underwriting.playground.case-session.v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        caseId: state.caseId,
        applicantId: state.applicantId,
        persona: state.persona,
        deskFocus: state.deskFocus,
        stage: state.stage,
        applicant: state.applicant,
        contactEmail: state.contactEmail,
        decision: state.decision,
        agentOutcome: state.agentOutcome,
        hitlOutcome: state.hitlOutcome,
        hitlCause: state.hitlCause,
        requests: state.requests,
        activity: state.activity,
        wizardStep: state.wizardStep,
      }),
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as Partial<CaseSession> & {
          state?: Partial<CaseSession>
        }
        const saved = raw.state ?? raw
        return {
          ...current,
          ...saved,
          deskFocus: saved.deskFocus ?? "catalog",
          requests: saved.requests ?? [],
          activity: saved.activity ?? [],
          contactEmail: saved.contactEmail ?? null,
          decision: saved.decision ?? null,
          hitlCause: saved.hitlCause ?? null,
          wizardStep: saved.wizardStep ?? 0,
        }
      },
    }
  )
)

export function describeOpenCase(session: Pick<
  CaseSession,
  "caseId" | "applicant" | "stage"
>): string {
  if (!session.caseId || !session.applicant) return "No file open."
  return `${session.applicant.business_name} · ${session.caseId} · ${formatCaseStage(session.stage)}`
}

export function useCaseSessionHydrated() {
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    const api = useCaseSessionStore.persist
    if (!api) {
      setHydrated(true)
      return
    }
    const unsub = api.onFinishHydration(() => {
      setHydrated(true)
    })
    if (api.hasHydrated()) setHydrated(true)
    return unsub
  }, [])

  return hydrated
}
