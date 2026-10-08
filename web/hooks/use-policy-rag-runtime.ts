"use client"

import { useMemo, useRef } from "react"
import {
  useLocalRuntime,
  type ChatModelAdapter,
  type ChatModelRunResult,
  type ThreadAssistantMessagePart,
  type ThreadMessage,
} from "@assistant-ui/react"

import { streamRagAsk, type RagHit } from "@/lib/rag"
import { useRagSearchStore } from "@/stores/rag-search-store"

function textFromMessage(message: ThreadMessage): string {
  return message.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim()
}

function mergeReasoning(prev: string, next: string) {
  if (!next) return prev
  if (!prev) return next
  if (next.startsWith(prev)) return next
  if (prev.endsWith(next)) return prev
  return prev + next
}

function sourceParts(hits: RagHit[]): ThreadAssistantMessagePart[] {
  return hits.map((hit, index) =>
    hit.url
      ? {
          type: "source" as const,
          sourceType: "url" as const,
          id: hit.clause_id || `src-${index}`,
          url: hit.url,
          title: hit.title || hit.source,
        }
      : {
          type: "source" as const,
          sourceType: "document" as const,
          id: hit.clause_id || `src-${index}`,
          title: hit.title || hit.source,
          mediaType: "text/markdown",
          filename: hit.source,
        }
  )
}

export function usePolicyRagRuntime() {
  const program = useRagSearchStore((s) => s.program)
  const lender = useRagSearchStore((s) => s.lender)
  const topK = useRagSearchStore((s) => s.topK)
  const scopeRef = useRef({ program, lender, topK })
  scopeRef.current = { program, lender, topK }

  const adapter = useMemo<ChatModelAdapter>(
    () => ({
      async *run({ messages, abortSignal }) {
        const lastUser = [...messages]
          .reverse()
          .find((message) => message.role === "user")
        const query = lastUser ? textFromMessage(lastUser) : ""
        if (!query) {
          throw new Error("Type a policy question to start chat.")
        }

        let reasoning = ""
        let text = ""
        let sources: ThreadAssistantMessagePart[] = []
        let ragHits: RagHit[] = []

        const snapshot = (running = true): ChatModelRunResult => ({
          content: [
            ...(running || reasoning
              ? [{ type: "reasoning" as const, text: reasoning }]
              : []),
            ...(text ? [{ type: "text" as const, text }] : []),
            ...sources,
          ],
          metadata: {
            custom: { ragHits },
          },
        })

        yield snapshot()

        const history = messages
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({
            role: message.role as "user" | "assistant",
            content: textFromMessage(message),
          }))
          .filter((message) => message.content)

        for await (const event of streamRagAsk(
          { query, messages: history, ...scopeRef.current },
          abortSignal
        )) {
          if (event.type === "status") {
            yield snapshot()
            continue
          }
          if (event.type === "sources") {
            ragHits = event.hits
            sources = sourceParts(event.hits)
            useRagSearchStore.getState().setHitsForQuery(query, event.hits)
            yield snapshot()
            continue
          }
          if (event.type === "reasoning") {
            reasoning = mergeReasoning(reasoning, event.text)
            yield snapshot()
            continue
          }
          if (event.type === "token") {
            text += event.text
            yield snapshot()
            continue
          }
          if (event.type === "error") {
            throw new Error(event.detail)
          }
        }

        if (!text && !sources.length) {
          throw new Error("The model returned an empty answer.")
        }
        yield snapshot(false)
      },
    }),
    []
  )

  return useLocalRuntime(adapter)
}
