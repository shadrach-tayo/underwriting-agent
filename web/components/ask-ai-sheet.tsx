"use client"

import { SparklesIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { PolicyRagPlayground } from "@/components/playground/policy-rag-playground"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAskAiStore } from "@/stores/ask-ai-store"

export function AskAiSheet() {
  const open = useAskAiStore((s) => s.open)
  const setOpen = useAskAiStore((s) => s.setOpen)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="h-dvh w-full gap-0 overflow-hidden p-0 data-[side=right]:w-[min(100vw,48rem)] data-[side=right]:sm:max-w-3xl"
      >
        <SheetHeader className="shrink-0 border-b border-border/80">
          <SheetTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} className="size-4" />
            Ask AI
          </SheetTitle>
          <SheetDescription>
            Look up policy or ask with the source clause attached. Uses the same
            retrieve-and-generate path as underwriting.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PolicyRagPlayground compact />
        </div>
      </SheetContent>
    </Sheet>
  )
}
