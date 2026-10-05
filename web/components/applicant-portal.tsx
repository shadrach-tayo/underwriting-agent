"use client"

import * as React from "react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  borrowerOutcomeCopy,
  formatCaseStage,
  friendlyActivityMessage,
  officerDecisionLabel,
  NAMED_OFFICER,
  outstandingFromSession,
  PORTAL_TRACK,
  portalStepIndex,
} from "@/lib/case-session"
import { formatCurrency, formatProgram } from "@/lib/underwrite"
import { cn } from "@/lib/utils"
import {
  useCaseSessionHydrated,
  useCaseSessionStore,
} from "@/stores/case-session-store"
import { useDemoTourStore } from "@/stores/demo-tour-store"

export function ApplicantPortal() {
  const hydrated = useCaseSessionHydrated()
  const caseId = useCaseSessionStore((s) => s.caseId)
  const applicant = useCaseSessionStore((s) => s.applicant)
  const stage = useCaseSessionStore((s) => s.stage)
  const decision = useCaseSessionStore((s) => s.decision)
  const agentOutcome = useCaseSessionStore((s) => s.agentOutcome)
  const hitlOutcome = useCaseSessionStore((s) => s.hitlOutcome)
  const hitlCause = useCaseSessionStore((s) => s.hitlCause)
  const activity = useCaseSessionStore((s) => s.activity)
  const requests = useCaseSessionStore((s) => s.requests)
  const setPersona = useCaseSessionStore((s) => s.setPersona)
  const openLenderDesk = useCaseSessionStore((s) => s.openLenderDesk)
  const tourActive = useDemoTourStore((s) => s.active)

  React.useEffect(() => {
    if (!hydrated) return
    setPersona("applicant")
  }, [hydrated, setPersona])

  const step = portalStepIndex(stage)
  const copy = borrowerOutcomeCopy(hitlOutcome, agentOutcome)
  const outstanding = outstandingFromSession({ requests, decision })

  if (!hydrated) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
        <Header />
        <p className="text-sm text-muted-foreground">Loading file…</p>
      </div>
    )
  }

  if (!caseId || !applicant) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
        <Header />
        <p className="text-sm text-muted-foreground">
          No application in this session yet.
        </p>
        <Link href="/apply" className={cn(buttonVariants())}>
          Start an application
        </Link>
      </div>
    )
  }

  return (
    <div
      data-demo="portal"
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-12 sm:px-6",
        tourActive && "pb-56"
      )}
    >
      <Header />

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">{applicant.business_name}</h2>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(applicant.requested_loan_amount)}
          {applicant.requested_program
            ? ` · ${formatProgram(applicant.requested_program)}`
            : ""}
          {" · "}
          {formatCaseStage(stage)}
          {" · "}
          {caseId}
        </p>
        <p className="text-sm text-muted-foreground">
          Assigned officer: {NAMED_OFFICER}. A recommendation does not fund the loan.
        </p>
      </section>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PORTAL_TRACK.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              "rounded-xl border px-3 py-3",
              index <= step ? "border-foreground/20 bg-muted/50" : "opacity-60"
            )}
          >
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {index + 1}
            </p>
            <p className="mt-1 text-sm font-medium">{item.label}</p>
          </li>
        ))}
      </ol>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-medium">{copy.title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
        {hitlCause ? (
          <p className="text-sm text-muted-foreground">Officer note: {hitlCause}</p>
        ) : null}
        {hitlOutcome ? (
          <Badge variant="secondary">
            Officer {officerDecisionLabel(hitlOutcome).toLowerCase()}
          </Badge>
        ) : agentOutcome ? (
          <Badge variant="outline">Waiting on an officer</Badge>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">Open items</h2>
        {outstanding.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing else is needed from you right now.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {outstanding.map((item) => (
              <li key={item.id} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {item.source}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">Activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <ol className="space-y-3 border-s ps-4">
            {[...activity].reverse().map((event) => (
              <li key={event.id} className="space-y-0.5">
                <p className="text-sm">{friendlyActivityMessage(event.message)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(event.at).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {tourActive ? null : (
      <div className="flex flex-wrap gap-2">
        <Link
          href="/playground/underwrite"
          className={cn(buttonVariants())}
          onClick={() => openLenderDesk("file")}
        >
          Open the lender desk
        </Link>
        <Link
          href="/apply"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Edit application
        </Link>
      </div>
      )}
    </div>
  )
}

function Header() {
  return (
    <div className="space-y-2">
      <p className="font-heading text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        Applicant
      </p>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Status
      </h1>
    </div>
  )
}
