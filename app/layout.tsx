import type React from "react"
import "./globals.css"
import { Analytics } from "@vercel/analytics/react"
import { Suspense } from "react"

export const metadata = {
  title: "FlowchartAI - AI-Powered Diagram Generator",
  description: "Create professional diagrams using natural language with AI",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white font-sans antialiased flex flex-col">
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}
