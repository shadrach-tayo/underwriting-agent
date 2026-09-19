"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  Search01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"

import { Markdown } from "@/components/markdown"
import { SourceLink } from "@/components/playground/source-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useRagSearchQuery } from "@/hooks/use-rag-search"
import { hitKey, type LenderFilter, type ProgramLayer, type RagHit } from "@/lib/rag"
import { formatLender, formatProgram } from "@/lib/underwrite"
import { cn } from "@/lib/utils"
import { useRagSearchStore } from "@/stores/rag-search-store"

const PROGRAM_OPTIONS: { value: ProgramLayer; label: string }[] = [
  { value: "all", label: "All layers" },
  { value: "compliance_floor", label: "Compliance floor" },
  { value: "eligibility_gate", label: "Eligibility gate" },
  { value: "sba_7a", label: "SBA 7(a)" },
  { value: "cdfi_direct", label: "CDFI Direct" },
]

const LENDER_OPTIONS: { value: LenderFilter; label: string }[] = [
  { value: "generic", label: "Generic (no lender overlay)" },
  { value: "accion", label: "Accion ∪ shared" },
  { value: "frontier_7a", label: "Frontier 7(a) ∪ shared" },
]

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
  const program = useRagSearchStore((s) => s.program)
  const lender = useRagSearchStore((s) => s.lender)
  const withAnswer = useRagSearchStore((s) => s.withAnswer)
  const openHits = useRagSearchStore((s) => s.openHits)
  const setQuery = useRagSearchStore((s) => s.setQuery)
  const setProgram = useRagSearchStore((s) => s.setProgram)
  const setLender = useRagSearchStore((s) => s.setLender)
  const setWithAnswer = useRagSearchStore((s) => s.setWithAnswer)
  const setHitOpen = useRagSearchStore((s) => s.setHitOpen)
  const expandAllHits = useRagSearchStore((s) => s.expandAllHits)
  const collapseAllHits = useRagSearchStore((s) => s.collapseAllHits)
  const clearResults = useRagSearchStore((s) => s.clearResults)

  const { result, errorMessage, isSearching, runSearch } = useRagSearchQuery()

  function openReference(index: number) {
    if (!result) return
    const hit = result.hits[index]
    if (!hit) return
    setHitOpen(hitKey(hit, index), true)
    requestAnimationFrame(() => {
      document
        .getElementById(`rag-hit-${index}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  function onQueryKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      void runSearch({ force: true })
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Policy RAG
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Dense retrieve from pgvector. Search state persists across navigation
          and refresh. Agent answer is opt-in via{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            POST /rag/search
          </code>
          .
        </p>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-4" />
            Search
          </CardTitle>
          <CardDescription>
            Filter by policy layer and optional lender overlay after retrieval.
            Turn on agent answer only when you want an LLM synthesis with
            citations.
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
              placeholder="Ask a policy question…"
              className="min-h-24 resize-y"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="rag-program">Program layer</Label>
              <Select
                value={program}
                onValueChange={(value) => {
                  if (value != null) setProgram(value as ProgramLayer)
                }}
              >
                <SelectTrigger id="rag-program" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAM_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rag-lender">Lender</Label>
              <Select
                value={lender}
                onValueChange={(value) => {
                  if (value != null) setLender(value as LenderFilter)
                }}
              >
                <SelectTrigger id="rag-lender" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LENDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex h-9 w-fit items-center gap-2 rounded-lg border border-border/80 bg-muted/30 px-3">
            <Checkbox
              id="agent-answer"
              checked={withAnswer}
              onCheckedChange={(checked) => setWithAnswer(checked === true)}
            />
            <Label
              htmlFor="agent-answer"
              className="flex cursor-pointer items-center gap-1.5 font-normal"
            >
              <HugeiconsIcon
                icon={SparklesIcon}
                strokeWidth={2}
                className="size-3.5 text-muted-foreground"
              />
              Agent answer
            </Label>
          </div>

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
            {isSearching
              ? withAnswer
                ? "Searching + answering…"
                : "Searching…"
              : withAnswer
                ? "Search + answer"
                : "Search policy"}
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
          openReference={openReference}
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
  openReference,
}: {
  result: NonNullable<ReturnType<typeof useRagSearchQuery>["result"]>
  openHits: Record<string, boolean>
  setHitOpen: (key: string, open: boolean) => void
  expandAllHits: (hits: RagHit[]) => void
  collapseAllHits: () => void
  openReference: (index: number) => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{result.hits.length} hits</Badge>
        <Badge variant="outline">{result.strategy}</Badge>
        {result.program_filter ? (
          <Badge variant="outline">
            {formatProgram(result.program_filter)}
          </Badge>
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
        {result.with_answer ? (
          <Badge variant="outline">agent answer</Badge>
        ) : null}
      </div>

      {result.answer ? (
        <Card className="ring-primary/15">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <HugeiconsIcon
                icon={SparklesIcon}
                strokeWidth={2}
                className="size-4"
              />
              Agent answer
            </CardTitle>
            <CardDescription>
              LLM synthesis over the retrieved chunks below. Use references to
              jump to source evidence.
            </CardDescription>
            <CardAction>
              <Badge variant="secondary">{result.hits.length} sources</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5 pt-(--card-spacing)">
            <Markdown>{result.answer}</Markdown>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  References
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Click to open a chunk
                </p>
              </div>
              <ol className="space-y-2">
                {result.hits.map((hit, index) => (
                  <li key={hitKey(hit, index)}>
                    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => openReference(index)}
                        className={cn(
                          "flex w-full items-start gap-3 text-start transition-colors",
                          "hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        )}
                      >
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-background font-mono text-[11px] font-medium ring-1 ring-border">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary" className="font-normal">
                              {formatProgram(hit.program)}
                            </Badge>
                            <Badge
                              variant={scoreTone(hit.score)}
                              className="font-mono font-normal"
                            >
                              {hit.score.toFixed(3)}
                            </Badge>
                          </span>
                          <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {snippet(hit.text)}
                          </span>
                        </span>
                      </button>
                      <SourceLink
                        href={hit.url}
                        className="mt-2 block truncate ps-9 font-mono text-[11px]"
                      >
                        {hit.title || sourceLabel(hit.source)}
                      </SourceLink>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
                      {hit.title || hit.source}
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
