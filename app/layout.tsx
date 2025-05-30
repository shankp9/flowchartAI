import type React from "react"
import "./globals.css"

import { Analytics } from "@vercel/analytics/react"
import { Suspense } from "react"

import { Mona_Sans as FontSans } from "next/font/google"
import { cn } from "@/lib/utils"
import { SiteHeader } from "@/components/SiteHeader"

export const metadata = {
  title: "FlowchartAI",
  description:
    "Draw flowchart, sequence diagram, class diagram, user journey, gantt, C4C diagram with nature language.",
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
    <html lang="en">
      <body
        className={cn("min-h-screen bg-white font-sans text-slate-900 antialiased flex flex-col", fontSans.variable)}
      >
        <Suspense fallback={<div>Loading...</div>}>
          <SiteHeader />
          {children}
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
