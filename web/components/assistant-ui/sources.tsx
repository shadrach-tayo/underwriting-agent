"use client"

import { File02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { SourceMessagePartComponent } from "@assistant-ui/react"

import { Badge } from "@/components/ui/badge"
import { isPdfSource } from "@/lib/policy-source"
import { cn } from "@/lib/utils"
import { useCitationViewerStore } from "@/stores/citation-viewer-store"
import { useRagSearchStore } from "@/stores/rag-search-store"

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export const Sources: SourceMessagePartComponent = (part) => {
  const hits = useRagSearchStore((s) => s.lastHits)
  const openHits = useCitationViewerStore((s) => s.openHits)
  const hitIndex = hits.findIndex((hit) => hit.clause_id === part.id)
  const hit = hitIndex >= 0 ? hits[hitIndex] : null
  const canOpenPage = Boolean(hit && isPdfSource(hit.source))

  function openSource() {
    if (hit && canOpenPage) {
      openHits(hits, hitIndex)
      return
    }
    if (part.sourceType === "url" && part.url) {
      window.open(part.url, "_blank", "noopener,noreferrer")
    }
  }

  if (part.sourceType === "url" && part.url) {
    const title = part.title || domainFromUrl(part.url)
    return (
      <button
        type="button"
        data-slot="source"
        onClick={openSource}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/80 bg-background px-2 py-1 text-xs text-muted-foreground",
          "transition-colors hover:border-foreground/25 hover:text-foreground"
        )}
      >
        <span className="flex size-3.5 shrink-0 items-center justify-center rounded-sm bg-muted text-[9px] font-medium">
          {domainFromUrl(part.url).charAt(0).toUpperCase() || "S"}
        </span>
        <span className="truncate">{title}</span>
      </button>
    )
  }

  if (part.sourceType === "document") {
    return (
      <button type="button" onClick={openSource} className="max-w-full">
        <Badge variant="secondary" className="max-w-full font-normal">
          <HugeiconsIcon icon={File02Icon} strokeWidth={2} className="size-3" />
          <span className="truncate">{part.title}</span>
        </Badge>
      </button>
    )
  }

  return null
}
