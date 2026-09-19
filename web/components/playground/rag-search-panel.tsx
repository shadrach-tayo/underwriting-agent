"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, Search01Icon } from "@hugeicons/core-free-icons"

import { Markdown } from "@/components/markdown"
import { RagFilters } from "@/components/playground/rag-filters"
import { SourceLink } from "@/components/playground/source-link"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useRagSearchQuery } from "@/hooks/use-rag-search"
import { hitKey, type RagHit } from "@/lib/rag"
import { formatLender, formatProgram } from "@/lib/underwrite"
import { cn } from "@/lib/utils"
import { useRagSearchStore } from "@/stores/rag-search-store"

function scoreTone(score: number) {
  if (score >= 0.55) return "default" as const
  if (score >= 0.35) return "secondary" as const
  return "outline" as const
}

function sourceLabel(source: string) {
  const base = source.split("/").pop() ?? source
  return base.length > 48 ? `${base.slice(0, 45)}…` : base
}

function snippet(text: string, max = 140) {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max).trimEnd()}…`
}

export function RagSearchPanel() {
  const query = useRagSearchStore((s) => s.query)
  const openHits = useRagSearchStore((s) => s.openHits)
  const setQuery = useRagSearchStore((s) => s.setQuery)
  const setHitOpen = useRagSearchStore((s) => s.setHitOpen)
  const expandAllHits = useRagSearchStore((s) => s.expandAllHits)
  const collapseAllHits = useRagSearchStore((s) => s.collapseAllHits)
  const clearResults = useRagSearchStore((s) => s.clearResults)

  const { result, errorMessage, isSearching, runSearch } = useRagSearchQuery()

  function onQueryKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      void runSearch({ force: true })
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-4" />
            Search
          </CardTitle>
          <CardDescription>
            Pure retrieval — no LLM. Filter by policy layer and optional lender
            overlay after the dense search.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-(--card-spacing)">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="rag-query">Query</Label>
              <span className="text-[11px] text-muted-foreground">
                ⌘/Ctrl + Enter
              </span>
            </div>
            <Textarea
              id="rag-query"
              rows={3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onQueryKeyDown}
              placeholder="Search policy clauses…"
              className="min-h-24 resize-y"
            />
          </div>

          <RagFilters programId="rag-program" lenderId="rag-lender" />

          {errorMessage ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Ingest policies from{" "}
              <code className="font-mono text-[11px]">/admin</code> first.
            </p>
            {result ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => clearResults()}
              >
                Clear results
              </Button>
            ) : null}
          </div>
          <Button
            disabled={isSearching || !query.trim()}
            onClick={() => void runSearch({ force: true })}
          >
            {isSearching ? "Searching…" : "Search policy"}
          </Button>
        </CardFooter>
      </Card>

      {result ? (
        <ResultsSection
          result={result}
          openHits={openHits}
          setHitOpen={setHitOpen}
          expandAllHits={expandAllHits}
          collapseAllHits={collapseAllHits}
        />
      ) : null}
    </div>
  )
}

function ResultsSection({
  result,
  openHits,
  setHitOpen,
  expandAllHits,
  collapseAllHits,
}: {
  result: NonNullable<ReturnType<typeof useRagSearchQuery>["result"]>
  openHits: Record<string, boolean>
  setHitOpen: (key: string, open: boolean) => void
  expandAllHits: (hits: RagHit[]) => void
  collapseAllHits: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{result.hits.length} hits</Badge>
        <Badge variant="outline">{result.strategy}</Badge>
        {result.program_filter ? (
          <Badge variant="outline">{formatProgram(result.program_filter)}</Badge>
        ) : (
          <Badge variant="outline">all layers</Badge>
        )}
        {result.lender_filter ? (
          <Badge variant="outline">
            Lender · {formatLender(result.lender_filter)}
          </Badge>
        ) : (
          <Badge variant="outline">generic</Badge>
        )}
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-heading text-sm font-semibold tracking-tight">
              Retrieved chunks
            </h2>
            <p className="text-xs text-muted-foreground">
              Expand a hit to read the full markdown passage.
            </p>
          </div>
          {result.hits.length > 0 ? (
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => expandAllHits(result.hits)}
              >
                Expand all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => collapseAllHits()}
              >
                Collapse all
              </Button>
            </div>
          ) : null}
        </div>

        {result.hits.length === 0 ? (
          <Card size="sm">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No chunks matched this query. Try another layer or rephrase.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {result.hits.map((hit, index) => {
              const key = hitKey(hit, index)
              const open = openHits[key] ?? false
              return (
                <Collapsible
                  key={key}
                  open={open}
                  onOpenChange={(next) => setHitOpen(key, next)}
                >
                  <div
                    id={`rag-hit-${index}`}
                    className={cn(
                      "overflow-hidden rounded-xl ring-1 ring-foreground/10 transition-colors",
                      open ? "bg-card" : "bg-card/70 hover:bg-card"
                    )}
                  >
                    <CollapsibleTrigger
                      className={cn(
                        "group/hit flex w-full items-start gap-3 px-4 pt-3 text-start outline-none",
                        "focus-visible:ring-3 focus-visible:ring-ring/50",
                        open ? "pb-1.5" : "pb-3"
                      )}
                    >
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[11px] font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 space-y-2">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary">
                            {formatProgram(hit.program)}
                          </Badge>
                          <Badge
                            variant={scoreTone(hit.score)}
                            className="font-mono"
                          >
                            {hit.score.toFixed(3)}
                          </Badge>
                          {hit.authority ? (
                            <Badge variant="outline" className="font-normal">
                              {hit.authority}
                            </Badge>
                          ) : null}
                          {hit.lender_id ? (
                            <Badge variant="outline" className="font-normal">
                              {formatLender(hit.lender_id)}
                            </Badge>
                          ) : null}
                        </span>
                        {!open ? (
                          <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {snippet(hit.text, 180)}
                          </span>
                        ) : null}
                      </span>
                      <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        strokeWidth={2}
                        className={cn(
                          "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
                          open && "rotate-180"
                        )}
                      />
                    </CollapsibleTrigger>
                    <SourceLink
                      href={hit.url}
                      className="block truncate px-4 pb-3 ps-13 font-mono text-[11px]"
                    >
                      {hit.title || hit.source || sourceLabel(hit.source)}
                    </SourceLink>
                    <CollapsibleContent className="overflow-hidden data-open:animate-accordion-down data-closed:animate-accordion-up">
                      <div className="space-y-3 border-t border-border/70 px-4 py-3 ps-13">
                        <Markdown>{hit.text}</Markdown>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {hit.clause_id}
                        </p>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
