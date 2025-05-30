import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Analytics } from "@vercel/analytics/react"
import { SiteHeader } from "@/components/SiteHeader"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Suspense } from "react"
import { APP_CONFIG } from "@/lib/constants"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: {
    default: APP_CONFIG.NAME,
    template: `%s | ${APP_CONFIG.NAME}`,
  },
  description: APP_CONFIG.DESCRIPTION,
  keywords: ["AI", "diagrams", "flowchart", "mermaid", "sequence diagram", "class diagram"],
  authors: [{ name: "FlowchartAI Team" }],
  creator: "FlowchartAI",
  publisher: "FlowchartAI",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://flowchart-ai.vercel.app",
    title: APP_CONFIG.NAME,
    description: APP_CONFIG.DESCRIPTION,
    siteName: APP_CONFIG.NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: APP_CONFIG.NAME,
    description: APP_CONFIG.DESCRIPTION,
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`min-h-screen bg-white font-sans antialiased flex flex-col ${inter.className}`}>
        <ErrorBoundary>
          <Suspense fallback={<div className="h-16 bg-white border-b border-gray-200 animate-pulse" />}>
            <SiteHeader />
          </Suspense>
          <main className="flex-1">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
          <Analytics />
        </ErrorBoundary>
      </body>
    </html>
  )
}
