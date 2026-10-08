"use client"

import * as React from "react"
import { Document, Page, pdfjs } from "react-pdf"

import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

const PDF_OPTIONS = { withCredentials: false as const }

type HighlightBox = {
  left: number
  top: number
  width: number
  height: number
}

export default function CitationPdfPage({
  fileUrl,
  pageNumber,
  snippet,
}: {
  fileUrl: string
  pageNumber: number
  snippet: string
}) {
  const pageRef = React.useRef<HTMLDivElement>(null)
  const [boxes, setBoxes] = React.useState<HighlightBox[]>([])
  const [width, setWidth] = React.useState(720)

  React.useEffect(() => {
    const node = pageRef.current?.parentElement
    if (!node) return
    function measure() {
      if (!node) return
      setWidth(Math.max(320, Math.min(node.clientWidth - 8, 860)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    const first = pageRef.current?.querySelector("[data-citation-hl]")
    if (first instanceof HTMLElement) {
      first.scrollIntoView({ block: "center", behavior: "smooth" })
    }
  }, [boxes])

  function markSnippet() {
    const root = pageRef.current
    if (!root) {
      setBoxes([])
      return
    }
    const spans = [
      ...root.querySelectorAll(".react-pdf__Page__textContent span"),
    ] as HTMLElement[]
    setBoxes(boxesForSnippet(root, spans, snippet))
  }

  return (
    <div ref={pageRef} className="relative overflow-auto">
      <Document
        file={fileUrl}
        options={PDF_OPTIONS}
        loading={
          <p className="px-1 py-8 text-sm text-muted-foreground">Loading page…</p>
        }
        error={
          <p className="px-1 py-8 text-sm text-destructive">
            Could not load this PDF. The clause text is below.
          </p>
        }
        suspense={false}
      >
        <Page
          pageNumber={pageNumber}
          width={width}
          renderAnnotationLayer={false}
          renderTextLayer
          onRenderTextLayerSuccess={markSnippet}
          loading={
            <p className="px-1 py-8 text-sm text-muted-foreground">Rendering page…</p>
          }
        />
      </Document>
      {boxes.map((box, index) => (
        <span
          key={`${box.left}-${box.top}-${index}`}
          data-citation-hl={index === 0 ? "" : undefined}
          aria-hidden
          className="pointer-events-none absolute rounded-sm bg-amber-400/35 ring-1 ring-amber-500/50"
          style={box}
        />
      ))}
    </div>
  )
}

function fold(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase()
}

function boxesForSnippet(
  root: HTMLElement,
  spans: HTMLElement[],
  snippet: string
): HighlightBox[] {
  const needle = fold(snippet).replace(/ /g, "")
  if (needle.length < 8 || spans.length === 0) return []

  let concat = ""
  const indexAt: number[] = []
  for (let i = 0; i < spans.length; i += 1) {
    const piece = fold(spans[i]?.textContent ?? "").replace(/ /g, "")
    for (let k = 0; k < piece.length; k += 1) {
      indexAt[concat.length + k] = i
    }
    concat += piece
  }
  if (!concat) return []

  let at = -1
  const maxProbe = Math.min(needle.length, 120)
  for (let n = maxProbe; n >= 16; n -= 8) {
    at = concat.indexOf(needle.slice(0, n))
    if (at >= 0) break
  }
  if (at < 0) {
    at = concat.indexOf(needle.slice(0, Math.min(24, needle.length)))
  }
  if (at < 0) return []

  const endChar = Math.min(concat.length, at + Math.min(needle.length, 480))
  const startSpan = indexAt[at]
  const endSpan = indexAt[Math.max(at, endChar - 1)]
  if (startSpan == null || endSpan == null) return []

  const pageRect = root.getBoundingClientRect()
  return spans.slice(startSpan, endSpan + 1).map((span) => {
    const rect = span.getBoundingClientRect()
    return {
      left: rect.left - pageRect.left + root.scrollLeft,
      top: rect.top - pageRect.top + root.scrollTop,
      width: Math.max(rect.width, 8),
      height: Math.max(rect.height, 8),
    }
  })
}
