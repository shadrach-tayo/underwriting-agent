import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function Page() {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.02_250)_0%,_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_oklch(0.28_0.03_250)_0%,_transparent_55%)]"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl space-y-4">
          <p className="font-heading text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Underwriting Console
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Inspect policy RAG. Run the agents.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-pretty">
            Admin tools for the layered policy corpus (compliance floor,
            eligibility gate, SBA 7(a), CDFI direct) and a playground for
            underwriting decisions with citation-backed escalation.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/admin" className={cn(buttonVariants())}>
              Open Admin
            </Link>
            <Link
              href="/playground"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Open Playground
            </Link>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <section className="space-y-2 border-t border-border pt-6">
            <h2 className="font-heading text-lg font-medium">Admin</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Index status, dry-run / rebuild ingest against pgvector, and
              source inspection for lender-specific policies later.
            </p>
          </section>
          <section className="space-y-2 border-t border-border pt-6">
            <h2 className="font-heading text-lg font-medium">Playground</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Submit synthetic applicants, watch program routing, and review
              escalation packages before wiring the full HITL UI.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
