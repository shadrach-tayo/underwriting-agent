"use client"

import { File02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  useAuiState,
  type SourceMessagePartComponent,
} from "@assistant-ui/react"

import { Badge } from "@/components/ui/badge"
import { canPreviewSource, presentRagHits } from "@/lib/policy-source"
import type { RagHit } from "@/lib/rag"
import { useCitationViewerStore } from "@/stores/citation-viewer-store"
import { useRagSearchStore } from "@/stores/rag-search-store"

const EMPTY_HITS: RagHit[] = []

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function messageText(message: {
  content?: readonly { type: string; text?: string }[]
}) {
  return (message.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim()
}

export function SourceChip({
  hit,
  hits,
  index,
  label,
}: {
  hit: RagHit
  hits: RagHit[]
  index: number
  label: string
}) {
  const openHits = useCitationViewerStore((s) => s.openHits)
  const canOpenPage = canPreviewSource(hit.source)

  function openSource() {
    if (canOpenPage) {
      openHits(hits, index)
      return
    }
    if (hit.url) {
      window.open(hit.url, "_blank", "noopener,noreferrer")
    }
  }

  const text = label || (hit.url ? domainFromUrl(hit.url) : "Source")

  return (
    <button
      type="button"
      data-slot="source"
      onClick={openSource}
      className="max-w-full"
    >
      <Badge variant="secondary" className="max-w-full font-normal">
        <HugeiconsIcon icon={File02Icon} strokeWidth={2} className="size-3" />
        <span className="truncate">{text}</span>
      </Badge>
    </button>
  )
}

export function AssistantSources() {
  const messageId = useAuiState((s) => s.message.id)
  const messages = useAuiState((s) => s.thread.messages)
  const hasAnswer = useAuiState((s) =>
    Boolean(
      s.message.content?.some(
        (part) => part.type === "text" && "text" in part && part.text.trim()
      )
    )
  )
  const metaHits = useAuiState(
    (s) =>
      (s.message as { metadata?: { custom?: { ragHits?: RagHit[] } } })
        .metadata?.custom?.ragHits
  )
  const hitsByQuery = useRagSearchStore((s) => s.hitsByQuery)
  const lastHits = useRagSearchStore((s) => s.lastHits)

  const queryHits = (() => {
    const index = messages.findIndex((message) => message.id === messageId)
    for (let i = index - 1; i >= 0; i -= 1) {
      const previous = messages[i]
      if (previous?.role === "user") {
        return hitsByQuery[messageText(previous)] ?? EMPTY_HITS
      }
    }
    return EMPTY_HITS
  })()

  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id
  const hits =
    metaHits && metaHits.length > 0
      ? metaHits
      : queryHits.length > 0
        ? queryHits
        : messageId === lastAssistantId
          ? lastHits
          : EMPTY_HITS

  if (!hasAnswer || hits.length === 0) return null

  const { items, labels } = presentRagHits(hits)

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((hit, index) => (
        <SourceChip
          key={`${hit.clause_id}-${index}`}
          hit={hit}
          hits={items}
          index={index}
          label={labels[index] ?? ""}
        />
      ))}
    </div>
  )
}

export const Sources: SourceMessagePartComponent = (part) => {
  const lastHits = useRagSearchStore((s) => s.lastHits)
  const { items, labels } = presentRagHits(lastHits)
  const hitIndex = items.findIndex((hit) => hit.clause_id === part.id)
  const hit = hitIndex >= 0 ? items[hitIndex] : null
  if (!hit) return null
  return (
    <SourceChip
      hit={hit}
      hits={items}
      index={hitIndex}
      label={labels[hitIndex] ?? ""}
    />
  )
}
