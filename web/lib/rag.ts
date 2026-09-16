import { apiBase, jsonHeaders, readApiError } from "@/lib/api"

export type ProgramLayer =
  | "all"
  | "compliance_floor"
  | "eligibility_gate"
  | "sba_7a"
  | "cdfi_direct"

export type LenderFilter = "generic" | "accion" | "frontier_7a"

export type RagHit = {
  clause_id: string
  text: string
  score: number
  program: string
  source: string
  authority: string
  url?: string | null
  title?: string | null
  lender_id?: string | null
}

export type RagSearchResponse = {
  query: string
  index_name: string
  strategy: string
  program_filter: string | null
  lender_filter: string | null
  with_answer: boolean
  hits: RagHit[]
  answer: string | null
}

export type RagSearchParams = {
  query: string
  program: ProgramLayer
  lender: LenderFilter
  withAnswer: boolean
  topK: number
}

export const ragSearchKeys = {
  all: ["rag"] as const,
  searches: () => [...ragSearchKeys.all, "search"] as const,
  search: (params: RagSearchParams) =>
    [
      ...ragSearchKeys.searches(),
      {
        query: params.query.trim(),
        program: params.program,
        lender: params.lender,
        withAnswer: params.withAnswer,
        topK: params.topK,
      },
    ] as const,
}

export function hitKey(hit: RagHit, index: number) {
  return `${hit.clause_id}-${hit.score}-${index}`
}

export async function searchRag(
  params: RagSearchParams
): Promise<RagSearchResponse> {
  const res = await fetch(`${apiBase()}/rag/search`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      query: params.query,
      top_k: params.topK,
      program: params.program === "all" ? null : params.program,
      // Layer debugger: exact program match (shared layers only when "all").
      exact_program: params.program !== "all",
      // generic = no lender_id param → exclude lender-tagged chunks server-side
      lender_id: params.lender === "generic" ? null : params.lender,
      with_answer: params.withAnswer,
    }),
  })
  if (!res.ok) {
    throw new Error(await readApiError(res, "Search failed"))
  }
  return (await res.json()) as RagSearchResponse
}
