"use client"

import * as React from "react"

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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type FormState = {
  business_name: string
  industry: string
  annual_revenue: string
  requested_loan_amount: string
  years_in_business: string
  notes: string
}

const initial: FormState = {
  business_name: "Northside Supply Co.",
  industry: "wholesale trade",
  annual_revenue: "180000",
  requested_loan_amount: "75000",
  years_in_business: "3",
  notes: "Synthetic applicant for dual-program routing demos.",
}

export default function PlaygroundPage() {
  const [form, setForm] = React.useState<FormState>(initial)
  const [submitted, setSubmitted] = React.useState<FormState | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Playground
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Interact with the underwriting agents once the FastAPI / LangGraph
          run endpoint is wired. For now this captures applicant shape and
          shows a local stub response.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applicant</CardTitle>
            <CardDescription>
              Synthetic / non-PII fields aligned with the graph{" "}
              <code className="font-mono text-xs">Applicant</code> model.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">Business name</span>
              <Input
                value={form.business_name}
                onChange={(e) => update("business_name", e.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">Industry</span>
              <Input
                value={form.industry}
                onChange={(e) => update("industry", e.target.value)}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">Revenue</span>
                <Input
                  inputMode="decimal"
                  value={form.annual_revenue}
                  onChange={(e) => update("annual_revenue", e.target.value)}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">Loan amount</span>
                <Input
                  inputMode="decimal"
                  value={form.requested_loan_amount}
                  onChange={(e) =>
                    update("requested_loan_amount", e.target.value)
                  }
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">Years in biz</span>
                <Input
                  inputMode="decimal"
                  value={form.years_in_business}
                  onChange={(e) => update("years_in_business", e.target.value)}
                />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">Notes</span>
              <Textarea
                rows={4}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </label>
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => {
                setSubmitted({ ...form })
              }}
            >
              Run agent (stub)
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>
              Placeholder until{" "}
              <code className="font-mono text-xs">POST /underwrite</code>{" "}
              exists on the API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {submitted ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">pending wiring</Badge>
                  <Badge variant="outline">program routing TBD</Badge>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">
                  {JSON.stringify(
                    {
                      applicant: submitted,
                      decision: null,
                      program_routing: null,
                      message:
                        "Connect playground to LangGraph / FastAPI next.",
                    },
                    null,
                    2
                  )}
                </pre>
              </>
            ) : (
              <p className="text-muted-foreground">
                Submit an applicant to see the stub payload.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
