"use client"

import Link from "next/link"
import { ArrowLeft01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { APPLY_STEPS } from "@/lib/apply-wizard"
import { describeGoldCase, type GoldSetCase } from "@/lib/underwrite"
import { cn } from "@/lib/utils"

export function ApplySidebar({
  wizardStep,
  onStep,
  tourActive,
  samples,
  selectedCaseId,
  onLoadSample,
  onStartEmpty,
}: {
  wizardStep: number
  onStep: (index: number) => void
  tourActive: boolean
  samples: { caseId: string; label: string; row?: GoldSetCase }[]
  selectedCaseId: string | null
  onLoadSample: (id: string) => void
  onStartEmpty: () => void
}) {
  const selected = samples.find((sample) => sample.caseId === selectedCaseId)

  return (
    <aside className="flex w-60 shrink-0 flex-col border-e bg-muted/15 px-4 py-5">
      {tourActive ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />
          Back to overview
        </p>
      ) : (
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            strokeWidth={2}
            className="size-4"
          />
          Back to overview
        </Link>
      )}

      <p className="mt-8 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        Application
      </p>
      <ol className="mt-3 flex flex-col">
        {APPLY_STEPS.map((step, index) => {
          const done = index < wizardStep
          const current = index === wizardStep
          const last = index === APPLY_STEPS.length - 1
          const inbound = index > 0 && index <= wizardStep
          const outbound = !last && index < wizardStep
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => {
                  if (tourActive) return
                  onStep(index)
                }}
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start text-sm transition-colors",
                  current && "bg-muted",
                  !current && !tourActive && "hover:bg-muted/60"
                )}
              >
                {index > 0 ? (
                  <StepConnector edge="in" active={inbound} />
                ) : null}
                {last ? null : (
                  <StepConnector edge="out" active={outbound} />
                )}
                <span
                  className={cn(
                    "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full",
                    done && "bg-emerald-500 text-white",
                    current && !done && "bg-foreground text-background",
                    !done && !current && "border border-border bg-background"
                  )}
                >
                  {done ? (
                    <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-3" />
                  ) : (
                    <span className="text-[10px] font-semibold">{index + 1}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "min-w-0 truncate",
                    current ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {tourActive ? null : (
        <div className="mt-auto space-y-3 pt-8">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Load a labeled case
          </p>
          <div className="flex flex-col gap-1.5">
            {samples.map((sample) => (
              <Button
                key={sample.caseId}
                type="button"
                size="sm"
                variant={selectedCaseId === sample.caseId ? "default" : "outline"}
                disabled={!sample.row}
                className="justify-start"
                onClick={() => onLoadSample(sample.caseId)}
              >
                {sample.label}
              </Button>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={onStartEmpty}>
              Start empty
            </Button>
          </div>
          {selected?.row ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {describeGoldCase(selected.row)}
            </p>
          ) : null}
        </div>
      )}
    </aside>
  )
}

function StepConnector({
  edge,
  active,
}: {
  edge: "in" | "out"
  active: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-4.5 w-px",
        edge === "in" ? "top-0 h-2" : "bottom-0 h-2",
        active ? "bg-emerald-500" : "bg-border"
      )}
    />
  )
}
