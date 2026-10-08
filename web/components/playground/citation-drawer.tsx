"use client"

import * as React from "react"
import dynamic from "next/dynamic"

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
  citationFilename,
  citationLabel,
  citationPage,
  isPdfSource,
  pdfPageNumber,
  policySourceFileUrl,
} from "@/lib/policy-source"
import { formatProgram, formatStatusLabel, type Citation } from "@/lib/underwrite"
import { cn } from "@/lib/utils"
import { useCitationViewerStore } from "@/stores/citation-viewer-store"
import { useDemoTourStore } from "@/stores/demo-tour-store"

const CitationPdfPage = dynamic(() => import("@/components/playground/citation-pdf"), {
  ssr: false,
  loading: () => (
    <p className="px-1 py-8 text-sm text-muted-foreground">Loading page…</p>
  ),
})

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
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
        >
          <span className="tabular-nums text-muted-foreground">{index + 1}</span>
          <span className="truncate">{citationLabel(citation)}</span>
        </button>
      ))}
    </div>
  )
}

export function CitationViewerHost() {
  const citations = useCitationViewerStore((s) => s.citations)
  const openIndex = useCitationViewerStore((s) => s.openIndex)
  const setIndex = useCitationViewerStore((s) => s.setIndex)
  const close = useCitationViewerStore((s) => s.close)
  const clearTourCitation = useDemoTourStore((s) => s.clearCitation)

  return (
    <CitationDrawer
      citations={citations}
      openIndex={openIndex}
      onOpenChange={(index) => {
        setIndex(index)
        if (index == null) {
          close()
          clearTourCitation()
        }
      }}
    />
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
  const page = citation ? citationPage(citation) : null
  const file = citation ? citationFilename(citation) : ""
  const showPdf = Boolean(citation && isPdfSource(file))

  return (
    <Sheet
      open={openIndex != null && citation != null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(null)
      }}
    >
      <SheetContent
        side="right"
        className="h-dvh w-full gap-0 overflow-hidden p-0 data-[side=right]:w-[min(100vw,48rem)] data-[side=right]:sm:max-w-3xl"
      >
        {citation ? (
          <>
            <SheetHeader className="shrink-0 border-b border-border/80">
              <SheetTitle className="pr-10 text-base leading-snug">
                {citation.source.title || citation.source.name}
              </SheetTitle>
              <SheetDescription>
                {formatProgram(citation.program)}
                {page != null ? ` · p.${pdfPageNumber(page)}` : ""}
                {count > 1 && openIndex != null
                  ? ` · ${openIndex + 1} of ${count}`
                  : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
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
              {showPdf ? (
                <CitationPdfPage
                  key={`${file}-${pdfPageNumber(page)}`}
                  fileUrl={policySourceFileUrl(file)}
                  pageNumber={pdfPageNumber(page)}
                  snippet={citation.retrieved_text}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  This source is a Word SOP, not a paginated PDF, so the clause
                  text is shown instead of a source page.
                </p>
              )}
              <p
                className={cn(
                  "text-sm leading-relaxed",
                  showPdf && "rounded-lg bg-muted/50 p-3 text-muted-foreground"
                )}
              >
                {citation.retrieved_text || "No clause text retrieved."}
              </p>
            </div>
            <SheetFooter className="shrink-0 border-t border-border/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-3">
                  {showPdf ? (
                    <SourceLink href={policySourceFileUrl(file)}>
                      Open full document
                    </SourceLink>
                  ) : null}
                  <SourceLink href={citation.source.url}>
                    {showPdf ? "Origin URL" : "Open source"}
                  </SourceLink>
                </div>
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
