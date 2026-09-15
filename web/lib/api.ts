/** Shared FastAPI base URL helpers for the Next.js console. */

export const apiBase = () =>
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8080"

export function jsonHeaders(extra?: HeadersInit): HeadersInit {
  return { "Content-Type": "application/json", ...extra }
}

export function adminHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" }
  const key = process.env.NEXT_PUBLIC_ADMIN_API_KEY
  if (key) {
    headers["X-Admin-Key"] = key
  }
  return headers
}

/** Pull a short user-facing message out of FastAPI / provider error bodies. */
export function formatApiError(status: number, body: string): string {
  const trimmed = body.trim()
  if (!trimmed) {
    return `Request failed (${status})`
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    const detail = extractDetail(parsed)
    if (detail) {
      return unwrapProviderMessage(detail)
    }
  } catch {
    // not JSON — fall through
  }

  return unwrapProviderMessage(trimmed)
}

function extractDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null
  const detail = (payload as { detail?: unknown }).detail
  if (typeof detail === "string" && detail.trim()) return detail.trim()
  if (detail && typeof detail === "object") {
    const nested = extractDetail(detail)
    if (nested) return nested
    const msg = (detail as { message?: unknown }).message
    if (typeof msg === "string" && msg.trim()) return msg.trim()
  }
  const message = (payload as { message?: unknown }).message
  if (typeof message === "string" && message.trim()) return message.trim()
  const error = (payload as { error?: unknown }).error
  if (error && typeof error === "object") {
    const msg = (error as { message?: unknown }).message
    if (typeof msg === "string" && msg.trim()) return msg.trim()
  }
  return null
}

function unwrapProviderMessage(text: string): string {
  // Error code: 429 - {'error': {'message': '...', ...}}
  const quoted = text.match(/['"]message['"]\s*:\s*['"]([^'"]+)['"]/)
  if (quoted?.[1]) {
    return quoted[1].trim()
  }
  // Agent answer failed: You have no credits...
  const prefixes = [
    "Agent answer failed: ",
    "Retrieval failed: ",
    "Error code: ",
  ]
  for (const prefix of prefixes) {
    if (text.includes(prefix) && text.includes(" - ")) {
      const tail = text.slice(text.lastIndexOf(" - ") + 3).trim()
      const nested = unwrapProviderMessage(tail)
      if (nested && !nested.startsWith("{")) return nested
    }
  }
  return text
}

export async function readApiError(
  res: Response,
  fallbackLabel = "Request failed"
): Promise<string> {
  const body = await res.text()
  return formatApiError(res.status, body) || `${fallbackLabel} (${res.status})`
}
