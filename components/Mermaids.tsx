"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"
import mermaid from "mermaid"
import { Copy, Palette } from "lucide-react"
import type { Theme } from "@/types/type"

interface MermaidProps {
  chart: string
}

const Available_Themes: Theme[] = ["default", "neutral", "dark", "forest", "base"]

export function Mermaid({ chart }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState<string>("Copy SVG")
  const [theme, setTheme] = useState<Theme>("default")
  const [isClient, setIsClient] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [error, setError] = useState<string>("")

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true)
    const savedTheme = localStorage.getItem("mermaid-theme")
    if (savedTheme && Available_Themes.includes(savedTheme as Theme)) {
      setTheme(savedTheme as Theme)
    }
  }, [])

  const copyToClipboard = useCallback((text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {
        // Fallback for older browsers
        const el = document.createElement("textarea")
        el.value = text
        el.style.position = "absolute"
        el.style.left = "-9999px"
        document.body.appendChild(el)
        el.select()
        document.execCommand("copy")
        document.body.removeChild(el)
      })
    }
  }, [])

  const handleCopyClick = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const svgElement = container.querySelector("svg")
    if (svgElement) {
      const svgCode = svgElement.outerHTML
      copyToClipboard(svgCode)
      setLabel("Copied!")
      setTimeout(() => setLabel("Copy SVG"), 2000)
    }
  }, [copyToClipboard])

  const renderChart = useCallback(
    async (chartCode: string, selectedTheme: Theme) => {
      const container = containerRef.current
      if (!chartCode || !container || !isClient) return

      try {
        setIsRendering(true)
        setError("")

        // Clear previous content safely
        while (container.firstChild) {
          container.removeChild(container.firstChild)
        }

        // Remove any existing data attributes
        container.removeAttribute("data-processed")

        // Initialize mermaid with current theme
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: selectedTheme,
          logLevel: "error", // Reduce console noise
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
          },
          journey: {
            useMaxWidth: true,
          },
          sequence: {
            useMaxWidth: true,
          },
          gantt: {
            useMaxWidth: true,
          },
          class: {
            useMaxWidth: true,
          },
          state: {
            useMaxWidth: true,
          },
          er: {
            useMaxWidth: true,
          },
          pie: {
            useMaxWidth: true,
          },
        })

        // Generate unique ID for this render
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        // Validate and clean the chart code
        const cleanedCode = chartCode.trim()
        if (!cleanedCode) {
          throw new Error("Empty diagram code")
        }

        // Render the chart
        const { svg } = await mermaid.render(id, cleanedCode)

        // Create a wrapper div for the SVG
        const wrapper = document.createElement("div")
        wrapper.innerHTML = svg
        wrapper.style.width = "100%"
        wrapper.style.height = "100%"
        wrapper.style.display = "flex"
        wrapper.style.justifyContent = "center"
        wrapper.style.alignItems = "center"

        container.appendChild(wrapper)
      } catch (error) {
        console.error("Mermaid rendering error:", error)
        setError(error instanceof Error ? error.message : "Unknown rendering error")

        // Display error message in container
        const errorDiv = document.createElement("div")
        errorDiv.className = "text-red-500 p-4 text-center"
        errorDiv.innerHTML = `
        <div class="font-semibold mb-2">Diagram Rendering Error</div>
        <div class="text-sm">${error instanceof Error ? error.message : "Unknown error"}</div>
        <div class="text-xs mt-2 text-gray-500">Please check your diagram syntax</div>
      `
        container.appendChild(errorDiv)
      } finally {
        setIsRendering(false)
      }
    },
    [isClient],
  )

  // Render chart when chart or theme changes
  useEffect(() => {
    if (isClient && chart) {
      renderChart(chart, theme)
    }
  }, [chart, theme, isClient, renderChart])

  const handleThemeChange = useCallback(
    async (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as Theme
      setTheme(value)
      if (isClient) {
        localStorage.setItem("mermaid-theme", value)
        if (chart) {
          await renderChart(chart, value)
        }
      }
    },
    [isClient, chart, renderChart],
  )

  // Don't render anything on server side
  if (!isClient) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="text-gray-500">Loading diagram...</div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white rounded-lg shadow-sm border p-2">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-gray-600" />
          <select
            value={theme}
            onChange={handleThemeChange}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isRendering}
          >
            {Available_Themes.map((themeOption) => (
              <option key={themeOption} value={themeOption}>
                {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <button
          className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
          onClick={handleCopyClick}
          disabled={isRendering || !!error}
        >
          <Copy className="h-3 w-3" />
          {label}
        </button>
      </div>

      {/* Diagram Container */}
      <div
        ref={containerRef}
        className="w-full h-full min-h-[300px] flex items-center justify-center p-4"
        style={{ minHeight: "300px" }}
      >
        {isRendering && (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-sm">Rendering diagram...</span>
          </div>
        )}
      </div>
    </div>
  )
}
