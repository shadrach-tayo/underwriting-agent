"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const links = [
  { href: "/admin", label: "Admin" },
  { href: "/playground", label: "Playground" },
] as const

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-sm">
      <div className="flex h-14 w-full items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="font-heading truncate text-sm font-semibold tracking-tight"
          >
            Underwriting Console
          </Link>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            local
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1">
            {links.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
          <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
