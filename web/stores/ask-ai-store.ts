"use client"

import { create } from "zustand"

type AskAiState = {
  open: boolean
  openSheet: () => void
  closeSheet: () => void
  setOpen: (open: boolean) => void
}

export const useAskAiStore = create<AskAiState>((set) => ({
  open: false,
  openSheet: () => set({ open: true }),
  closeSheet: () => set({ open: false }),
  setOpen: (open) => set({ open }),
}))
