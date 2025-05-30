"use client"

import { Sparkles } from "lucide-react"
import Link from "next/link"
import { APP_CONFIG } from "@/lib/constants" // Import APP_CONFIG

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="font-bold sm:inline-block">{APP_CONFIG.NAME}</span>
        </Link>
        {/* Add navigation items here if needed in the future */}
        {/* <nav className="flex items-center space-x-6 text-sm font-medium">
          <Link
            href="/docs"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs
          </Link>
        </nav> */}
      </div>
    </header>
  )
}
