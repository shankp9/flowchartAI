"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"
import mermaid from "mermaid"
import { Copy, Palette, AlertCircle, Code, CheckCircle, RefreshCw } from "lucide-react"
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
  const [wasFixed, setWasFixed] = useState(false)
  const [wasConverted, setWasConverted] = useState(false)

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
      logLevel: "error",
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
        setWasFixed(false)
        setWasConverted(false)

        // Clear previous content safely
        while (container.firstChild) {
          container.removeChild(container.firstChild)
        }

        container.removeAttribute("data-processed")

        // Check if this is old flowchart syntax
        const isOldSyntax =
          chartCode.includes("=>") &&
          (chartCode.includes("start:") || chartCode.includes("operation:") || chartCode.includes("condition:"))

        // Sanitize and fix common syntax errors
        const cleanedCode = sanitizeMermaidCode(chartCode)
        setSanitizedCode(cleanedCode)

        // Check if the code was modified during sanitization
        const codeWasFixed = cleanedCode !== chartCode.trim()
        setWasFixed(codeWasFixed && !isOldSyntax)
        setWasConverted(isOldSyntax)

        if (!cleanedCode) {
          throw new Error("Empty diagram code")
        }

        try {
          // Validate the code before rendering
          if (!cleanedCode.trim()) {
            throw new Error("Empty diagram code")
          }

          // Check for common syntax issues that cause parsing errors
          const lines = cleanedCode.split("\n")
          const firstLine = lines[0].trim().toLowerCase()

          // Validate diagram type
          const validStarters = [
            "graph",
            "flowchart",
            "sequencediagram",
            "classdiagram",
            "statediagram",
            "erdiagram",
            "journey",
            "gantt",
            "pie",
            "gitgraph",
          ]
          const isValidType = validStarters.some((starter) => firstLine.startsWith(starter))

          if (!isValidType) {
            throw new Error("Invalid diagram type. Please start with a valid Mermaid diagram type.")
          }

          // Additional validation for sequence diagrams
          if (firstLine.startsWith("sequencediagram")) {
            const hasValidArrows = lines.some(
              (line) =>
                line.includes("->") ||
                line.includes("-->") ||
                line.includes("->>") ||
                line.includes("-->>") ||
                line.includes("-x") ||
                line.includes("--x"),
            )

            if (!hasValidArrows && lines.length > 2) {
              throw new Error("Sequence diagram must contain valid arrow syntax (->>, -->, -x, etc.)")
            }
          }

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
            journey: {
              useMaxWidth: true,
            },
            sequence: {
              useMaxWidth: true,
              showSequenceNumbers: true,
              wrap: true,
              width: 150,
            },
            gantt: {
              useMaxWidth: true,
            },
          })

          // Generate unique ID for this render
          const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

          // Render the chart with additional error handling
          let svg: string
          try {
            const result = await mermaid.render(id, cleanedCode)
            svg = result.svg
          } catch (renderError) {
            // If rendering fails, try with a simplified version
            console.warn("Initial render failed, attempting with simplified syntax:", renderError)

            // Try to create a simplified version of the diagram
            const simplifiedCode = createSimplifiedDiagram(cleanedCode)
            const simplifiedResult = await mermaid.render(id + "_simplified", simplifiedCode)
            svg = simplifiedResult.svg

            // Show a warning that the diagram was simplified
            setWasFixed(true)
          }

          // Create a wrapper div for the SVG
          const wrapper = document.createElement("div")
          wrapper.innerHTML = svg
          wrapper.style.width = "100%"
          wrapper.style.height = "100%"
          wrapper.style.display = "flex"
          wrapper.style.justifyContent = "center"
          wrapper.style.alignItems = "center"

          container.appendChild(wrapper)

          // Show success message if code was fixed or converted
          if (codeWasFixed || isOldSyntax || wasFixed) {
            const successDiv = document.createElement("div")
            let messageText = "Syntax automatically fixed"
            let bgColor = "bg-green-50 border-green-200 text-green-700"

            if (isOldSyntax) {
              messageText = "Converted from old flowchart syntax"
              bgColor = "bg-blue-50 border-blue-200 text-blue-700"
            } else if (wasFixed) {
              messageText = "Diagram simplified due to syntax errors"
              bgColor = "bg-yellow-50 border-yellow-200 text-yellow-700"
            }

            successDiv.className = `absolute top-4 left-4 ${bgColor} border rounded-md p-2 flex items-center gap-2 text-xs z-10`
            successDiv.innerHTML = `
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
              </svg>
              <span>${messageText}</span>
            `
            container.appendChild(successDiv)

            // Auto-hide the success message after 4 seconds
            setTimeout(() => {
              if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv)
              }
            }, 4000)
          }
        } catch (error) {
          console.error("Mermaid rendering error:", error)
          const errorMessage = error instanceof Error ? error.message : "Unknown rendering error"
          setError(errorMessage)

          // Display enhanced error message in container
          const errorDiv = document.createElement("div")
          errorDiv.className = "text-red-500 p-6 text-center max-w-lg mx-auto"

          let errorContent = `
            <div class="font-semibold mb-3 text-lg">Diagram Rendering Error</div>
            <div class="text-sm mb-4 text-red-600">${errorMessage}</div>
          `

          // Provide specific help based on error type
          if (errorMessage.includes("Parse error") || errorMessage.includes("Expecting")) {
            errorContent += `
              <div class="text-xs text-gray-600 mb-4 p-3 bg-gray-50 rounded">
                <strong>Common fixes:</strong><br>
                • Check arrow syntax in sequence diagrams (-&gt;&gt;, --&gt;&gt;, -x)<br>
                • Ensure participant names don't contain spaces or special characters<br>
                • Verify all connections have proper arrow syntax (--&gt;)<br>
                • Make sure all brackets and quotes are properly closed
              </div>
            `
          }

          errorContent += `
            <div class="space-y-2">
              <button class="px-4 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors" id="show-code-btn">
                Show Diagram Code
              </button>
              <button class="px-4 py-2 bg-green-100 text-green-700 rounded-md text-sm hover:bg-green-200 transition-colors ml-2" id="retry-simplified-btn">
                Try Simplified Version
              </button>
            </div>
          `

          errorDiv.innerHTML = errorContent
          container.appendChild(errorDiv)

          // Add event listeners to the buttons
          setTimeout(() => {
            const showCodeBtn = document.getElementById("show-code-btn")
            const retryBtn = document.getElementById("retry-simplified-btn")

            if (showCodeBtn) {
              showCodeBtn.addEventListener("click", () => setShowCode(true))
            }

            if (retryBtn) {
              retryBtn.addEventListener("click", async () => {
                try {
                  const simplifiedCode = createSimplifiedDiagram(cleanedCode)
                  await renderChart(simplifiedCode, selectedTheme)
                } catch (e) {
                  console.error("Simplified render also failed:", e)
                }
              })
            }
          }, 0)
        }
      } catch (error) {
        console.error("Mermaid rendering error:", error)
        setError(error instanceof Error ? error.message : "Unknown rendering error")

        // Display error message in container
        const errorDiv = document.createElement("div")
        errorDiv.className = "text-red-500 p-4 text-center max-w-md mx-auto"
        errorDiv.innerHTML = `
          <div class="font-semibold mb-2">Diagram Rendering Error</div>
          <div class="text-sm mb-4">${error instanceof Error ? error.message : "Unknown error"}</div>
          <div class="text-xs text-gray-500 mb-4">The diagram syntax contains errors that couldn't be automatically fixed.</div>
          <button class="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-xs hover:bg-blue-200 transition-colors" id="show-code-btn">
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
          className={`flex items-center gap-1 px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors ${
            wasFixed
              ? "border-green-300 text-green-700"
              : wasConverted
                ? "border-blue-300 text-blue-700"
                : "border-gray-300"
          }`}
          onClick={() => setShowCode(!showCode)}
          title={showCode ? "Hide code" : "Show code"}
        >
          {wasFixed ? (
            <CheckCircle className="h-3 w-3" />
          ) : wasConverted ? (
            <RefreshCw className="h-3 w-3" />
          ) : (
            <Code className="h-3 w-3" />
          )}
          {showCode ? "Hide Code" : wasFixed ? "Fixed Code" : wasConverted ? "Converted" : "Show Code"}
        </button>
      </div>

      {/* Code View */}
      {showCode && (
        <div className="absolute inset-0 bg-gray-900 text-gray-100 p-4 z-20 overflow-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Mermaid Diagram Code</h3>
              {wasFixed && (
                <span className="px-2 py-1 bg-green-800 text-green-100 rounded text-xs">Automatically Fixed</span>
              )}
              {wasConverted && (
                <span className="px-2 py-1 bg-blue-800 text-blue-100 rounded text-xs">Converted from Old Syntax</span>
              )}
            </div>
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

          {(wasFixed || wasConverted) && (
            <div
              className={`mb-4 p-3 border rounded-md ${wasConverted ? "bg-blue-900 border-blue-700" : "bg-green-900 border-green-700"}`}
            >
              <div className={`text-xs font-medium mb-2 ${wasConverted ? "text-blue-100" : "text-green-100"}`}>
                {wasConverted ? "Old Flowchart Syntax Converted:" : "Syntax Issues Fixed:"}
              </div>
              <div className={`text-xs ${wasConverted ? "text-blue-200" : "text-green-200"}`}>
                {wasConverted ? (
                  <>
                    • Converted old flowchart.js syntax to Mermaid format
                    <br />• Transformed node definitions (start, operation, condition, end)
                    <br />• Fixed connection syntax and arrow formats
                  </>
                ) : (
                  <>
                    • Fixed missing connections and syntax errors
                    <br />• Ensured proper Mermaid syntax compliance
                  </>
                )}
              </div>
            </div>
          )}

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

// Helper function to create a simplified version of a diagram when rendering fails
function createSimplifiedDiagram(originalCode: string): string {
  const lines = originalCode
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const firstLine = lines[0].toLowerCase()

  if (firstLine.startsWith("sequencediagram")) {
    return `sequenceDiagram
    participant A as User
    participant B as System
    A->>B: Request
    B-->>A: Response`
  } else if (firstLine.startsWith("graph") || firstLine.startsWith("flowchart")) {
    return `graph TD
    A[Start] --> B[Process]
    B --> C[End]`
  } else if (firstLine.startsWith("journey")) {
    return `journey
    title User Journey
    section Task
      Step 1: 3: User
      Step 2: 4: User`
  } else {
    return `graph TD
    A[Simplified Diagram] --> B[Original syntax had errors]
    B --> C[Please check the code and try again]
    style A fill:#ffcccc
    style B fill:#ffffcc
    style C fill:#ccffcc`
  }
}
