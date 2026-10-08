"use client"

import { create } from "zustand"

import { DEMO_FILE, DEMO_STEPS } from "@/lib/demo-tour"
import { useCaseSessionStore } from "@/stores/case-session-store"
import { useUnderwriteStore } from "@/stores/underwrite-store"

type ApplyHandlers = {
  playApply: ((caseId: string) => Promise<void>) | null
  submitApply: (() => Promise<void>) | null
  loadRun: ((caseId: string) => Promise<void>) | null
}

type DemoTourState = {
  active: boolean
  intro: boolean
  autoplay: boolean
  stepIndex: number
  citationIndex: number | null
  busy: boolean
  scoring: boolean
  handlers: ApplyHandlers
  start: (options?: { autoplay?: boolean }) => void
  begin: (options?: { autoplay?: boolean }) => void
  stop: () => void
  next: () => void
  back: () => void
  setAutoplay: (autoplay: boolean) => void
  setBusy: (busy: boolean) => void
  setScoring: (scoring: boolean) => void
  openCitation: (index?: number) => void
  clearCitation: () => void
  registerHandlers: (partial: Partial<ApplyHandlers>) => void
}

function resetDemoFile() {
  const hitl = { ...useUnderwriteStore.getState().hitlDecisions }
  delete hitl[DEMO_FILE.caseId]
  useUnderwriteStore.setState({ hitlDecisions: hitl })
  useCaseSessionStore.getState().beginBlankApply()
}

const idle = {
  active: false,
  intro: false,
  autoplay: false,
  stepIndex: 0,
  citationIndex: null,
  busy: false,
  scoring: false,
} as const

export const useDemoTourStore = create<DemoTourState>((set, get) => ({
  ...idle,
  handlers: {
    playApply: null,
    submitApply: null,
    loadRun: null,
  },
  start: (options) => {
    resetDemoFile()
    set({
      active: true,
      intro: options?.autoplay !== true,
      autoplay: options?.autoplay === true,
      stepIndex: 0,
      citationIndex: null,
      busy: false,
      scoring: false,
    })
  },
  begin: (options) => {
    resetDemoFile()
    set({
      active: true,
      intro: false,
      autoplay: options?.autoplay === true || get().autoplay,
      stepIndex: 0,
      citationIndex: null,
      busy: false,
      scoring: false,
    })
  },
  stop: () => set({ ...idle }),
  next: () => {
    const { stepIndex } = get()
    if (stepIndex >= DEMO_STEPS.length - 1) {
      set({ ...idle })
      return
    }
    set({ stepIndex: stepIndex + 1, citationIndex: null, scoring: false })
  },
  back: () => {
    const { stepIndex, intro } = get()
    if (intro) return
    if (stepIndex === 0) {
      set({ intro: true, autoplay: false, citationIndex: null })
      return
    }
    set({
      stepIndex: Math.max(0, stepIndex - 1),
      citationIndex: null,
      scoring: false,
    })
  },
  setAutoplay: (autoplay) => set({ autoplay }),
  setBusy: (busy) => set({ busy }),
  setScoring: (scoring) => set({ scoring }),
  openCitation: () =>
    set((state) => ({ citationIndex: (state.citationIndex ?? 0) + 1 })),
  clearCitation: () => set({ citationIndex: null }),
  registerHandlers: (partial) =>
    set((state) => ({
      handlers: { ...state.handlers, ...partial },
    })),
}))
