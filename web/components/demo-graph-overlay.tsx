"use client"

import * as React from "react"

import { DEMO_GRAPH_NODES } from "@/lib/demo-tour"
import { cn } from "@/lib/utils"

export function DemoGraphOverlay({
  active,
  done,
}: {
  active: boolean
  done: boolean
}) {
  const [tick, setTick] = React.useState(0)

  React.useEffect(() => {
    if (!active) {
      setTick(0)
      return
    }
    if (done) {
      setTick(DEMO_GRAPH_NODES.length)
      return
    }
    setTick(0)
    const id = window.setInterval(() => {
      setTick((n) => Math.min(n + 1, DEMO_GRAPH_NODES.length - 1))
    }, 700)
    return () => window.clearInterval(id)
  }, [active, done])

  if (!active) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border bg-popover p-5 shadow-xl">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Graph
        </p>
        <h3 className="font-heading mt-1 text-lg font-semibold tracking-tight">
          Reviewing Cedar Ridge
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Checking the application. The result is a recommendation.
        </p>
        <ol className="mt-4 space-y-2">
          {DEMO_GRAPH_NODES.map((node, index) => {
            const state = done
              ? "done"
              : index < tick
                ? "done"
                : index === tick
                  ? "writing"
                  : "wait"
            return (
              <li
                key={node.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span
                  className={cn(
                    state === "wait" && "text-muted-foreground"
                  )}
                >
                  {node.label}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-semibold tracking-[0.12em] uppercase",
                    state === "done" && "text-foreground",
                    state === "writing" && "text-muted-foreground",
                    state === "wait" && "text-muted-foreground/60"
                  )}
                >
                  {state === "done"
                    ? "Done"
                    : state === "writing"
                      ? "Writing"
                      : "Queued"}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
