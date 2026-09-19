"use client"

import { Search01Icon, SparklesIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { RagChatPanel } from "@/components/playground/rag-chat-panel"
import { RagSearchPanel } from "@/components/playground/rag-search-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PolicyRagMode } from "@/lib/rag"
import { useRagSearchStore } from "@/stores/rag-search-store"

export function PolicyRagPlayground() {
  const mode = useRagSearchStore((s) => s.mode)
  const setMode = useRagSearchStore((s) => s.setMode)

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

      <Tabs
        value={mode}
        onValueChange={(value) => {
          if (value === "search" || value === "chat") {
            setMode(value as PolicyRagMode)
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="search">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
            Search
          </TabsTrigger>
          <TabsTrigger value="chat">
            <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} />
            Chat
          </TabsTrigger>
        </TabsList>
        <TabsContent value="search" className="pt-6">
          <RagSearchPanel />
        </TabsContent>
        <TabsContent value="chat" className="pt-6">
          <RagChatPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
