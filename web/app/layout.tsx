import type { Metadata } from "next"
import { Geist, Geist_Mono, Nunito_Sans } from "next/font/google"

import { AskAiSheet } from "@/components/ask-ai-sheet"
import { DemoTourHost } from "@/components/demo-tour-host"
import { SiteHeader } from "@/components/site-header"
import { QueryProvider } from "@/components/query-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { DirectionProvider } from "@/components/ui/direction"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import "./globals.css"

const geistHeading = Geist({ subsets: ["latin"], variable: "--font-heading" })
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Underwriting Agent",
  description:
    "Demo of agentic underwriting for any kind of lending. Auto-decide inside the envelope, escalate the rest with a cited trace, and keep a hard-coded risk ceiling.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        nunitoSans.variable,
        geistHeading.variable
      )}
    >
      <body className="min-h-svh bg-background text-foreground">
        <DirectionProvider direction="ltr">
          <ThemeProvider>
            <QueryProvider>
              <TooltipProvider>
                <div className="flex min-h-svh flex-col">
                  <SiteHeader />
                  <main className="flex-1">{children}</main>
                  <AskAiSheet />
                  <DemoTourHost />
                </div>
              </TooltipProvider>
            </QueryProvider>
          </ThemeProvider>
        </DirectionProvider>
      </body>
    </html>
  )
}
