"use client"

import { create } from "zustand"

import { DEMO_STEPS } from "@/lib/demo-tour"

type DemoTourState = {
  active: boolean
  stepIndex: number
  citationIndex: number | null
  busy: boolean
  start: () => void
  stop: () => void
  next: () => void
  back: () => void
  setBusy: (busy: boolean) => void
  openCitation: (index: number) => void
  clearCitation: () => void
}

export const useDemoTourStore = create<DemoTourState>((set, get) => ({
  active: false,
  stepIndex: 0,
  citationIndex: null,
  busy: false,
  start: () =>
    set({
      active: true,
      stepIndex: 0,
      citationIndex: null,
      busy: false,
    }),
  stop: () =>
    set({
      active: false,
      stepIndex: 0,
      citationIndex: null,
      busy: false,
    }),
  next: () => {
    const { stepIndex } = get()
    if (stepIndex >= DEMO_STEPS.length - 1) {
      set({ active: false, stepIndex: 0, citationIndex: null, busy: false })
      return
    }
    set({ stepIndex: stepIndex + 1, citationIndex: null })
  },
  back: () => {
    const { stepIndex } = get()
    set({
      stepIndex: Math.max(0, stepIndex - 1),
      citationIndex: null,
    })
  },
  setBusy: (busy) => set({ busy }),
  openCitation: (index) => set({ citationIndex: index }),
  clearCitation: () => set({ citationIndex: null }),
}))
