import { apiBase } from "@/lib/api"
import type { RagHit } from "@/lib/rag"
import type { Citation } from "@/lib/underwrite"

const PAGE_IN_CLAUSE = /:p(\d+)$/i

export function isPdfSource(name: string | null | undefined) {
  return Boolean(filenameFromSource(name)?.toLowerCase().endsWith(".pdf"))
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

export function policySourceFileUrl(filename: string) {
  return `${apiBase()}/policy-sources/${encodeURIComponent(filename)}`
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

export function citationLabel(citation: Citation) {
  const title =
    citation.source.title?.trim() ||
    citation.source.name.replace(/\.[^.]+$/, "")
  const page = citationPage(citation)
  return page != null ? `${title} · p.${pdfPageNumber(page)}` : title
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
