"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"
import mermaid from "mermaid"
import { Copy, Palette, AlertCircle, Code } from "lucide-react"
import type { Theme } from "@/types/type"
import { sanitizeMermaidCode } from "@/lib/utils"

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
  const [showCode, setShowCode] = useState(false)
  const [sanitizedCode, setSanitizedCode] = useState("")

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true)
    const savedTheme = localStorage.getItem("mermaid-theme")
    if (savedTheme && Available_Themes.includes(savedTheme as Theme)) {
      setTheme(savedTheme as Theme)
    }

    // Initialize mermaid with global settings
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "default",
      logLevel: "error", // Reduce console noise
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: "basis",
      },
      journey: {
        useMaxWidth: true,
      },
      sequence: {
        useMaxWidth: true,
        showSequenceNumbers: true,
      },
      gantt: {
        useMaxWidth: true,
      },
    })
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
    } else if (sanitizedCode) {
      copyToClipboard(sanitizedCode)
      setLabel("Copied code!")
      setTimeout(() => setLabel("Copy SVG"), 2000)
    }
  }, [copyToClipboard, sanitizedCode])

  const handleCodeCopy = useCallback(() => {
    if (sanitizedCode) {
      copyToClipboard(sanitizedCode)
      setLabel("Copied code!")
      setTimeout(() => setLabel("Copy SVG"), 2000)
    }
  }, [copyToClipboard, sanitizedCode])

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

        // Sanitize and fix common syntax errors
        const cleanedCode = sanitizeMermaidCode(chartCode)
        setSanitizedCode(cleanedCode)

        // Validate and clean the chart code
        if (!cleanedCode) {
          throw new Error("Empty diagram code")
        }

        // Initialize mermaid with current theme
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: selectedTheme,
          logLevel: "error", // Reduce console noise
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: "basis",
          },
          journey: {
            useMaxWidth: true,
          },
          sequence: {
            useMaxWidth: true,
            showSequenceNumbers: true,
          },
          gantt: {
            useMaxWidth: true,
          },
        })

        // Generate unique ID for this render
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

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

        // Try to fix common syntax errors and retry
        try {
          const fixedCode = fixMermaidSyntax(chartCode)
          if (fixedCode !== chartCode) {
            setSanitizedCode(fixedCode)

            // Initialize mermaid with current theme
            mermaid.initialize({
              startOnLoad: false,
              securityLevel: "loose",
              theme: selectedTheme,
              logLevel: "error",
              flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: "basis",
              },
            })

            // Generate unique ID for this render
            const id = `mermaid-fixed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

            // Try to render with fixed code
            const { svg } = await mermaid.render(id, fixedCode)

            // Create a wrapper div for the SVG
            const wrapper = document.createElement("div")
            wrapper.innerHTML = svg
            wrapper.style.width = "100%"
            wrapper.style.height = "100%"
            wrapper.style.display = "flex"
            wrapper.style.justifyContent = "center"
            wrapper.style.alignItems = "center"

            // Clear previous content
            while (container.firstChild) {
              container.removeChild(container.firstChild)
            }

            container.appendChild(wrapper)

            // Show a warning that we fixed the code
            const warningDiv = document.createElement("div")
            warningDiv.className = "text-amber-500 p-2 text-xs bg-amber-50 rounded-md absolute top-4 left-4"
            warningDiv.innerHTML = "⚠️ Fixed syntax errors in diagram"
            container.appendChild(warningDiv)

            return
          }
        } catch (fixError) {
          // If fixing also fails, show the original error
          console.error("Failed to fix syntax:", fixError)
        }

        // Display error message in container
        const errorDiv = document.createElement("div")
        errorDiv.className = "text-red-500 p-4 text-center max-w-md mx-auto"
        errorDiv.innerHTML = `
          <div class="font-semibold mb-2">Diagram Rendering Error</div>
          <div class="text-sm">${error instanceof Error ? error.message : "Unknown error"}</div>
          <div class="text-xs mt-2 text-gray-500">Please check your diagram syntax</div>
          <button class="mt-4 px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-xs hover:bg-blue-200 transition-colors" id="show-code-btn">
            Show Diagram Code
          </button>
        `
        container.appendChild(errorDiv)

        // Add event listener to the button
        setTimeout(() => {
          const showCodeBtn = document.getElementById("show-code-btn")
          if (showCodeBtn) {
            showCodeBtn.addEventListener("click", () => setShowCode(true))
          }
        }, 0)
      } finally {
        setIsRendering(false)
      }
    },
    [isClient],
  )

  // Function to fix common Mermaid syntax errors
  const fixMermaidSyntax = (code: string): string => {
    if (!code) return ""

    // Trim whitespace
    let fixed = code.trim()

    // Check if it's a flowchart
    if (fixed.startsWith("graph") || fixed.startsWith("flowchart")) {
      const lines = fixed.split("\n")
      const fixedLines = []
      let lastNodeId = ""

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        // Skip empty lines
        if (!line) continue

        // First line is the graph declaration
        if (i === 0) {
          fixedLines.push(line)
          continue
        }

        // Check if this line defines a node without connections
        const nodeDefRegex = /^([A-Za-z0-9_-]+)(\[.+\]|$$.+$$|{.+}|>(.+)<|{{.+}}|\[$$.+$$\]|\[\/(.+)\/\])$/
        const nodeMatch = line.match(nodeDefRegex)

        if (nodeMatch) {
          const nodeId = nodeMatch[1]

          // If we have a previous node, connect them
          if (lastNodeId && !line.includes("-->") && !line.includes("---")) {
            fixedLines.push(`${lastNodeId} --> ${nodeId}${nodeMatch[2]}`)
          } else {
            fixedLines.push(line)
          }

          lastNodeId = nodeId
        } else if (line.includes("[") && !line.includes("-->") && !line.includes("---")) {
          // This might be a node definition with spaces
          const parts = line.split(/\s+/)
          if (parts.length >= 2) {
            const potentialNodeId = parts[0]
            // If we have a previous node, try to connect them
            if (lastNodeId) {
              fixedLines.push(`${lastNodeId} --> ${line}`)
            } else {
              fixedLines.push(line)
            }
            lastNodeId = potentialNodeId
          } else {
            fixedLines.push(line)
          }
        } else {
          fixedLines.push(line)

          // Try to extract node IDs from connections
          const connectionMatch = line.match(/([A-Za-z0-9_-]+)\s*-->.+/)
          if (connectionMatch) {
            lastNodeId = connectionMatch[1]
          }
        }
      }

      fixed = fixedLines.join("\n")
    }

    return fixed
  }

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
          disabled={isRendering}
          title="Copy SVG code"
        >
          <Copy className="h-3 w-3" />
          {label}
        </button>
        <button
          className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
          onClick={() => setShowCode(!showCode)}
          title={showCode ? "Hide code" : "Show code"}
        >
          <Code className="h-3 w-3" />
          {showCode ? "Hide Code" : "Show Code"}
        </button>
      </div>

      {/* Code View */}
      {showCode && (
        <div className="absolute inset-0 bg-gray-900 text-gray-100 p-4 z-20 overflow-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium">Mermaid Diagram Code</h3>
            <div className="flex gap-2">
              <button
                className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-700 rounded bg-gray-800 hover:bg-gray-700 transition-colors"
                onClick={handleCodeCopy}
              >
                <Copy className="h-3 w-3" />
                Copy Code
              </button>
              <button
                className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-700 rounded bg-gray-800 hover:bg-gray-700 transition-colors"
                onClick={() => setShowCode(false)}
              >
                Close
              </button>
            </div>
          </div>
          <pre className="text-xs font-mono bg-gray-800 p-4 rounded-md overflow-auto">{sanitizedCode || chart}</pre>
        </div>
      )}

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

      {/* Error Display */}
      {error && !showCode && (
        <div className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Diagram Rendering Error</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}
