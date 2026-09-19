"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Search01Icon, SparklesIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { RagChatPanel } from "@/components/playground/rag-chat-panel"
import { RagSearchPanel } from "@/components/playground/rag-search-panel"
import { buttonVariants } from "@/components/ui/button"
import type { PolicyRagMode } from "@/lib/rag"
import { cn } from "@/lib/utils"
import { useRagSearchStore } from "@/stores/rag-search-store"

const MODES: {
  value: PolicyRagMode
  label: string
  href: string
  icon: typeof Search01Icon
}[] = [
  { value: "search", label: "Search", href: "/playground/rag", icon: Search01Icon },
  {
    value: "chat",
    label: "Chat",
    href: "/playground/rag?mode=chat",
    icon: SparklesIcon,
  },
]

export function PolicyRagPlayground() {
  const searchParams = useSearchParams()
  const persistedMode = useRagSearchStore((s) => s.mode)
  const setPersistedMode = useRagSearchStore((s) => s.setMode)
  const urlMode = searchParams.get("mode")
  const mode: PolicyRagMode =
    urlMode === "chat" || urlMode === "search" ? urlMode : persistedMode

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Policy RAG
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Two distinct modes: dense retrieval over the policy corpus, or a
          streaming generate chat with sources from{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            RagPipeline.generate
          </code>
          .
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Policy RAG mode"
        className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-[3px]"
      >
        {MODES.map((item) => {
          const selected = mode === item.value
          return (
            <Link
              key={item.value}
              href={item.href}
              role="tab"
              aria-selected={selected}
              onClick={() => setPersistedMode(item.value)}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "gap-1.5 no-underline",
                selected && "bg-background text-foreground shadow-sm"
              )}
            >
              <HugeiconsIcon icon={item.icon} strokeWidth={2} />
              {item.label}
            </Link>
          )
        })}
      </div>

      {mode === "chat" ? <RagChatPanel /> : <RagSearchPanel />}
    </div>
  )
}
