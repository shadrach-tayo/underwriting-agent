"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export function SourceLink({
  href,
  children,
  className,
}: {
  href: string | null | undefined
  children: React.ReactNode
  className?: string
}) {
  if (!href) {
    return (
      <span className={cn("text-muted-foreground", className)}>{children}</span>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "relative z-10 text-primary underline underline-offset-2 hover:text-primary/80",
        className
      )}
    >
      {children}
    </a>
  )
}
