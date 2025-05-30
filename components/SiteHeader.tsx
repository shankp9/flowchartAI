import { siteConfig } from "@/config/site"
import { MainNav } from "@/components/MainNav"

export function SiteHeader() {
  return (
    <header className="top-0 z-40 w-full bg-white">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <MainNav items={siteConfig.mainNav} />
      </div>
    </header>
  )
}
