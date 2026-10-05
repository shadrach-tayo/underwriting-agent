"use client"

import * as React from "react"
import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useCaseSessionStore } from "@/stores/case-session-store"

export function DeskPersonaSeams() {
  const caseId = useCaseSessionStore((s) => s.caseId)
  const setPersona = useCaseSessionStore((s) => s.setPersona)
  const requestFromBorrower = useCaseSessionStore((s) => s.requestFromBorrower)
  const [message, setMessage] = React.useState("")
  const [sent, setSent] = React.useState<string | null>(null)

  function onSend() {
    if (!message.trim() || !caseId) return
    requestFromBorrower(message)
    setSent(message.trim())
    setMessage("")
  }

  return (
    <section
      data-demo="switch"
      className="space-y-3 rounded-xl border px-4 py-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold tracking-tight">Applicant seat</p>
          <p className="text-xs text-muted-foreground">
            Same application. Questions stay in this browser.
          </p>
        </div>
        <Link
          href="/portal"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          onClick={() => setPersona("applicant")}
        >
          Open applicant page
        </Link>
      </div>
      <Textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Write a question for the applicant…"
        rows={2}
        disabled={!caseId}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!caseId || !message.trim()}
          onClick={onSend}
        >
          Send to applicant
        </Button>
        {sent ? (
          <p className="text-xs text-muted-foreground">Sent to portal: {sent}</p>
        ) : null}
      </div>
    </section>
  )
}
