"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { adminHeaders, apiBase, readApiError } from "@/lib/api"

type RagStatus = {
  index_name: string
  strategy: string
  ingest_targets: string[]
  allow_hybrid: boolean
  database_configured: boolean
  database_reachable: boolean
  index_exists: boolean | null
  row_count: number | null
  source_files: string[]
  voyage_configured: boolean
  deepseek_configured: boolean
}

type IngestResponse = {
  status: string
  index_name: string
  targets: string[]
  source_units: number
  by_program: Record<string, number>
  source_files: string[]
}

export default function AdminPage() {
  const [status, setStatus] = React.useState<RagStatus | null>(null)
  const [ingestResult, setIngestResult] = React.useState<IngestResponse | null>(
    null
  )
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const refreshStatus = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase()}/admin/rag/status`, {
        headers: adminHeaders(),
      })
      if (!res.ok) {
        throw new Error(await readApiError(res, "Status request failed"))
      }
      setStatus((await res.json()) as RagStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  async function runIngest(dryRun: boolean) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase()}/admin/rag/ingest`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ dry_run: dryRun }),
      })
      if (!res.ok) {
        throw new Error(await readApiError(res, "Ingest failed"))
      }
      setIngestResult((await res.json()) as IngestResponse)
      if (!dryRun) {
        await refreshStatus()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Admin
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Inspect the policy RAG index and trigger ingest against pgvector.
          API:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {apiBase()}
          </code>
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>RAG status</CardTitle>
            <CardDescription>
              Live view of index configuration and corpus files on disk.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {status ? (
              <>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                  <dt className="text-muted-foreground">Index</dt>
                  <dd className="font-mono text-xs">{status.index_name}</dd>
                  <dt className="text-muted-foreground">Strategy</dt>
                  <dd>{status.strategy}</dd>
                  <dt className="text-muted-foreground">Targets</dt>
                  <dd className="flex flex-wrap gap-1">
                    {status.ingest_targets.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </dd>
                  <dt className="text-muted-foreground">Database</dt>
                  <dd>
                    {status.database_reachable ? "reachable" : "unreachable"}
                  </dd>
                  <dt className="text-muted-foreground">Table</dt>
                  <dd>
                    {status.index_exists == null
                      ? "unknown"
                      : status.index_exists
                        ? `exists (${status.row_count ?? "?"} rows)`
                        : "missing"}
                  </dd>
                  <dt className="text-muted-foreground">Voyage</dt>
                  <dd>
                    {status.voyage_configured ? "configured" : "missing key"}
                  </dd>
                  <dt className="text-muted-foreground">DeepSeek</dt>
                  <dd>
                    {status.deepseek_configured ? "configured" : "missing key"}
                  </dd>
                </dl>
                <Separator />
                <div>
                  <p className="mb-2 text-muted-foreground">Source files</p>
                  <ul className="space-y-1 font-mono text-xs">
                    {status.source_files.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">
                {loading
                  ? "Loading…"
                  : "No status yet — start `uv run underwriting-api`."}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => void refreshStatus()} disabled={loading}>
              Refresh
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingest</CardTitle>
            <CardDescription>
              Dry-run loads and tags sources; rebuild embeds into pgvector.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {ingestResult ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant="outline">{ingestResult.status}</Badge>
                </dd>
                <dt className="text-muted-foreground">Units</dt>
                <dd>{ingestResult.source_units}</dd>
                <dt className="text-muted-foreground">By program</dt>
                <dd className="font-mono text-xs">
                  {Object.entries(ingestResult.by_program)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(", ") || "—"}
                </dd>
              </dl>
            ) : (
              <p className="text-muted-foreground">
                No ingest run in this session yet.
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void runIngest(true)}
            >
              Dry run
            </Button>
            <Button disabled={loading} onClick={() => void runIngest(false)}>
              Rebuild index
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
