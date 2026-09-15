"use client"

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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useUnderwriteStore } from "@/stores/underwrite-store"

export function UnderwritePanel() {
  const form = useUnderwriteStore((s) => s.form)
  const submitted = useUnderwriteStore((s) => s.submitted)
  const updateField = useUnderwriteStore((s) => s.updateField)
  const submitStub = useUnderwriteStore((s) => s.submitStub)
  const clearSubmitted = useUnderwriteStore((s) => s.clearSubmitted)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Underwrite
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Run the underwriting graph on a synthetic applicant. Form and stub
          result persist across navigation. Wired to{" "}
          <code className="font-mono text-xs">POST /underwrite</code> next.
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
            <div className="space-y-2">
              <Label htmlFor="business_name">Business name</Label>
              <Input
                id="business_name"
                value={form.business_name}
                onChange={(e) => updateField("business_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={form.industry}
                onChange={(e) => updateField("industry", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="annual_revenue">Revenue</Label>
                <Input
                  id="annual_revenue"
                  inputMode="decimal"
                  value={form.annual_revenue}
                  onChange={(e) =>
                    updateField("annual_revenue", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requested_loan_amount">Loan amount</Label>
                <Input
                  id="requested_loan_amount"
                  inputMode="decimal"
                  value={form.requested_loan_amount}
                  onChange={(e) =>
                    updateField("requested_loan_amount", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="years_in_business">Years in biz</Label>
                <Input
                  id="years_in_business"
                  inputMode="decimal"
                  value={form.years_in_business}
                  onChange={(e) =>
                    updateField("years_in_business", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={4}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="justify-between gap-2">
            {submitted ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => clearSubmitted()}
              >
                Clear result
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={() => submitStub()}>Run agent (stub)</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>
              Placeholder until the underwrite API is connected.
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
