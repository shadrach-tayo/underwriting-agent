import type { ReactNode } from "react"

import { PlaygroundSidebar } from "@/components/playground-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function PlaygroundLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <SidebarProvider className="min-h-[calc(100svh-3.5rem)]! bg-background">
      <PlaygroundSidebar />
      <SidebarInset className="m-0 rounded-none bg-background shadow-none">
        <header className="sticky top-14 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border/80 bg-background/90 px-4 backdrop-blur-sm">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="me-1 h-4" />
          <span className="text-sm text-muted-foreground">Playground</span>
        </header>
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
