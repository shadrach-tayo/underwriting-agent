import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { AiBrain01Icon, Search01Icon } from "@hugeicons/core-free-icons"

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

const features = [
  {
    href: "/playground/rag",
    title: "Policy RAG",
    description:
      "Search the layered policy corpus, or chat with a streaming generate agent that cites retrieved sources.",
    badge: "Live",
    icon: Search01Icon,
  },
  {
    href: "/playground/underwrite",
    title: "Underwrite",
    description:
      "Submit a synthetic SME applicant to the LangGraph underwriting agent (stub until POST /underwrite).",
    badge: "Stub",
    icon: AiBrain01Icon,
  },
] as const

export default function PlaygroundOverviewPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Playground
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pick a path from the sidebar. RAG search and underwriting are split
          so each feature stays focused.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {features.map((feature) => (
          <Card key={feature.href}>
            <CardHeader>
              <div className="mb-2 flex items-center gap-2">
                <HugeiconsIcon icon={feature.icon} strokeWidth={2} className="size-5" />
                <Badge variant="secondary">{feature.badge}</Badge>
              </div>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
            <CardContent />
            <CardFooter>
              <Button render={<Link href={feature.href} />}>Open</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
