import { apiBase, jsonHeaders, readApiError } from "@/lib/api"

export type ProgramLayer =
  | "all"
  | "compliance_floor"
  | "eligibility_gate"
  | "sba_7a"
  | "cdfi_direct"

export type LenderFilter = "generic" | "accion" | "frontier_7a"

export type PolicyRagMode = "search" | "chat"

export type RagHit = {
  clause_id: string
  text: string
  score: number
  program: string
  authority: string
  source: string
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
  topK: number
}

export type RagChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type RagStreamEvent =
  | { type: "status"; text: string }
  | {
      type: "sources"
      hits: RagHit[]
      index_name?: string
      strategy?: string
      program_filter?: string | null
      lender_filter?: string | null
    }
  | { type: "reasoning"; text: string }
  | { type: "token"; text: string }
  | { type: "done"; answer: string }
  | { type: "error"; detail: string }

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
        topK: params.topK,
      },
    ] as const,
}

export function hitKey(hit: RagHit, index: number) {
  return `${hit.clause_id}-${hit.score}-${index}`
}

export function ragScopeBody(params: Pick<RagSearchParams, "program" | "lender" | "topK">) {
  return {
    top_k: params.topK,
    program: params.program === "all" ? null : params.program,
    exact_program: params.program !== "all",
    lender_id: params.lender === "generic" ? null : params.lender,
  }
}

export async function searchRag(
  params: RagSearchParams
): Promise<RagSearchResponse> {
  const res = await fetch(`${apiBase()}/rag/search`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      query: params.query,
      ...ragScopeBody(params),
      with_answer: false,
    }),
  })
  if (!res.ok) {
    throw new Error(await readApiError(res, "Search failed"))
  }
  return (await res.json()) as RagSearchResponse
}

export async function* streamRagAsk(
  params: RagSearchParams & { messages?: RagChatMessage[] },
  signal?: AbortSignal
): AsyncGenerator<RagStreamEvent> {
  const res = await fetch(`${apiBase()}/rag/ask/stream`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      query: params.query,
      messages: params.messages ?? [],
      ...ragScopeBody(params),
    }),
    signal,
  })
  if (!res.ok) {
    throw new Error(await readApiError(res, "Chat failed"))
  }
  if (!res.body) {
    throw new Error("Chat stream was empty")
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split("\n\n")
    buffer = chunks.pop() ?? ""
    for (const chunk of chunks) {
      const event = parseSseChunk(chunk)
      if (event) yield event
    }
  }

  const trailing = parseSseChunk(buffer)
  if (trailing) yield trailing
}

function parseSseChunk(chunk: string): RagStreamEvent | null {
  const line = chunk
    .split("\n")
    .map((part) => part.trimEnd())
    .find((part) => part.startsWith("data:"))
  if (!line) return null
  const payload = line.replace(/^data:\s?/, "").trim()
  if (!payload || payload === "[DONE]") return null
  return JSON.parse(payload) as RagStreamEvent
}
