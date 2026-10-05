"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  DEMO_HITL_CAUSE,
  DEMO_INTRO,
  DEMO_STEPS,
} from "@/lib/demo-tour"
import { cn } from "@/lib/utils"
import { useCaseSessionStore } from "@/stores/case-session-store"
import { useDemoTourStore } from "@/stores/demo-tour-store"
import { useUnderwriteStore } from "@/stores/underwrite-store"

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

type SpotlightBox = { top: number; left: number; width: number; height: number }

export function DemoTourHost() {
  const router = useRouter()
  const pathname = usePathname()
  const active = useDemoTourStore((s) => s.active)
  const intro = useDemoTourStore((s) => s.intro)
  const autoplay = useDemoTourStore((s) => s.autoplay)
  const stepIndex = useDemoTourStore((s) => s.stepIndex)
  const busy = useDemoTourStore((s) => s.busy)
  const next = useDemoTourStore((s) => s.next)
  const back = useDemoTourStore((s) => s.back)
  const stop = useDemoTourStore((s) => s.stop)
  const begin = useDemoTourStore((s) => s.begin)
  const setAutoplay = useDemoTourStore((s) => s.setAutoplay)
  const setBusy = useDemoTourStore((s) => s.setBusy)
  const setScoring = useDemoTourStore((s) => s.setScoring)
  const openCitation = useDemoTourStore((s) => s.openCitation)
  const handlers = useDemoTourStore((s) => s.handlers)
  const recordHitl = useUnderwriteStore((s) => s.recordHitl)
  const lastOutcomes = useUnderwriteStore((s) => s.lastOutcomes)

  const step = DEMO_STEPS[stepIndex]
  const last = stepIndex === DEMO_STEPS.length - 1
  const onPage = Boolean(step && (!step.href || pathname === step.href))

  const syncedStep = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!active || intro || !step?.href) {
      syncedStep.current = null
      return
    }
    if (syncedStep.current === stepIndex) return
    syncedStep.current = stepIndex
    if (pathname !== step.href) router.push(step.href)
    if (step.spotlight === "apply" || step.spotlight === "portal") {
      useCaseSessionStore.getState().setPersona("applicant")
    } else {
      useCaseSessionStore.getState().openLenderDesk("file")
    }
  }, [active, intro, pathname, router, step, stepIndex])

  React.useEffect(() => {
    if (!active || intro || !step || !onPage) return
    const node = document.querySelector(`[data-demo="${step.spotlight}"]`)
    node?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [active, intro, onPage, pathname, step])

  const runAction = React.useCallback(async () => {
    if (!step) return
    if (last && step.action === "goto") {
      stop()
      return
    }
    try {
      setBusy(true)
      if (step.action === "goto") {
        next()
        return
      }
      if (step.action === "play-apply" && step.caseId) {
        if (!handlers.playApply) {
          throw new Error("Apply is still loading the gold set.")
        }
        await handlers.playApply(step.caseId)
        next()
        return
      }
      if (step.action === "submit-apply") {
        if (!handlers.submitApply) {
          throw new Error("Open Apply to submit the file.")
        }
        setScoring(true)
        await handlers.submitApply()
        await wait(1800)
        setScoring(false)
        next()
        return
      }
      if (step.action === "open-citation") {
        openCitation(0)
        await wait(1600)
        next()
        return
      }
      if (step.action === "record-hitl" && step.caseId && step.hitlOutcome) {
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
      setScoring(false)
    }
  }, [
    handlers.playApply,
    handlers.submitApply,
    last,
    lastOutcomes,
    next,
    openCitation,
    recordHitl,
    setBusy,
    setScoring,
    step,
    stop,
  ])

  React.useEffect(() => {
    if (!active || intro || !autoplay || busy || !step || !onPage) return
    const ready =
      step.action === "play-apply"
        ? Boolean(handlers.playApply)
        : step.action === "submit-apply"
          ? Boolean(handlers.submitApply)
          : true
    if (!ready) return
    const timer = window.setTimeout(() => {
      void runAction()
    }, step.holdMs)
    return () => window.clearTimeout(timer)
  }, [
    active,
    autoplay,
    busy,
    handlers.playApply,
    handlers.submitApply,
    intro,
    onPage,
    runAction,
    step,
    stepIndex,
  ])

  if (!active) return null

  if (intro) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-4">
        <div className="w-full max-w-lg rounded-3xl bg-popover p-6 shadow-2xl sm:p-8">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {DEMO_INTRO.kicker}
          </p>
          <h2 className="font-heading mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {DEMO_INTRO.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {DEMO_INTRO.body}
          </p>
          <p className="mt-4 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {DEMO_INTRO.hold}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              onClick={() => begin({ autoplay: false })}
            >
              Begin walkthrough
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => begin({ autoplay: true })}
            >
              or play it through
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="absolute top-4 right-4 rounded-full bg-popover px-3 py-1.5 text-sm shadow"
          onClick={stop}
        >
          Exit
        </button>
      </div>
    )
  }

  if (!step) return null

  return (
    <>
      <DemoSpotlight
        key={`${step.id}-${pathname}`}
        target={step.spotlight}
        ready={onPage}
      />
      <DemoCoach
        stepIndex={stepIndex}
        autoplay={autoplay}
        busy={busy}
        last={last}
        onBack={back}
        onExit={stop}
        onPause={() => setAutoplay(false)}
        onPlay={() => setAutoplay(true)}
        onSkip={next}
        onTryIt={() => void runAction()}
      />
    </>
  )
}

function DemoCoach({
  stepIndex,
  autoplay,
  busy,
  last,
  onBack,
  onExit,
  onPause,
  onPlay,
  onSkip,
  onTryIt,
}: {
  stepIndex: number
  autoplay: boolean
  busy: boolean
  last: boolean
  onBack: () => void
  onExit: () => void
  onPause: () => void
  onPlay: () => void
  onSkip: () => void
  onTryIt: () => void
}) {
  const step = DEMO_STEPS[stepIndex]
  const box = useSpotlightBox(step.spotlight)
  const style = coachStyle(box)

  return (
    <div
      className="pointer-events-auto fixed z-50 w-[min(100%-2rem,24rem)] rounded-2xl border bg-popover p-4 shadow-xl"
      style={style}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Step {stepIndex + 1} of {DEMO_STEPS.length}
          </p>
          <div className="mt-2 flex gap-1">
            {DEMO_STEPS.map((item, index) => (
              <span
                key={item.id}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  index <= stepIndex ? "bg-foreground" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={onExit}
        >
          Exit
        </button>
      </div>
      <h3 className="font-heading mt-3 text-lg font-semibold tracking-tight text-balance">
        {step.title}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {step.body}
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {step.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-foreground" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg bg-muted/70 px-3 py-2 text-sm">
        Next up: {step.tryIt}.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {autoplay ? (
            <Button type="button" variant="ghost" size="sm" onClick={onPause}>
              Pause
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={onPlay}>
              Play through
            </Button>
          )}
          <Button type="button" size="sm" disabled={busy} onClick={onTryIt}>
            {busy ? "Working…" : step.tryIt}
          </Button>
          {last ? null : (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={busy}
              onClick={onSkip}
              aria-label="Skip"
            >
              →
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function DemoSpotlight({
  target,
  ready,
}: {
  target: string
  ready: boolean
}) {
  const box = useSpotlightBox(ready ? target : null)
  if (!box) {
    return <div className="pointer-events-none fixed inset-0 z-40 bg-foreground/40" />
  }
  return (
    <div
      className="pointer-events-none fixed z-40 rounded-2xl ring-2 ring-background"
      style={{
        top: box.top - 8,
        left: box.left - 8,
        width: box.width + 16,
        height: box.height + 16,
        boxShadow: "0 0 0 9999px color-mix(in oklch, var(--foreground) 40%, transparent)",
      }}
    />
  )
}

function useSpotlightBox(target: string | null) {
  const [box, setBox] = React.useState<SpotlightBox | null>(null)

  React.useEffect(() => {
    if (!target) {
      setBox(null)
      return
    }
    let observed: Element | null = null
    let resize: ResizeObserver | null = null
    function measure() {
      const node = document.querySelector(`[data-demo="${target}"]`)
      if (!node) {
        setBox(null)
        return
      }
      if (node !== observed) {
        resize?.disconnect()
        observed = node
        resize = new ResizeObserver(measure)
        resize.observe(node)
      }
      const rect = node.getBoundingClientRect()
      setBox({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    }
    measure()
    const mutation = new MutationObserver(measure)
    mutation.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-demo"],
      childList: true,
    })
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => {
      resize?.disconnect()
      mutation.disconnect()
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
  }, [target])

  return box
}

function coachStyle(box: SpotlightBox | null): React.CSSProperties {
  const gutter = 16
  const width = 384
  const height = 360
  if (typeof window === "undefined" || !box || box.height > window.innerHeight * 0.55) {
    return { left: gutter, bottom: gutter }
  }
  let top = box.top + box.height + 12
  let left = box.left
  if (top + height > window.innerHeight - gutter) {
    top = Math.max(gutter, box.top - height - 12)
  }
  if (left + width > window.innerWidth - gutter) {
    left = Math.max(gutter, window.innerWidth - width - gutter)
  }
  return { top, left }
}

export function DemoTourLauncher({
  className,
}: {
  className?: string
}) {
  const active = useDemoTourStore((s) => s.active)
  const start = useDemoTourStore((s) => s.start)
  if (active) return null
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(className)}
      onClick={() => start()}
    >
      Walk through
    </Button>
  )
}

export function demoSpotlightClass(active: boolean) {
  return cn(
    "relative rounded-2xl transition-shadow",
    active && "z-[41]"
  )
}
