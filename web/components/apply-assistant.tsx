"use client"

import { useEffect, useState } from "react"
import {
  AssistantRuntimeProvider,
  AuiConfig,
  Suggestions,
} from "@assistant-ui/react"

import { PolicyThread } from "@/components/assistant-ui/policy-thread"
import { usePolicyRagRuntime } from "@/hooks/use-policy-rag-runtime"

const applyChatConfig = AuiConfig({
  suggestions: Suggestions([
    "What SBSS score is required for SBA 7(a) eligibility?",
    "What does ECOA require for an adverse-action notice?",
    "What is Accion's CDFI revenue floor?",
  ]),
})

export function ApplyAssistant() {
  const [threadKey, setThreadKey] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <aside className="hidden min-h-0 w-80 shrink-0 flex-col border-s bg-background min-[1440px]:flex 2xl:w-88">
      <div className="flex shrink-0 items-end border-b px-4">
        <p className="border-b-2 border-foreground py-3 text-sm font-medium">
          Ask AI
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3 pt-1">
        {mounted ? (
          <ApplyChatDock
            key={threadKey}
            onNewChat={() => setThreadKey((key) => key + 1)}
          />
        ) : null}
      </div>
    </aside>
  )
}

function ApplyChatDock({ onNewChat }: { onNewChat: () => void }) {
  const runtime = usePolicyRagRuntime()
  return (
    <AssistantRuntimeProvider runtime={runtime} config={applyChatConfig}>
      <PolicyThread compact docked onNewChat={onNewChat} />
    </AssistantRuntimeProvider>
  )
}
