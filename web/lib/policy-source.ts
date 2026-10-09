import { apiBase } from "@/lib/api"
import type { RagHit } from "@/lib/rag"
import type { Citation } from "@/lib/underwrite"

const PAGE_IN_CLAUSE = /:p(\d+)$/i

export function sourceExtension(name: string | null | undefined) {
  const file = filenameFromSource(name).toLowerCase()
  const dot = file.lastIndexOf(".")
  return dot >= 0 ? file.slice(dot + 1) : ""
}

export function isPdfSource(name: string | null | undefined) {
  return sourceExtension(name) === "pdf"
}

export function isDocxSource(name: string | null | undefined) {
  const ext = sourceExtension(name)
  return ext === "docx" || ext === "doc"
}

export function canPreviewSource(name: string | null | undefined) {
  return isPdfSource(name) || isDocxSource(name)
}

function filenameFromSource(value: string | null | undefined) {
  if (!value) return ""
  const stem = value.split(":")[0]?.trim() ?? ""
  return stem.split(/[/\\]/).pop() ?? stem
}

export function citationFilename(
  citation: Pick<Citation, "clause_id" | "source">
) {
  const candidates = [
    citation.source.name,
    citation.source.source_id,
    citation.clause_id,
  ]
  for (const value of candidates) {
    const name = filenameFromSource(value)
    if (name && /\.[a-z0-9]+$/i.test(name)) return name
  }
  return filenameFromSource(citation.source.name)
}

export function policySourceFileUrl(
  filename: string,
  page?: number | null
) {
  const url = `${apiBase()}/policy-sources/${encodeURIComponent(filename)}`
  if (!isPdfSource(filename) || page == null || !Number.isFinite(page)) {
    return url
  }
  return `${url}#page=${pdfPageNumber(page)}`
}

export function citationPage(citation: Pick<Citation, "page" | "clause_id">) {
  if (typeof citation.page === "number" && citation.page >= 0) {
    return citation.page
  }
  const match = PAGE_IN_CLAUSE.exec(citation.clause_id)
  return match ? Number(match[1]) : null
}

export function pdfPageNumber(page: number | null | undefined) {
  if (page == null || !Number.isFinite(page)) return 1
  return page < 1 ? 1 : Math.floor(page)
}

const LABEL_MAX = 48
const GROUP_SNIPPET = 96

function foldSnippet(value: string) {
  return value
    .replace(/[\s\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000]+/g, " ")
    .trim()
    .toLowerCase()
}

function clauseLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) =>
      line.replace(/^#+\s+/, "").replace(/^[-*•]\s+/, "").trim()
    )
    .filter(Boolean)
}

function truncateAtWord(value: string, max: number) {
  if (value.length <= max) return value
  const slice = value.slice(0, max)
  const cut = slice.lastIndexOf(" ")
  return `${(cut >= 24 ? slice.slice(0, cut) : slice).trim()}…`
}

function headingFromLine(line: string) {
  const compact = line.replace(/\s+/g, " ").trim()
  if (!compact) return ""
  const lead = compact.split(/\s+[–—:]\s+/)[0]?.trim() ?? compact
  return truncateAtWord(
    lead.length >= 20 && lead.length <= 56 ? lead : compact,
    LABEL_MAX
  )
}

function sourceTitle(citation: Citation) {
  return (
    citation.source.title?.trim() ||
    citation.source.name.replace(/\.[^.]+$/, "")
  )
}

function pdfPagePrefix(citation: Citation) {
  if (!isPdfSource(citationFilename(citation))) return ""
  const page = citationPage(citation)
  return page != null ? `p.${pdfPageNumber(page)} · ` : ""
}

function labelsOverlap(a: string, b: string) {
  const left = foldSnippet(a).slice(0, 28)
  const right = foldSnippet(b).slice(0, 28)
  return Boolean(
    left &&
      right &&
      (left === right || left.startsWith(right) || right.startsWith(left))
  )
}

function locusCandidates(citation: Citation) {
  const lines = clauseLines(citation.retrieved_text ?? "")
  const prefix = pdfPagePrefix(citation)
  const fromLines = lines
    .slice(0, 5)
    .map(headingFromLine)
    .filter(Boolean)
    .map((heading) => `${prefix}${heading}`)
  const compact = lines.join(" ")
  const mid =
    compact.length > 80 ? `${prefix}${truncateAtWord(compact.slice(48), LABEL_MAX)}` : ""
  return mid ? [...fromLines, mid] : fromLines
}

export function citationLabel(citation: Citation) {
  const heading = headingFromLine(clauseLines(citation.retrieved_text ?? "")[0] ?? "")
  const title = sourceTitle(citation)
  const prefix = pdfPagePrefix(citation)
  if (prefix) return `${prefix}${heading || title}`
  return heading || title
}

/** Distinct chip labels when two passages start the same way. */
export function citationChipLabels(citations: Citation[]) {
  const used = new Set<string>()
  return citations.map((citation) => {
    const title = sourceTitle(citation)
    const candidates = [citationLabel(citation), ...locusCandidates(citation), title]
    const pick =
      candidates.find(
        (label) => label && ![...used].some((prior) => labelsOverlap(prior, label))
      ) ??
      candidates[0] ??
      title
    used.add(pick)
    return pick
  })
}

/** One chip per cited locus. PDFs split by page; Word by passage. */
export function citationGroupKey(
  citation: Pick<Citation, "clause_id" | "page" | "retrieved_text" | "source">
) {
  const file = citationFilename(citation)
  if (isPdfSource(file)) {
    return `${file.toLowerCase()}::p${pdfPageNumber(citationPage(citation))}`
  }
  const snippet = foldSnippet(citation.retrieved_text ?? "").slice(0, GROUP_SNIPPET)
  if (file && snippet) return `${file.toLowerCase()}::${snippet}`
  return (snippet || citation.clause_id || file).toLowerCase()
}

function uniqueByLocus<T>(
  items: T[],
  toCitation: (item: T) => Citation,
  score: (item: T) => number
) {
  const best = new Map<string, T>()
  const order: string[] = []
  for (const item of items) {
    const key = citationGroupKey(toCitation(item))
    const current = best.get(key)
    if (!current) {
      best.set(key, item)
      order.push(key)
      continue
    }
    if (score(item) > score(current)) best.set(key, item)
  }
  return order.map((key) => best.get(key)!)
}

export function uniqueCitationsBySource(citations: Citation[]) {
  return uniqueByLocus(
    citations,
    (citation) => citation,
    (citation) => citation.similarity_score
  )
}

export function uniqueRagHitsBySource(hits: RagHit[]) {
  return uniqueByLocus(hits, ragHitToCitation, (hit) => hit.score)
}

export function presentCitations(citations: Citation[]) {
  const items = uniqueCitationsBySource(citations)
  return { items, labels: citationChipLabels(items) }
}

export function presentRagHits(hits: RagHit[]) {
  const items = uniqueRagHitsBySource(hits)
  return { items, labels: citationChipLabels(items.map(ragHitToCitation)) }
}

export function ragHitToCitation(hit: RagHit): Citation {
  return {
    clause_id: hit.clause_id,
    retrieved_text: hit.text,
    similarity_score: hit.score,
    program: hit.program,
    page: hit.page ?? null,
    grounding_score: null,
    grounded: null,
    source: {
      source_id: hit.source,
      name: hit.source,
      authority: hit.authority,
      version: "",
      effective_date: "",
      program: hit.program,
      title: hit.title,
      url: hit.url,
      lender_id: hit.lender_id,
    },
  }
}
