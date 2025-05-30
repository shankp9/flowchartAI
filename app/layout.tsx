import type React from "react"
import type { Metadata, Viewport } from "next" // Import Viewport
import { Inter } from "next/font/google"
import "./globals.css"
import { Analytics } from "@vercel/analytics/react"
import { SiteHeader } from "@/components/SiteHeader"
import { Suspense } from "react"
import { APP_CONFIG } from "@/lib/constants"
import { Toaster } from "sonner" // For better notifications

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
  applicationName: APP_CONFIG.NAME,
  keywords: [
    "AI",
    "diagrams",
    "flowchart",
    "mermaid",
    "sequence diagram",
    "class diagram",
    "gantt chart",
    "user journey",
  ],
  authors: [{ name: "FlowchartAI Team", url: "https://vercel.com" }], // Replace with actual URL
  creator: "FlowchartAI Team",
  publisher: "Vercel", // Replace with actual publisher
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png", // Add more sizes if available
    apple: "/apple-touch-icon.png", // Add apple touch icon
  },
  manifest: "/site.webmanifest", // Add manifest file
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://flowchart-ai.vercel.app", // Replace with your production URL
    title: APP_CONFIG.NAME,
    description: APP_CONFIG.DESCRIPTION,
    siteName: APP_CONFIG.NAME,
    images: [
      // Add a preview image
      {
        url: "https://flowchart-ai.vercel.app/og-image.png", // Replace with your OG image URL
        width: 1200,
        height: 630,
        alt: `${APP_CONFIG.NAME} - AI-Powered Diagram Generator`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_CONFIG.NAME,
    description: APP_CONFIG.DESCRIPTION,
    // site: "@yourtwitterhandle", // Add your Twitter handle
    // creator: "@creatorhandle", // Add creator's Twitter handle
    images: ["https://flowchart-ai.vercel.app/twitter-image.png"], // Replace with your Twitter image URL
  },
  appleWebApp: {
    // For iOS web app capabilities
    title: APP_CONFIG.NAME,
    statusBarStyle: "default",
    capable: true,
  },
}

export const viewport: Viewport = {
  // Add viewport configuration
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // Allow user to zoom
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={`min-h-screen bg-background font-sans antialiased flex flex-col ${inter.className}`}>
        <Suspense fallback={<div className="h-16 border-b bg-background animate-pulse" />}>
          <SiteHeader />
        </Suspense>
        <main className="flex-1 flex flex-col">{children}</main>
        <Toaster richColors position="top-right" />
        <Analytics />
      </body>
    </html>
  )
}
