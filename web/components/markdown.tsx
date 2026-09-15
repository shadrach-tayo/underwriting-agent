"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

const markdownComponents: React.ComponentProps<typeof ReactMarkdown>["components"] =
  {
    h1: ({ className, ...props }) => (
      <h1
        className={cn(
          "mt-4 mb-2 font-heading text-lg font-semibold tracking-tight first:mt-0",
          className
        )}
        {...props}
      />
    ),
    h2: ({ className, ...props }) => (
      <h2
        className={cn(
          "mt-4 mb-2 font-heading text-base font-semibold tracking-tight first:mt-0",
          className
        )}
        {...props}
      />
    ),
    h3: ({ className, ...props }) => (
      <h3
        className={cn(
          "mt-3 mb-1.5 font-heading text-sm font-semibold tracking-tight first:mt-0",
          className
        )}
        {...props}
      />
    ),
    p: ({ className, ...props }) => (
      <p
        className={cn("my-2 leading-relaxed text-foreground/90 last:mb-0", className)}
        {...props}
      />
    ),
    ul: ({ className, ...props }) => (
      <ul
        className={cn("my-2 list-disc space-y-1 ps-5 marker:text-muted-foreground", className)}
        {...props}
      />
    ),
    ol: ({ className, ...props }) => (
      <ol
        className={cn(
          "my-2 list-decimal space-y-1 ps-5 marker:text-muted-foreground",
          className
        )}
        {...props}
      />
    ),
    li: ({ className, ...props }) => (
      <li className={cn("leading-relaxed", className)} {...props} />
    ),
    strong: ({ className, ...props }) => (
      <strong className={cn("font-semibold text-foreground", className)} {...props} />
    ),
    a: ({ className, ...props }) => (
      <a
        className={cn(
          "font-medium text-primary underline underline-offset-3 hover:text-primary/80",
          className
        )}
        {...props}
      />
    ),
    code: ({ className, children, ...props }) => {
      const isBlock = Boolean(className?.includes("language-"))
      if (isBlock) {
        return (
          <code
            className={cn("font-mono text-[0.8rem]", className)}
            {...props}
          >
            {children}
          </code>
        )
      }
      return (
        <code
          className={cn(
            "rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.8rem] text-foreground",
            className
          )}
          {...props}
        >
          {children}
        </code>
      )
    },
    pre: ({ className, ...props }) => (
      <pre
        className={cn(
          "my-3 overflow-x-auto rounded-lg bg-muted/80 p-3 font-mono text-[0.8rem] leading-relaxed",
          className
        )}
        {...props}
      />
    ),
    blockquote: ({ className, ...props }) => (
      <blockquote
        className={cn(
          "my-3 border-s-2 border-border ps-3 text-muted-foreground italic",
          className
        )}
        {...props}
      />
    ),
    hr: ({ className, ...props }) => (
      <hr className={cn("my-4 border-border", className)} {...props} />
    ),
    table: ({ className, ...props }) => (
      <div className="my-3 overflow-x-auto">
        <table
          className={cn("w-full border-collapse text-sm", className)}
          {...props}
        />
      </div>
    ),
    th: ({ className, ...props }) => (
      <th
        className={cn(
          "border border-border bg-muted/50 px-2 py-1.5 text-start font-medium",
          className
        )}
        {...props}
      />
    ),
    td: ({ className, ...props }) => (
      <td
        className={cn("border border-border px-2 py-1.5 align-top", className)}
        {...props}
      />
    ),
  }

export function Markdown({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <div className={cn("text-sm text-foreground", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
