"use client"

import { useState, useEffect } from "react"
import type { ScreenSize } from "@/types"
import { SCREEN_BREAKPOINTS } from "@/lib/constants"

export function useScreenSize(): ScreenSize {
  const [screenSize, setScreenSize] = useState<ScreenSize>("desktop")

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width < SCREEN_BREAKPOINTS.MOBILE) {
        setScreenSize("mobile")
      } else if (width < SCREEN_BREAKPOINTS.TABLET) {
        setScreenSize("tablet")
      } else {
        setScreenSize("desktop")
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return screenSize
}
