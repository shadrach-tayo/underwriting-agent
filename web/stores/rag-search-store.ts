"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import {
  hitKey,
  type LenderFilter,
  type PolicyRagMode,
  type ProgramLayer,
  type RagHit,
  type RagSearchParams,
} from "@/lib/rag"

type RagSearchState = {
  mode: PolicyRagMode
  query: string
  program: ProgramLayer
  lender: LenderFilter
  topK: number
  /** Last submitted search — drives TanStack Query + survives navigation. */
  activeSearch: RagSearchParams | null
  openHits: Record<string, boolean>
  setMode: (mode: PolicyRagMode) => void
  setQuery: (query: string) => void
  setProgram: (program: ProgramLayer) => void
  setLender: (lender: LenderFilter) => void
  setTopK: (topK: number) => void
  commitSearch: () => RagSearchParams | null
  clearResults: () => void
  setHitOpen: (key: string, open: boolean) => void
  setOpenHits: (openHits: Record<string, boolean>) => void
  primeOpenHits: (hits: RagHit[]) => void
  expandAllHits: (hits: RagHit[]) => void
  collapseAllHits: () => void
}

const defaultQuery =
  "What SBSS score is required for SBA 7(a) eligibility?"

export const useRagSearchStore = create<RagSearchState>()(
  persist(
    (set, get) => ({
      mode: "search",
      query: defaultQuery,
      program: "all",
      lender: "generic",
      topK: 5,
      activeSearch: null,
      openHits: {},
      setMode: (mode) => set({ mode }),
      setQuery: (query) => set({ query }),
      setProgram: (program) => set({ program }),
      setLender: (lender) => set({ lender }),
      setTopK: (topK) => set({ topK }),
      commitSearch: () => {
        const { query, program, lender, topK } = get()
        const trimmed = query.trim()
        if (!trimmed) return null
        const activeSearch: RagSearchParams = {
          query: trimmed,
          program,
          lender,
          topK,
        }
        set({ activeSearch })
        return activeSearch
      },
      clearResults: () => set({ activeSearch: null, openHits: {} }),
      setHitOpen: (key, open) =>
        set((state) => ({
          openHits: { ...state.openHits, [key]: open },
        })),
      setOpenHits: (openHits) => set({ openHits }),
      primeOpenHits: (hits) => {
        const openHits: Record<string, boolean> = {}
        hits.forEach((hit, index) => {
          openHits[hitKey(hit, index)] = index === 0
        })
        set({ openHits })
      },
      expandAllHits: (hits) => {
        const openHits: Record<string, boolean> = {}
        hits.forEach((hit, index) => {
          openHits[hitKey(hit, index)] = true
        })
        set({ openHits })
      },
      collapseAllHits: () => set({ openHits: {} }),
    }),
    {
      name: "underwriting.playground.rag.v3",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        mode: state.mode,
        query: state.query,
        program: state.program,
        lender: state.lender,
        topK: state.topK,
        activeSearch: state.activeSearch,
        openHits: state.openHits,
      }),
    }
  )
)
