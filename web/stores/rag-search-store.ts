"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import {
  hitKey,
  type LenderFilter,
  type ProgramLayer,
  type RagHit,
  type RagSearchParams,
} from "@/lib/rag"

type RagSearchState = {
  query: string
  program: ProgramLayer
  lender: LenderFilter
  withAnswer: boolean
  topK: number
  /** Last submitted search — drives TanStack Query + survives navigation. */
  activeSearch: RagSearchParams | null
  openHits: Record<string, boolean>
  setQuery: (query: string) => void
  setProgram: (program: ProgramLayer) => void
  setLender: (lender: LenderFilter) => void
  setWithAnswer: (withAnswer: boolean) => void
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
      query: defaultQuery,
      program: "all",
      lender: "generic",
      withAnswer: false,
      topK: 5,
      activeSearch: null,
      openHits: {},
      setQuery: (query) => set({ query }),
      setProgram: (program) => set({ program }),
      setLender: (lender) => set({ lender }),
      setWithAnswer: (withAnswer) => set({ withAnswer }),
      setTopK: (topK) => set({ topK }),
      commitSearch: () => {
        const { query, program, lender, withAnswer, topK } = get()
        const trimmed = query.trim()
        if (!trimmed) return null
        const activeSearch: RagSearchParams = {
          query: trimmed,
          program,
          lender,
          withAnswer,
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
      name: "underwriting.playground.rag.v2",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        query: state.query,
        program: state.program,
        lender: state.lender,
        withAnswer: state.withAnswer,
        topK: state.topK,
        activeSearch: state.activeSearch,
        openHits: state.openHits,
      }),
    }
  )
)
