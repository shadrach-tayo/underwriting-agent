"use client"

import { Search01Icon, SparklesIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { RagChatPanel } from "@/components/playground/rag-chat-panel"
import { RagSearchPanel } from "@/components/playground/rag-search-panel"
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

export function PolicyRagPlayground({ compact = false }: { compact?: boolean }) {
  const mode = useRagSearchStore((s) => s.mode)
  const setMode = useRagSearchStore((s) => s.setMode)

  return (
    <div
      className={cn(
        compact
          ? "flex h-full min-h-0 flex-col gap-4 px-4 pt-4 pb-0"
          : "space-y-6"
      )}
    >
      {compact ? null : (
        <>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Ask AI
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Search the policy corpus, or ask a question that returns the clause
              it used. Same retrieve-and-generate path as underwriting.
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Ask AI mode"
            className="inline-flex w-fit shrink-0 items-center gap-1 rounded-lg bg-muted p-0.75"
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
                  size="sm"
                  onClick={() => setMode(item.value)}
                  className={cn(
                    "gap-1.5",
                    selected && "bg-background text-foreground shadow-sm"
                  )}
                >
                  <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                  {item.label}
                </Button>
              )
            })}
          </div>
        </>
      )}

      <div className={cn(compact && "flex min-h-0 flex-1 flex-col")}>
        {compact ? (
          <>
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col",
                mode !== "chat" && "hidden"
              )}
            >
              <RagChatPanel compact />
            </div>
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col",
                mode !== "search" && "hidden"
              )}
            >
              <RagSearchPanel compact />
            </div>
          </>
        ) : mode === "chat" ? (
          <RagChatPanel />
        ) : (
          <RagSearchPanel />
        )}
      </div>
    </div>
  )
}
