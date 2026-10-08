"use client"

import * as React from "react"
import { renderAsync } from "docx-preview"

import {
  loadPolicySourceBlob,
  peekPolicySourceBlob,
  stashDocxDom,
  takeDocxDom,
} from "@/lib/policy-source-cache"

export default function CitationDocxPreview({
  fileUrl,
  snippet,
  active = true,
  visible = true,
  onReady,
}: {
  fileUrl: string
  snippet: string
  active?: boolean
  visible?: boolean
  onReady?: () => void
}) {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const renderedUrl = React.useRef<string | null>(null)
  const onReadyRef = React.useRef(onReady)
  onReadyRef.current = onReady
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading"
  )
  const [painted, setPainted] = React.useState(false)

  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    setPainted(false)

    if (renderedUrl.current && renderedUrl.current !== fileUrl) {
      stashDocxDom(renderedUrl.current, host)
      renderedUrl.current = null
    }

    const restored = takeDocxDom(fileUrl)
    if (restored) {
      host.replaceChildren()
      host.appendChild(restored)
      renderedUrl.current = fileUrl
      setStatus("ready")
      setPainted(true)
      highlightSnippet(host, snippet)
      return () => {
        cancelled = true
        stashDocxDom(fileUrl, host)
        renderedUrl.current = null
      }
    }

    if (renderedUrl.current === fileUrl && host.childElementCount > 0) {
      setStatus("ready")
      setPainted(true)
      highlightSnippet(host, snippet)
      return
    }

    const cached = peekPolicySourceBlob(fileUrl)
    if (!cached) setStatus("loading")

    loadPolicySourceBlob(fileUrl)
      .then((blob) => blob.arrayBuffer())
      .then((buffer) => {
        if (cancelled) return
        host.replaceChildren()
        return renderAsync(buffer, host, undefined, {
          inWrapper: true,
          ignoreWidth: true,
          breakPages: false,
        })
      })
      .then(() => {
        if (cancelled) return
        renderedUrl.current = fileUrl
        setStatus("ready")
        setPainted(true)
        highlightSnippet(host, snippet)
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error")
          setPainted(true)
        }
      })

    return () => {
      cancelled = true
      stashDocxDom(fileUrl, host)
      renderedUrl.current = null
    }
  }, [fileUrl])

  React.useEffect(() => {
    const host = hostRef.current
    if (!visible || !host || renderedUrl.current !== fileUrl) return
    highlightSnippet(host, snippet)
  }, [fileUrl, snippet, visible])

  React.useEffect(() => {
    if (!active || !painted) return
    onReadyRef.current?.()
  }, [active, painted])

  return (
    <div className="space-y-2">
      {status === "error" ? (
        <p className="px-1 py-2 text-sm text-destructive">
          Could not preview this Word file. Open the original below.
        </p>
      ) : null}
      <div
        ref={hostRef}
        className="docx-citation-preview max-h-[min(70vh,40rem)] overflow-auto rounded-lg border bg-white text-black"
      />
    </div>
  )
}

function fold(value: string) {
  return value
    .replace(/[\s\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000]+/g, " ")
    .trim()
    .toLowerCase()
}

function highlightSnippet(root: HTMLElement, snippet: string) {
  for (const el of root.querySelectorAll("[data-citation-hl]")) {
    el.removeAttribute("data-citation-hl")
    el.classList.remove(
      "rounded-sm",
      "bg-amber-400/35",
      "ring-1",
      "ring-amber-500/50"
    )
  }

  const needle = fold(snippet)
  if (needle.length < 12) return

  const blocks = [
    ...root.querySelectorAll("p, li, td, th, h1, h2, h3, h4, h5, h6"),
  ] as HTMLElement[]
  for (const el of blocks) {
    const haystack = fold(el.textContent ?? "")
    if (haystack && containsProbe(haystack, needle)) {
      el.setAttribute("data-citation-hl", "")
      el.classList.add(
        "rounded-sm",
        "bg-amber-400/35",
        "ring-1",
        "ring-amber-500/50"
      )
      el.scrollIntoView({ block: "center", behavior: "smooth" })
      return
    }
  }
}

function containsProbe(haystack: string, needle: string) {
  const maxProbe = Math.min(needle.length, 96)
  for (let n = maxProbe; n >= 16; n -= 8) {
    if (haystack.includes(needle.slice(0, n))) return true
  }
  return haystack.includes(needle.slice(0, Math.min(24, needle.length)))
}
