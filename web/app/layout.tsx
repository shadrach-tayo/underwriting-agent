import type { Metadata } from "next"
import { Geist, Geist_Mono, Nunito_Sans } from "next/font/google"

import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { DirectionProvider } from "@/components/ui/direction"
import { cn } from "@/lib/utils"

import "./globals.css"

const geistHeading = Geist({ subsets: ["latin"], variable: "--font-heading" })
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Underwriting Console",
  description:
    "Admin inspection for policy RAG and a playground for underwriting agents.",
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
            <div className="flex min-h-svh flex-col">
              <SiteHeader />
              <main className="flex-1">{children}</main>
            </div>
          </ThemeProvider>
        </DirectionProvider>
      </body>
    </html>
  )
}
