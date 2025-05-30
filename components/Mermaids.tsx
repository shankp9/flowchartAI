"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import mermaid from "mermaid"
import { Copy, Palette } from "lucide-react"
import type { Theme } from "@/types/type"

interface MermaidProps {
  chart: string
}

const Available_Themes: Theme[] = ["default", "neutral", "dark", "forest", "base"]

export function Mermaid({ chart }: MermaidProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState<string>("Copy SVG")
  const [theme, setTheme] = useState<Theme>("default")
  const [isClient, setIsClient] = useState(false)
  const [isRendering, setIsRendering] = useState(false)

  // Ensure this only runs on client side
  useEffect(() => {
    setIsClient(true)
    const savedTheme = localStorage.getItem("mermaid-theme")
    if (savedTheme && Available_Themes.includes(savedTheme as Theme)) {
      setTheme(savedTheme as Theme)
    } else {
      localStorage.setItem("mermaid-theme", "default")
    }
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback for older browsers
      const el = document.createElement("textarea")
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
    })
  }

  const handleCopyClick = () => {
    const container = ref.current
    if (!container) return

    const svgElement = container.querySelector("svg")
    if (svgElement) {
      const svgCode = svgElement.outerHTML
      copyToClipboard(svgCode)
      setLabel("Copied!")

      setTimeout(() => {
        setLabel("Copy SVG")
      }, 1000)
    }
  }

  const renderChart = async (chartCode: string, selectedTheme: Theme) => {
    const container = ref.current
    if (!chartCode || !container || !isClient) return

    try {
      setIsRendering(true)

      // Clear previous content
      container.innerHTML = ""
      container.removeAttribute("data-processed")

      // Initialize mermaid with current theme
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: selectedTheme,
        logLevel: 1,
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
        },
      })

      // Generate unique ID for this render
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Render the chart
      const { svg } = await mermaid.render(id, chartCode)
      container.innerHTML = svg
    } catch (error) {
      console.error("Mermaid rendering error:", error)
      container.innerHTML = `<div class="text-red-500 p-4">Error rendering diagram: ${error instanceof Error ? error.message : "Unknown error"}</div>`
    } finally {
      setIsRendering(false)
    }
  }

  // Render chart when chart or theme changes
  useEffect(() => {
    if (isClient && chart) {
      renderChart(chart, theme)
    }
  }, [chart, theme, isClient])

  const handleThemeChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as Theme
    setTheme(value)
    if (isClient) {
      localStorage.setItem("mermaid-theme", value)
      if (chart) {
        await renderChart(chart, value)
      }
    }
  }

  // Don't render anything on server side
  if (!isClient) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="text-gray-500">Loading diagram...</div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="absolute right-0 px-4 py-2 text-xs font-sans flex items-center justify-center gap-2">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          <select
            value={theme}
            onChange={handleThemeChange}
            className="h-8 px-2 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Available_Themes.map((themeOption) => (
              <option key={themeOption} value={themeOption}>
                {themeOption}
              </option>
            ))}
          </select>
        </div>
        <button
          className="flex items-center gap-2 px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50"
          onClick={handleCopyClick}
          disabled={isRendering}
        >
          <Copy className="h-4 w-4" />
          {label}
        </button>
      </div>
      <div ref={ref} className="mermaid flex items-center justify-center mt-12 min-h-[200px]">
        {isRendering && <div className="text-gray-500">Rendering diagram...</div>}
      </div>
    </div>
  )
}
