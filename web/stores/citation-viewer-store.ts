"use client"

import { create } from "zustand"

import { ragHitToCitation } from "@/lib/policy-source"
import type { RagHit } from "@/lib/rag"
import type { Citation } from "@/lib/underwrite"

type CitationViewerState = {
  citations: Citation[]
  openIndex: number | null
  previewReady: boolean
  open: (citations: Citation[], index: number) => void
  openHits: (hits: RagHit[], index: number) => void
  setIndex: (index: number | null) => void
  markReady: () => void
  close: () => void
}

export const useCitationViewerStore = create<CitationViewerState>((set) => ({
  citations: [],
  openIndex: null,
  previewReady: false,
  open: (citations, index) =>
    set({
      citations,
      openIndex: citations[index] ? index : null,
      previewReady: false,
    }),
  openHits: (hits, index) =>
    set({
      citations: hits.map(ragHitToCitation),
      openIndex: hits[index] ? index : null,
      previewReady: false,
    }),
  setIndex: (index) => set({ openIndex: index, previewReady: false }),
  markReady: () => set({ previewReady: true }),
  close: () => set({ openIndex: null, previewReady: false }),
}))
