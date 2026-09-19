import { Suspense } from "react"

import { PolicyRagPlayground } from "@/components/playground/policy-rag-playground"

export default function PlaygroundRagPage() {
  return (
    <Suspense>
      <PolicyRagPlayground />
    </Suspense>
  )
}
