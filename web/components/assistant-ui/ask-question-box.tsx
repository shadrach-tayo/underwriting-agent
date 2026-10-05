import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Shared chrome for the Ask AI composer — chat uses ComposerPrimitive.Root with the same classes. */
export const askQuestionBoxClassName =
  "flex w-full min-h-[6.75rem] flex-col rounded-[22px] border border-border/80 bg-muted/15 p-2.5 shadow-none focus-within:border-foreground/20"

export function AskQuestionBox({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn(askQuestionBoxClassName, className)}>{children}</div>
}

export function AskQuestionToolbar({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("mt-auto flex items-center gap-2 pt-1", className)}>
      {children}
    </div>
  )
}
