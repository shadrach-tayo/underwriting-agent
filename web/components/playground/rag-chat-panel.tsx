"use client"

import { useState } from "react"
import {
  AssistantRuntimeProvider,
  AuiConfig,
  Suggestions,
} from "@assistant-ui/react"

import { PolicyThread } from "@/components/assistant-ui/policy-thread"
import { RagFilters } from "@/components/playground/rag-filters"
import { Button } from "@/components/ui/button"
import { usePolicyRagRuntime } from "@/hooks/use-policy-rag-runtime"

const chatConfig = AuiConfig({
  suggestions: Suggestions([
    "What SBSS score is required for SBA 7(a) eligibility?",
    "What does ECOA require for an adverse-action notice?",
    "What is Accion's CDFI revenue floor?",
  ]),
})

export function RagChatPanel() {
  const [threadKey, setThreadKey] = useState(0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <RagFilters programId="rag-chat-program" lenderId="rag-chat-lender" />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setThreadKey((key) => key + 1)}
        >
          New chat
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Filters apply to the next turn. Answers stream from{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
          POST /rag/ask/stream
        </code>{" "}
        using generate citations as sources.
      </p>
      <div className="h-[min(42rem,calc(100svh-16rem))] overflow-hidden rounded-xl border border-border/80 bg-card">
        <ChatRuntime key={threadKey} />
      </div>
    </div>
  )
}

function ChatRuntime() {
  const runtime = usePolicyRagRuntime()
  return (
    <AssistantRuntimeProvider runtime={runtime} config={chatConfig}>
      <PolicyThread />
    </AssistantRuntimeProvider>
  )
}
