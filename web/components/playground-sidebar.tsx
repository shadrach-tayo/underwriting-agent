"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiBrain01Icon,
  Home01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"

const navItems = [
  {
    href: "/playground",
    label: "Overview",
    description: "Feature map",
    icon: Home01Icon,
    exact: true,
  },
  {
    href: "/playground/rag",
    label: "Policy RAG",
    description: "Search & agent answer",
    icon: Search01Icon,
    exact: false,
  },
  {
    href: "/playground/underwrite",
    label: "Underwrite",
    description: "Applicant → agent",
    icon: AiBrain01Icon,
    exact: false,
  },
] as const

export function PlaygroundSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar
      collapsible="icon"
      className="top-14! bottom-0! h-[calc(100svh-3.5rem)]! border-e border-sidebar-border"
    >
      <SidebarHeader className="gap-3 px-3 py-4 group-data-[collapsible=icon]:p-2">
        <div className="flex flex-col gap-1 group-data-[collapsible=icon]:hidden">
          <span className="font-heading text-sm font-semibold tracking-tight">
            Playground
          </span>
          <span className="text-xs leading-relaxed text-sidebar-foreground/65">
            Separate paths for RAG and agents
          </span>
        </div>
        <SidebarSeparator className="mx-0 group-data-[collapsible=icon]:hidden" />
      </SidebarHeader>
      <SidebarContent className="px-2 group-data-[collapsible=icon]:px-1.5">
        <SidebarGroup className="px-0">
          <SidebarGroupLabel className="px-2 text-[11px] uppercase tracking-wide text-sidebar-foreground/55">
            Features
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      size="lg"
                      className="h-auto min-h-10 items-start py-2.5 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:min-h-0 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2!"
                      render={<Link href={item.href} />}
                    >
                      <HugeiconsIcon
                        icon={item.icon}
                        strokeWidth={2}
                        className="mt-0.5 group-data-[collapsible=icon]:mt-0"
                      />
                      <span className="flex min-w-0 flex-col gap-0.5 leading-tight group-data-[collapsible=icon]:hidden">
                        <span className="truncate font-medium">{item.label}</span>
                        <span className="truncate text-xs font-normal text-sidebar-foreground/55">
                          {item.description}
                        </span>
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-3 py-3 group-data-[collapsible=icon]:hidden">
        <p className="text-[11px] leading-relaxed text-sidebar-foreground/50">
          Collapse with ⌘B · Theme with D
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
