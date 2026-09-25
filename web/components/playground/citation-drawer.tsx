"use client"

import * as React from "react"

import { SourceLink } from "@/components/playground/source-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  formatProgram,
  formatStatusLabel,
  type Citation,
} from "@/lib/underwrite"

export function CitationChips({
  citations,
  onSelect,
}: {
  citations: Citation[]
  onSelect: (index: number) => void
}) {
  if (citations.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {citations.map((citation, index) => (
        <button
          key={`${citation.clause_id}-${index}`}
          type="button"
          onClick={() => onSelect(index)}
          className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
        >
          <span className="tabular-nums text-muted-foreground">
            {index + 1}
          </span>
          <span className="font-mono">{citation.clause_id}</span>
        </button>
      ))}
    </div>
  )
}

export function CitationDrawer({
  citations,
  openIndex,
  onOpenChange,
}: {
  citations: Citation[]
  openIndex: number | null
  onOpenChange: (index: number | null) => void
}) {
  const citation = openIndex == null ? null : (citations[openIndex] ?? null)
  const count = citations.length

  return (
    <Sheet
      open={openIndex != null && citation != null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(null)
      }}
    >
      <SheetContent side="right" className="sm:max-w-lg data-[side=right]:sm:max-w-lg">
        {citation ? (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono text-sm">
                {citation.clause_id}
              </SheetTitle>
              <SheetDescription>
                {formatProgram(citation.program)}
                {count > 1 && openIndex != null
                  ? ` · ${openIndex + 1} of ${count}`
                  : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {formatStatusLabel(citation.source.authority)}
                </Badge>
                <Badge variant="outline">
                  sim {citation.similarity_score.toFixed(2)}
                </Badge>
                {citation.grounded != null ? (
                  <Badge variant={citation.grounded ? "secondary" : "outline"}>
                    {citation.grounded ? "Grounded" : "Ungrounded"}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm leading-relaxed">
                {citation.retrieved_text || "No clause text retrieved."}
              </p>
              <p className="text-xs text-muted-foreground">
                {citation.source.title || citation.source.name}
                {citation.source.version
                  ? ` · ${citation.source.version}`
                  : ""}
              </p>
            </div>
            <SheetFooter>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SourceLink href={citation.source.url}>
                  Open source
                </SourceLink>
                {count > 1 && openIndex != null ? (
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onOpenChange((openIndex - 1 + count) % count)
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenChange((openIndex + 1) % count)}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </div>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
