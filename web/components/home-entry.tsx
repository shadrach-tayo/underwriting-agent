"use client"

import Link from "next/link"

import { AskAiButton } from "@/components/ask-ai-button"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useCaseSessionStore } from "@/stores/case-session-store"
import { useDemoTourStore } from "@/stores/demo-tour-store"

export function HomeLanding() {
  const setPersona = useCaseSessionStore((s) => s.setPersona)
  const openLenderDesk = useCaseSessionStore((s) => s.openLenderDesk)
  const start = useDemoTourStore((s) => s.start)

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.02_250)_0%,_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_oklch(0.28_0.03_250)_0%,_transparent_55%)]"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-20 px-4 py-16 sm:px-6 sm:py-24">
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <p className="font-heading text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Demo
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Auto-decide inside the envelope. Escalate every other case.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-pretty">
            Agentic underwriting for any kind of lending. Clear cases decide
            themselves. The rest go to a person with a cited trace, and the
            risk ceiling is hard-coded.
          </p>
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" onClick={() => start()}>
                Walk through a case
              </Button>
              <AskAiButton size="lg" variant="outline">
                Ask about policy
              </AskAiButton>
            </div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Local session · seven steps
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => start({ autoplay: true })}
            >
              or play it through
            </Button>
          </div>
        </section>

        <section className="grid gap-10 sm:grid-cols-2">
          <div className="flex flex-col gap-4 border-t border-border pt-8">
            <h2 className="font-heading text-xl font-medium">
              Lender desk
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              See which cases auto-decide, and which ones stop at the risk
              ceiling with the citation-grounded trace an officer reviews.
            </p>
            <div>
              <Link
                href="/playground/underwrite"
                className={cn(buttonVariants({ size: "lg" }))}
                onClick={() => openLenderDesk("catalog")}
              >
                Open the desk
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-4 border-t border-border pt-8">
            <h2 className="font-heading text-xl font-medium">
              Applicant side
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Submit an application and follow that same case after it
              auto-decides or escalates.
            </p>
            <div>
              <Link
                href="/apply"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                onClick={() => setPersona("applicant")}
              >
                Open the application
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
