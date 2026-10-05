import type { ReactNode } from "react"

export default function PlaygroundLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-background">
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </div>
    </div>
  )
}
