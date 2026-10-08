"use client"

import { create } from "zustand"

import { ragHitToCitation } from "@/lib/policy-source"
import type { RagHit } from "@/lib/rag"
import type { Citation } from "@/lib/underwrite"

type CitationViewerState = {
  citations: Citation[]
  openIndex: number | null
  open: (citations: Citation[], index: number) => void
  openHits: (hits: RagHit[], index: number) => void
  setIndex: (index: number | null) => void
  close: () => void
}

export const useCitationViewerStore = create<CitationViewerState>((set) => ({
  citations: [],
  openIndex: null,
  open: (citations, index) =>
    set({
      citations,
      openIndex: citations[index] ? index : null,
    }),
  openHits: (hits, index) =>
    set({
      citations: hits.map(ragHitToCitation),
      openIndex: hits[index] ? index : null,
    }),
  setIndex: (index) => set({ openIndex: index }),
  close: () => set({ openIndex: null }),
}))
