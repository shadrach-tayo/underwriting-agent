"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const links = [
  { href: "/admin", label: "Admin" },
  { href: "/playground", label: "Playground" },
] as const

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="border-b border-border/80 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
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
      </div>
    </header>
  )
}
