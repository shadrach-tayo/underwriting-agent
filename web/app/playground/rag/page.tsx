"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { useAskAiStore } from "@/stores/ask-ai-store"

export default function PlaygroundRagPage() {
  const router = useRouter()
  const openSheet = useAskAiStore((s) => s.openSheet)

  React.useEffect(() => {
    openSheet()
    router.replace("/")
  }, [openSheet, router])

  return null
}
