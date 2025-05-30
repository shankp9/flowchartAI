import { siteConfig } from "@/config/site"
import { MainNav } from "@/components/MainNav"
import { Button } from "@/components/ui/button"
import { Github } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <MainNav items={siteConfig.mainNav} />

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <a href={siteConfig.links.github} target="_blank" rel="noreferrer" className="flex items-center gap-2">
              <Github className="h-4 w-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </Button>
        </div>
      </div>
    </header>
  )
}
