import type React from "react"
import "./globals.css"
import { Analytics } from "@vercel/analytics/react"
import { Mona_Sans as FontSans } from "next/font/google"
import { cn } from "@/lib/utils"
import { SiteHeader } from "@/components/SiteHeader"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { Suspense } from "react"

export const metadata = {
  title: "FlowchartAI - Create diagrams with natural language",
  description:
    "Draw flowcharts, sequence diagrams, class diagrams, user journeys, gantt charts, and C4C diagrams with natural language.",
  icons: {
    icon: "/favicon.ico",
  },
    generator: 'v0.dev'
}

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", fontSans.variable)}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Suspense fallback={null}>
            <div className="relative flex min-h-screen flex-col">
              <SiteHeader />
              <div className="flex-1">{children}</div>
            </div>
            <Toaster />
            <Analytics />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  )
}
