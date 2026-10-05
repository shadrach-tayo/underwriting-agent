"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { officerDecisionLabel } from "@/lib/case-session"
import {
  friendlyDecision,
  type DecisionOutcome,
  type GoldSetCase,
} from "@/lib/underwrite"
import { cn } from "@/lib/utils"
import { useUnderwriteStore, type HitlRecord } from "@/stores/underwrite-store"

const ACTIONS: { value: DecisionOutcome; label: string }[] = [
  { value: "approve", label: "Approve" },
  { value: "deny", label: "Deny" },
  { value: "escalate", label: "Escalate" },
]

export function HitlBar({
  caseId,
  agentOutcome,
  gold,
}: {
  caseId: string
  agentOutcome: DecisionOutcome
  gold: GoldSetCase | null
}) {
  const hitl = useUnderwriteStore((s) => s.hitlDecisions[caseId])
  const recordHitl = useUnderwriteStore((s) => s.recordHitl)
  const [cause, setCause] = React.useState(hitl?.cause ?? "")

  React.useEffect(() => {
    setCause(hitl?.cause ?? "")
  }, [caseId, hitl?.cause])

  function onRecord(outcome: DecisionOutcome) {
    const record: HitlRecord = {
      outcome,
      cause: cause.trim(),
      at: new Date().toISOString(),
      agentOutcome,
    }
    recordHitl(caseId, record)
  }

  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 px-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold tracking-tight">
            Officer decision
          </p>
          <p className="text-xs text-muted-foreground">
            Record the decision on this case. A recommendation does not fund the loan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] tracking-wide uppercase">
          <span className="text-muted-foreground">
            Recommendation · {friendlyDecision(agentOutcome)}
          </span>
          {gold ? (
            <span className="text-muted-foreground">
              Expected · {friendlyDecision(gold.gold_outcome)}
            </span>
          ) : null}
          {hitl ? (
            <span className="font-semibold">
              Officer · {officerDecisionLabel(hitl.outcome)}
            </span>
          ) : null}
        </div>
      </div>
      <Textarea
        value={cause}
        onChange={(event) => setCause(event.target.value)}
        placeholder="Note for this outcome (optional)"
        rows={2}
      />
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <Button
            key={action.value}
            type="button"
            size="sm"
            variant={hitl?.outcome === action.value ? "default" : "outline"}
            className={cn(
              action.value === "deny" &&
                hitl?.outcome !== "deny" &&
                "text-red-700 hover:text-red-700 dark:text-red-400",
              action.value === "escalate" &&
                hitl?.outcome !== "escalate" &&
                "text-amber-800 hover:text-amber-800 dark:text-amber-300"
            )}
            onClick={() => onRecord(action.value)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </section>
  )
}
