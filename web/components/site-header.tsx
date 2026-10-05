"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { AskAiButton } from "@/components/ask-ai-button"
import { DemoTourLauncher } from "@/components/playground/demo-tour"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { DEMO_FILE } from "@/lib/demo-tour"
import { isAdminUiEnabled } from "@/lib/flags"
import { cn } from "@/lib/utils"
import { useCaseSessionStore } from "@/stores/case-session-store"
import { useDemoTourStore } from "@/stores/demo-tour-store"

export function SiteHeader() {
  const pathname = usePathname()
  const persona = useCaseSessionStore((s) => s.persona)
  const caseId = useCaseSessionStore((s) => s.caseId)
  const openLenderDesk = useCaseSessionStore((s) => s.openLenderDesk)
  const demoActive = useDemoTourStore((s) => s.active)
  const intro = useDemoTourStore((s) => s.intro)
  const showAdmin = isAdminUiEnabled()
  const underwriteActive = pathname.startsWith("/playground/underwrite")

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-sm">
      <div className="flex h-14 w-full items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={demoActive ? "#" : "/"}
            className="font-heading truncate text-sm font-semibold tracking-tight"
            onClick={(event) => {
              if (demoActive) event.preventDefault()
            }}
          >
            Underwriting Agent
          </Link>
          {demoActive && !intro ? (
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {persona === "applicant" ? "Applicant" : "Officer"} · {DEMO_FILE.name}
            </Badge>
          ) : (
            <Badge variant="secondary" className="hidden sm:inline-flex">
              Demo
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {demoActive ? null : (
            <nav className="flex items-center gap-1">
              <AskAiButton className="text-muted-foreground hover:text-foreground" />
              <Link
                href="/playground/underwrite"
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  underwriteActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
                onClick={() => {
                  const fromApplicant =
                    pathname.startsWith("/apply") ||
                    pathname.startsWith("/portal")
                  openLenderDesk(fromApplicant && caseId ? "file" : "catalog")
                }}
              >
                Underwrite
              </Link>
              {showAdmin ? (
                <Link
                  href="/admin"
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    pathname.startsWith("/admin")
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  Admin
                </Link>
              ) : null}
            </nav>
          )}
          {demoActive ? null : (
            <DemoTourLauncher className="hidden sm:inline-flex" />
          )}
          <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
