"use client"

import { Search01Icon, SparklesIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import type { PolicyRagMode } from "@/lib/rag"
import { cn } from "@/lib/utils"
import { useRagSearchStore } from "@/stores/rag-search-store"

const MODES: {
  value: PolicyRagMode
  label: string
  icon: typeof Search01Icon
}[] = [
  { value: "search", label: "Search", icon: Search01Icon },
  { value: "chat", label: "Chat", icon: SparklesIcon },
]

export function AskModePills({ className }: { className?: string }) {
  const mode = useRagSearchStore((s) => s.mode)
  const setMode = useRagSearchStore((s) => s.setMode)

  return (
    <div
      role="tablist"
      aria-label="Ask AI mode"
      className={cn(
        "inline-flex items-center rounded-lg bg-muted p-0.5",
        className
      )}
    >
      {MODES.map((item) => {
        const selected = mode === item.value
        return (
          <Button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            variant="ghost"
            size="xs"
            onClick={() => setMode(item.value)}
            className={cn(
              "gap-1 rounded-md px-2.5",
              selected && "bg-background text-foreground shadow-sm"
            )}
          >
            <HugeiconsIcon icon={item.icon} strokeWidth={2} />
            {item.label}
          </Button>
        )
      })}
    </div>
  )
}
