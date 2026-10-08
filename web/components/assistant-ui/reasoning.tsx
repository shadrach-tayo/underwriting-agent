"use client"

import * as React from "react"
import { ArrowDown01Icon, BrainIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ReasoningMessagePartComponent } from "@assistant-ui/react"
import { useAuiState } from "@assistant-ui/react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

const ASK_REASONING_PHRASES = [
  "Retrieving matching policy clauses…",
  "Reading the cited source pages…",
  "Checking eligibility and program language…",
  "Grounding the answer in retrieved text…",
] as const

const PHRASE_MS = 1600

export const Reasoning: ReasoningMessagePartComponent = ({ text, status }) => {
  const messageRunning = useAuiState((s) => s.message.status?.type === "running")
  const streaming = messageRunning && status?.type === "running"
  const live = text.trim()
  const [phraseIndex, setPhraseIndex] = React.useState(0)
  const [open, setOpen] = React.useState(true)

  React.useEffect(() => {
    if (!streaming || live) return
    const id = window.setInterval(() => {
      setPhraseIndex((index) => (index + 1) % ASK_REASONING_PHRASES.length)
    }, PHRASE_MS)
    return () => window.clearInterval(id)
  }, [streaming, live])

  React.useEffect(() => {
    if (streaming) setOpen(true)
  }, [streaming])

  if (!streaming && !live) return null

  const label = streaming ? "Thinking" : "Thought"
  const display = live || ASK_REASONING_PHRASES[phraseIndex] || ASK_REASONING_PHRASES[0]

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-2">
      <CollapsibleTrigger
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
          "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        )}
      >
        <HugeiconsIcon icon={BrainIcon} strokeWidth={2} className="size-3.5" />
        <span>{label}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          strokeWidth={2}
          className="size-3.5 transition-transform in-data-panel-open:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-open:animate-accordion-down data-closed:animate-accordion-up">
        <p
          aria-busy={streaming}
          aria-live="polite"
          className="mt-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground"
        >
          {display}
        </p>
      </CollapsibleContent>
    </Collapsible>
  )
}
