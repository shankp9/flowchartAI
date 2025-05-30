import type React from "react"
import "./globals.css"

import { Analytics } from "@vercel/analytics/react"
import { Suspense } from "react"

import { Mona_Sans as FontSans } from "next/font/google"
import { cn } from "@/lib/utils"
import { SiteHeader } from "@/components/SiteHeader"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata = {
  title: "FlowchartAI - AI-Powered Diagram Generator",
  description:
    "Create professional flowcharts, sequence diagrams, class diagrams, user journeys, gantt charts, and C4C diagrams using natural language with AI.",
  keywords: ["flowchart", "diagram", "AI", "mermaid", "sequence diagram", "class diagram"],
  authors: [{ name: "FlowchartAI Team" }],
  openGraph: {
    title: "FlowchartAI - AI-Powered Diagram Generator",
    description: "Create professional diagrams using natural language with AI",
    type: "website",
  },
    generator: 'v0.dev'
}

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased flex flex-col", fontSans.variable)}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            }
          >
            <SiteHeader />
            {children}
          </Suspense>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
