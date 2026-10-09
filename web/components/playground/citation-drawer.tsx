"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { SourceLink } from "@/components/playground/source-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  citationFilename,
  citationGroupKey,
  citationPage,
  isDocxSource,
  isPdfSource,
  pdfPageNumber,
  policySourceFileUrl,
  presentCitations,
} from "@/lib/policy-source"
import { formatProgram, formatStatusLabel, type Citation } from "@/lib/underwrite"
import { cn } from "@/lib/utils"
import { useCitationViewerStore } from "@/stores/citation-viewer-store"
import { useDemoTourStore } from "@/stores/demo-tour-store"

const CitationPdfPage = dynamic(() => import("@/components/playground/citation-pdf"), {
  ssr: false,
  loading: () => <CitationDocSkeleton />,
})

const CitationDocxPreview = dynamic(
  () => import("@/components/playground/citation-docx"),
  {
    ssr: false,
    loading: () => <CitationDocSkeleton />,
  }
)

function CitationDocSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[min(52vh,28rem)] flex-col gap-3 rounded-lg border bg-background p-6",
        className
      )}
      aria-hidden
    >
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-[92%]" />
      <Skeleton className="h-3 w-[86%]" />
      <Skeleton className="mt-3 h-3 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-[90%]" />
      <Skeleton className="h-3 w-[78%]" />
      <Skeleton className="mt-3 h-3 w-1/2" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-[94%]" />
      <Skeleton className="min-h-36 flex-1 w-full" />
    </div>
  )
}

export function CitationChips({
  citations,
  onSelect,
}: {
  citations: Citation[]
  onSelect: (citations: Citation[], index: number) => void
}) {
  const { items, labels } = presentCitations(citations)
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((citation, index) => (
        <button
          key={citationGroupKey(citation)}
          type="button"
          onClick={() => onSelect(items, index)}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
        >
          <span className="tabular-nums text-muted-foreground">{index + 1}</span>
          <span className="truncate">{labels[index]}</span>
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
        if (index == null) {
          close()
          clearTourCitation()
          return
        }
        setIndex(index)
      }}
    />
  )
}

const SHEET_MS = 300

function useSheetPresence(open: boolean) {
  const [shown, setShown] = React.useState(false)
  const [entered, setEntered] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setShown(true)
      const enter = window.setTimeout(() => setEntered(true), 20)
      return () => window.clearTimeout(enter)
    }
    setEntered(false)
    const hide = window.setTimeout(() => setShown(false), SHEET_MS)
    return () => window.clearTimeout(hide)
  }, [open])

  return { shown, entered }
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
  const markReady = useCitationViewerStore((s) => s.markReady)
  const citation = openIndex == null ? null : (citations[openIndex] ?? null)
  const lastCitation = React.useRef<Citation | null>(null)
  if (citation) lastCitation.current = citation
  const view = citation ?? lastCitation.current
  const open = citation != null

  const count = citations.length
  const page = view ? citationPage(view) : null
  const file = view ? citationFilename(view) : ""
  const showPdf = Boolean(view && isPdfSource(file))
  const showDocx = Boolean(view && isDocxSource(file))
  const showOriginal = Boolean(file && (showPdf || showDocx))
  const fileUrl = file ? policySourceFileUrl(file) : ""

  const pdfKeep = React.useRef<{ file: string; url: string } | null>(null)
  const docxKeep = React.useRef<{ file: string; url: string } | null>(null)
  const lastPdf = React.useRef({ page: 1, snippet: "" })
  const lastDocx = React.useRef({ snippet: "" })
  const fileRef = React.useRef(file)
  fileRef.current = file
  if (view && isPdfSource(file)) {
    pdfKeep.current = { file, url: fileUrl }
    lastPdf.current = {
      page: pdfPageNumber(page),
      snippet: view.retrieved_text,
    }
  }
  if (view && isDocxSource(file)) {
    docxKeep.current = { file, url: fileUrl }
    lastDocx.current = { snippet: view.retrieved_text }
  }

  const { shown, entered } = useSheetPresence(open)
  const [allowHeavy, setAllowHeavy] = React.useState(false)
  const [revealedFile, setRevealedFile] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) setRevealedFile(null)
  }, [open])

  const showSkeleton = Boolean(
    open && showOriginal && (revealedFile !== file || !allowHeavy)
  )

  React.useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  React.useEffect(() => {
    if (!open || allowHeavy) return
    const frame = requestAnimationFrame(() => setAllowHeavy(true))
    return () => cancelAnimationFrame(frame)
  }, [open, allowHeavy])

  const handleDocReady = React.useCallback(() => {
    if (!fileRef.current) return
    setRevealedFile(fileRef.current)
    markReady()
  }, [markReady])

  React.useEffect(() => {
    if (!open || showOriginal) return
    markReady()
  }, [markReady, open, showOriginal])

  if (!view) return null

  const pdfVisible = open && showPdf
  const docxVisible = open && showDocx

  return (
    <>
      {shown ? (
        <button
          type="button"
          aria-label="Close citation"
          className={cn(
            "fixed inset-0 z-50 bg-black/10 transition-opacity duration-300 ease-in-out supports-backdrop-filter:backdrop-blur-xs",
            entered ? "opacity-100" : "opacity-0"
          )}
          onClick={() => onOpenChange(null)}
        />
      ) : null}
      <div
        role="dialog"
        aria-modal={open}
        aria-hidden={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-dvh w-[min(100vw,48rem)] max-w-3xl flex-col gap-0 overflow-hidden border-s bg-popover text-sm text-popover-foreground shadow-lg transition-transform duration-300 ease-in-out will-change-transform",
          entered ? "translate-x-0" : "translate-x-full rtl:-translate-x-full",
          !shown && "invisible pointer-events-none"
        )}
      >
        <div className="flex shrink-0 flex-col gap-0.5 border-b border-border/80 p-4">
          <h2 className="pr-10 font-heading text-base font-medium leading-snug text-foreground">
            {view.source.title || view.source.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatProgram(view.program)}
            {showPdf && page != null ? ` · p.${pdfPageNumber(page)}` : ""}
            {showDocx ? " · Word" : ""}
            {count > 1 && openIndex != null
              ? ` · ${openIndex + 1} of ${count}`
              : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 end-3"
          onClick={() => onOpenChange(null)}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          <span className="sr-only">Close</span>
        </Button>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {formatStatusLabel(view.source.authority)}
            </Badge>
            <Badge variant="outline">
              sim {view.similarity_score.toFixed(2)}
            </Badge>
            {view.grounded != null ? (
              <Badge variant={view.grounded ? "secondary" : "outline"}>
                {view.grounded ? "Grounded" : "Ungrounded"}
              </Badge>
            ) : null}
          </div>
          {showOriginal ? (
            <div
              className="relative min-h-[min(52vh,28rem)]"
              aria-busy={showSkeleton}
            >
              {showSkeleton ? (
                <CitationDocSkeleton className="absolute inset-0 z-10" />
              ) : null}
              {allowHeavy ? (
                <>
                  {pdfKeep.current ? (
                    <div
                      className={cn(
                        !pdfVisible && "hidden",
                        pdfVisible && showSkeleton && "invisible"
                      )}
                    >
                      <CitationPdfPage
                        key={pdfKeep.current.file}
                        fileUrl={pdfKeep.current.url}
                        pageNumber={
                          pdfVisible
                            ? pdfPageNumber(page)
                            : lastPdf.current.page
                        }
                        snippet={
                          pdfVisible
                            ? view.retrieved_text
                            : lastPdf.current.snippet
                        }
                        active={pdfVisible}
                        onReady={handleDocReady}
                      />
                    </div>
                  ) : null}
                  {docxKeep.current ? (
                    <div
                      className={cn(
                        (!docxVisible || showSkeleton) && "hidden"
                      )}
                    >
                      <CitationDocxPreview
                        key={docxKeep.current.file}
                        fileUrl={docxKeep.current.url}
                        snippet={
                          docxVisible
                            ? view.retrieved_text
                            : lastDocx.current.snippet
                        }
                        active={docxVisible}
                        visible={docxVisible && !showSkeleton}
                        onReady={handleDocReady}
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
          {!showPdf && !showDocx ? (
            <p className="text-xs text-muted-foreground">
              This catalog file is not a PDF or Word document, so the clause
              text is shown instead.
            </p>
          ) : null}
          <p
            className={cn(
              "text-sm leading-relaxed",
              showOriginal &&
                "rounded-lg bg-muted/50 p-3 text-muted-foreground"
            )}
          >
            {view.retrieved_text || "No clause text retrieved."}
          </p>
        </div>
        <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-border/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-3">
              {file ? (
                <SourceLink href={policySourceFileUrl(file, page)}>
                  Open full document
                </SourceLink>
              ) : null}
              <SourceLink href={view.source.url}>Origin URL</SourceLink>
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
        </div>
      </div>
    </>
  )
}
