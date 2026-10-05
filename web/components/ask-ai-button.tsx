"use client"

import type { ReactNode } from "react"
import type { VariantProps } from "class-variance-authority"
import { SparklesIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAskAiStore } from "@/stores/ask-ai-store"

export function AskAiButton({
  className,
  size = "sm",
  variant = "ghost",
  children = "Ask AI",
}: {
  className?: string
  size?: VariantProps<typeof buttonVariants>["size"]
  variant?: VariantProps<typeof buttonVariants>["variant"]
  children?: ReactNode
}) {
  const openSheet = useAskAiStore((s) => s.openSheet)
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("gap-1.5", className)}
      onClick={openSheet}
    >
      <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} />
      {children}
    </Button>
  )
}
