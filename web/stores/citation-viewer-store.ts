"use client"

import { create } from "zustand"

import {
  citationGroupKey,
  ragHitToCitation,
  uniqueCitationsBySource,
  uniqueRagHitsBySource,
} from "@/lib/policy-source"
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
  open: (citations, index) => {
    const unique = uniqueCitationsBySource(citations)
    const target = citations[index]
    const openIndex = target
      ? unique.findIndex(
          (citation) => citationGroupKey(citation) === citationGroupKey(target)
        )
      : -1
    set({
      citations: unique,
      openIndex: openIndex >= 0 ? openIndex : unique[0] ? 0 : null,
      previewReady: false,
    })
  },
  openHits: (hits, index) => {
    const unique = uniqueRagHitsBySource(hits)
    const target = hits[index]
    const openIndex = target
      ? unique.findIndex((hit) => hit.clause_id === target.clause_id)
      : -1
    set({
      citations: unique.map(ragHitToCitation),
      openIndex: openIndex >= 0 ? openIndex : unique[0] ? 0 : null,
      previewReady: false,
    })
  },
  setIndex: (index) => set({ openIndex: index, previewReady: false }),
  markReady: () => set({ previewReady: true }),
  close: () => set({ openIndex: null, previewReady: false }),
}))
