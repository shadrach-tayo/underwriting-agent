"use client"

import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import { Moon01Icon, Sun01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      title="Toggle theme"
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      )}
      onClick={() => {
        const currentlyDark =
          resolvedTheme === "dark" ||
          document.documentElement.classList.contains("dark")
        setTheme(currentlyDark ? "light" : "dark")
      }}
    >
      <HugeiconsIcon
        icon={Sun01Icon}
        strokeWidth={2}
        className="hidden size-4 dark:block"
      />
      <HugeiconsIcon
        icon={Moon01Icon}
        strokeWidth={2}
        className="size-4 dark:hidden"
      />
    </button>
  )
}
