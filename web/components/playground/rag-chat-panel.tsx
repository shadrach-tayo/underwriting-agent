"use client"

import { useState } from "react"
import {
  AssistantRuntimeProvider,
  AuiConfig,
  Suggestions,
} from "@assistant-ui/react"

import { PolicyThread } from "@/components/assistant-ui/policy-thread"
import { RagFilters } from "@/components/playground/rag-filters"
import { usePolicyRagRuntime } from "@/hooks/use-policy-rag-runtime"
import { cn } from "@/lib/utils"

const chatConfig = AuiConfig({
  suggestions: Suggestions([
    "What SBSS score is required for SBA 7(a) eligibility?",
    "What does ECOA require for an adverse-action notice?",
    "What is Accion's CDFI revenue floor?",
  ]),
})

export function RagChatPanel({ compact = false }: { compact?: boolean }) {
  const [threadKey, setThreadKey] = useState(0)

  return (
    <div
      className={cn(
        compact ? "flex h-full min-h-0 flex-col gap-3" : "space-y-4"
      )}
    >
      <div className="flex shrink-0 flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <RagFilters programId="rag-chat-program" lenderId="rag-chat-lender" />
        </div>
      </div>
      {compact ? null : (
        <p className="text-xs text-muted-foreground">
          Filters apply to the next turn. Answers stream from{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
            POST /rag/ask/stream
          </code>{" "}
          using generate citations as sources.
        </p>
      )}
      <div
        className={cn(
          "min-h-0 overflow-hidden bg-card",
          compact
            ? "flex flex-1 flex-col"
            : "h-[min(42rem,calc(100svh-16rem))] rounded-xl border border-border/80"
        )}
      >
        <ChatRuntime
          key={threadKey}
          compact={compact}
          onNewChat={() => setThreadKey((key) => key + 1)}
        />
      </div>
    </div>
  )
}

function ChatRuntime({
  compact,
  onNewChat,
}: {
  compact?: boolean
  onNewChat: () => void
}) {
  const runtime = usePolicyRagRuntime()
  return (
    <AssistantRuntimeProvider runtime={runtime} config={chatConfig}>
      <div className="flex h-full min-h-0 flex-col">
        <PolicyThread compact={compact} onNewChat={onNewChat} />
      </div>
    </AssistantRuntimeProvider>
  )
}
