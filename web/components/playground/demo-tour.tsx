"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { DEMO_HITL_CAUSE, DEMO_STEPS } from "@/lib/demo-tour"
import { cn } from "@/lib/utils"
import { useDemoTourStore } from "@/stores/demo-tour-store"
import { useUnderwriteStore } from "@/stores/underwrite-store"

export function DemoTourLauncher() {
  const active = useDemoTourStore((s) => s.active)
  const start = useDemoTourStore((s) => s.start)
  if (active) return null
  return (
    <Button type="button" variant="outline" size="sm" onClick={start}>
      Start demo
    </Button>
  )
}

export function DemoTourCard({
  onLoadRun,
}: {
  onLoadRun: (caseId: string) => Promise<void>
}) {
  const active = useDemoTourStore((s) => s.active)
  const stepIndex = useDemoTourStore((s) => s.stepIndex)
  const busy = useDemoTourStore((s) => s.busy)
  const next = useDemoTourStore((s) => s.next)
  const back = useDemoTourStore((s) => s.back)
  const stop = useDemoTourStore((s) => s.stop)
  const setBusy = useDemoTourStore((s) => s.setBusy)
  const openCitation = useDemoTourStore((s) => s.openCitation)
  const recordHitl = useUnderwriteStore((s) => s.recordHitl)
  const lastOutcomes = useUnderwriteStore((s) => s.lastOutcomes)

  const step = DEMO_STEPS[stepIndex]
  const last = stepIndex === DEMO_STEPS.length - 1

  React.useEffect(() => {
    if (!active || !step) return
    const node = document.querySelector(`[data-demo="${step.spotlight}"]`)
    node?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [active, step])

  if (!active || !step) return null

  async function onTryIt() {
    if (!step.tryIt) return
    try {
      setBusy(true)
      if (step.tryIt.action === "load-run" && step.caseId) {
        await onLoadRun(step.caseId)
        next()
        return
      }
      if (step.tryIt.action === "open-citation") {
        openCitation(0)
        return
      }
      if (step.tryIt.action === "record-hitl" && step.caseId && step.hitlOutcome) {
        const agentOutcome =
          lastOutcomes[step.caseId]?.outcome ?? step.hitlOutcome
        recordHitl(step.caseId, {
          outcome: step.hitlOutcome,
          cause: DEMO_HITL_CAUSE[step.caseId] ?? "",
          at: new Date().toISOString(),
          agentOutcome,
        })
        next()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-end sm:inset-x-6">
      <div
        className={cn(
          "pointer-events-auto w-full max-w-md rounded-2xl border bg-popover p-4 shadow-lg"
        )}
      >
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Demo · {stepIndex + 1} of {DEMO_STEPS.length}
        </p>
        <h3 className="font-heading mt-1 text-lg font-semibold tracking-tight">
          {step.title}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={stop}>
            Exit
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={stepIndex === 0 || busy}
              onClick={back}
            >
              Back
            </Button>
            {step.tryIt ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void onTryIt()}
              >
                {busy ? "Working…" : step.tryIt.label}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={next}>
                {last ? "Finish" : "Next"}
              </Button>
            )}
            {step.tryIt ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={next}
              >
                {last ? "Finish" : "Skip"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function demoSpotlightClass(active: boolean) {
  return cn(
    "rounded-2xl transition-shadow",
    active && "ring-2 ring-foreground/30 ring-offset-4 ring-offset-background"
  )
}
