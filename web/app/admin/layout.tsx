import { notFound } from "next/navigation"
import type { ReactNode } from "react"

import { isAdminUiEnabled } from "@/lib/flags"

export default function AdminLayout({ children }: { children: ReactNode }) {
  if (!isAdminUiEnabled()) notFound()
  return children
}
