"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import mermaid from "mermaid"
import {
  Copy,
  AlertCircle,
  Code,
  CheckCircle,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Download,
  Maximize,
  MousePointer2,
  Hand,
  Move,
} from "lucide-react"
import type { Theme } from "@/types/type"
import { sanitizeMermaidCode } from "@/lib/utils"

interface MermaidProps {
  chart: string
  isFullscreen?: boolean
  onFullscreenChange?: (fullscreen: boolean) => void
  isStandalone?: boolean
}

const Available_Themes: Theme[] = ["default", "neutral", "dark", "forest", "base"]

export function Mermaid({ chart, isFullscreen = false, onFullscreenChange, isStandalone = false }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState<string>("Copy SVG")
  const [theme, setTheme] = useState<Theme>("default")
  const [isClient, setIsClient] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [error, setError] = useState<string>("")
  const [showCode, setShowCode] = useState(false)
  const [sanitizedCode, setSanitizedCode] = useState("")
  const [wasFixed, setWasFixed] = useState(false)
  const [wasConverted, setWasConverted] = useState(false)

  // Enhanced zoom and pan state with better control
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showControls, setShowControls] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [autoFit, setAutoFit] = useState(true)

  // Enhanced interaction state
  const [isElementDragging, setIsElementDragging] = useState(false)
  const [selectedElement, setSelectedElement] = useState<Element | null>(null)
  const [interactionMode, setInteractionMode] = useState<"pan" | "select">("pan")

  // Responsive breakpoints
  const [screenSize, setScreenSize] = useState<"mobile" | "tablet" | "desktop">("desktop")

  // Initialize client-side state and responsive handling
  useEffect(() => {
    setIsClient(true)
    const savedTheme = localStorage.getItem("mermaid-theme")
    if (savedTheme && Available_Themes.includes(savedTheme as Theme)) {
      setTheme(savedTheme as Theme)
    }

    // Handle responsive breakpoints
    const handleResize = () => {
      const width = window.innerWidth
      if (width < 768) {
        setScreenSize("mobile")
      } else if (width < 1024) {
        setScreenSize("tablet")
      } else {
        setScreenSize("desktop")
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)

    // Initialize mermaid with responsive settings
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "default",
      logLevel: "error",
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: "basis",
      },
      journey: {
        useMaxWidth: false,
      },
      sequence: {
        useMaxWidth: false,
        showSequenceNumbers: true,
        wrap: true,
        width: screenSize === "mobile" ? 120 : 150,
      },
      gantt: {
        useMaxWidth: false,
      },
    })

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [isFullscreen, isStandalone, screenSize])

  // Enhanced mouse and touch interactions with better zoom control
  useEffect(() => {
    const container = svgContainerRef.current
    if (!container) return

    let lastTouchDistance = 0
    let lastTouchCenter = { x: 0, y: 0 }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      // More controlled zoom with smaller increments
      const zoomSensitivity = screenSize === "mobile" ? 0.05 : 0.1
      const delta = e.deltaY > 0 ? -zoomSensitivity : zoomSensitivity

      // Get mouse position relative to container
      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Calculate new zoom with limits
      const newZoom = Math.max(0.1, Math.min(5, zoom + delta))

      // Calculate new pan to zoom towards mouse position
      const zoomRatio = newZoom / zoom
      const newPanX = mouseX - (mouseX - pan.x) * zoomRatio
      const newPanY = mouseY - (mouseY - pan.y) * zoomRatio

      setZoom(newZoom)
      setPan({ x: newPanX, y: newPanY })
      setAutoFit(false)
    }

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element

      // Check if clicking on a diagram element
      if (target.closest("g[class*='node'], g[class*='edgePath'], g[class*='actor'], g[class*='rect']")) {
        if (interactionMode === "select") {
          setSelectedElement(target.closest("g") as Element)
          setIsElementDragging(true)
          e.stopPropagation()
          return
        }
      }

      // Pan mode or no element selected
      if (e.button === 0 && interactionMode === "pan") {
        setIsDragging(true)
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
        container.style.cursor = "grabbing"
        setAutoFit(false)
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && interactionMode === "pan") {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        })
      } else if (isElementDragging && selectedElement) {
        // Handle element dragging (visual feedback only for now)
        const rect = container.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        // Add visual feedback for element selection
        selectedElement.style.filter = "drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))"
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsElementDragging(false)
      container.style.cursor = interactionMode === "pan" ? (zoom > 1 ? "grab" : "default") : "crosshair"

      if (selectedElement) {
        selectedElement.style.filter = ""
      }
    }

    const handleMouseLeave = () => {
      setIsDragging(false)
      setIsElementDragging(false)
      container.style.cursor = "default"

      if (selectedElement) {
        selectedElement.style.filter = ""
      }
    }

    // Enhanced touch events for mobile
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()

      if (e.touches.length === 1) {
        const touch = e.touches[0]
        setIsDragging(true)
        setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y })
      } else if (e.touches.length === 2) {
        // Pinch zoom setup
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        lastTouchDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)
        lastTouchCenter = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
        }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()

      if (e.touches.length === 1 && isDragging) {
        const touch = e.touches[0]
        setPan({
          x: touch.clientX - dragStart.x,
          y: touch.clientY - dragStart.y,
        })
      } else if (e.touches.length === 2) {
        // Pinch zoom
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)

        if (lastTouchDistance > 0) {
          const scale = distance / lastTouchDistance
          const newZoom = Math.max(0.1, Math.min(5, zoom * scale))

          const center = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2,
          }

          const rect = container.getBoundingClientRect()
          const centerX = center.x - rect.left
          const centerY = center.y - rect.top

          const zoomRatio = newZoom / zoom
          const newPanX = centerX - (centerX - pan.x) * zoomRatio
          const newPanY = centerY - (centerY - pan.y) * zoomRatio

          setZoom(newZoom)
          setPan({ x: newPanX, y: newPanY })
        }

        lastTouchDistance = distance
        lastTouchCenter = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
        }
      }
    }

    const handleTouchEnd = () => {
      setIsDragging(false)
      setIsElementDragging(false)
      lastTouchDistance = 0
    }

    // Add event listeners with proper options
    container.addEventListener("wheel", handleWheel, { passive: false })
    container.addEventListener("mousedown", handleMouseDown)
    container.addEventListener("mousemove", handleMouseMove)
    container.addEventListener("mouseup", handleMouseUp)
    container.addEventListener("mouseleave", handleMouseLeave)
    container.addEventListener("touchstart", handleTouchStart, { passive: false })
    container.addEventListener("touchmove", handleTouchMove, { passive: false })
    container.addEventListener("touchend", handleTouchEnd)

    return () => {
      container.removeEventListener("wheel", handleWheel)
      container.removeEventListener("mousedown", handleMouseDown)
      container.removeEventListener("mousemove", handleMouseMove)
      container.removeEventListener("mouseup", handleMouseUp)
      container.removeEventListener("mouseleave", handleMouseLeave)
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchmove", handleTouchMove)
      container.removeEventListener("touchend", handleTouchEnd)
    }
  }, [zoom, pan, isDragging, dragStart, interactionMode, isElementDragging, selectedElement, screenSize])

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

    try {
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
    } catch (e) {
      console.error("Error copying SVG:", e)
      if (sanitizedCode) {
        copyToClipboard(sanitizedCode)
        setLabel("Copied code!")
        setTimeout(() => setLabel("Copy SVG"), 2000)
      }
    }
  }, [copyToClipboard, sanitizedCode])

  const handleCodeCopy = useCallback(() => {
    if (sanitizedCode) {
      copyToClipboard(sanitizedCode)
      setLabel("Copied code!")
      setTimeout(() => setLabel("Copy SVG"), 2000)
    }
  }, [copyToClipboard, sanitizedCode])

  const handleDownload = useCallback((format: "svg" | "png" = "svg") => {
    const container = containerRef.current
    if (!container) return

    const svgElement = container.querySelector("svg")
    if (svgElement) {
      if (format === "svg") {
        const svgData = svgElement.outerHTML
        const blob = new Blob([svgData], { type: "image/svg+xml" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = "diagram.svg"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } else {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        const img = new Image()

        img.crossOrigin = "anonymous"
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          ctx?.drawImage(img, 0, 0)

          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              const link = document.createElement("a")
              link.href = url
              link.download = "diagram.png"
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              URL.revokeObjectURL(url)
            }
          }, "image/png")
        }

        const svgData = svgElement.outerHTML
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
        const svgUrl = URL.createObjectURL(svgBlob)
        img.src = svgUrl
      }
    }
  }, [])

  // Enhanced zoom controls with better increments
  const handleZoomIn = useCallback(() => {
    const increment = screenSize === "mobile" ? 0.15 : 0.2
    setZoom((prev) => Math.min(5, prev + increment))
    setAutoFit(false)
  }, [screenSize])

  const handleZoomOut = useCallback(() => {
    const increment = screenSize === "mobile" ? 0.15 : 0.2
    setZoom((prev) => Math.max(0.1, prev - increment))
    setAutoFit(false)
  }, [screenSize])

  const handleFitToScreen = useCallback(() => {
    const container = svgContainerRef.current
    const svgWrapper = containerRef.current?.querySelector("div")

    if (container && svgWrapper) {
      const containerRect = container.getBoundingClientRect()
      const svgRect = svgWrapper.getBoundingClientRect()

      const padding = screenSize === "mobile" ? 0.8 : 0.9
      const scaleX = (containerRect.width * padding) / svgRect.width
      const scaleY = (containerRect.height * padding) / svgRect.height
      const newZoom = Math.min(scaleX, scaleY, 3)

      setZoom(newZoom)
      setPan({ x: 0, y: 0 })
      setAutoFit(true)
    }
  }, [screenSize])

  const handleResetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setAutoFit(true)
  }, [])

  const handleFullscreen = useCallback(() => {
    if (onFullscreenChange) {
      onFullscreenChange(!isFullscreen)
    }
  }, [isFullscreen, onFullscreenChange])

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
        try {
          container.innerHTML = ""
        } catch (e) {
          console.warn("Error clearing container:", e)
        }

        container.removeAttribute("data-processed")

        const isOldSyntax =
          chartCode.includes("=>") &&
          (chartCode.includes("start:") || chartCode.includes("operation:") || chartCode.includes("condition:"))

        const cleanedCode = sanitizeMermaidCode(chartCode)
        setSanitizedCode(cleanedCode)

        const codeWasFixed = cleanedCode !== chartCode.trim()
        setWasFixed(codeWasFixed && !isOldSyntax)
        setWasConverted(isOldSyntax)

        if (!cleanedCode) {
          throw new Error("Empty diagram code")
        }

        try {
          // Initialize mermaid with responsive settings
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "loose",
            theme: selectedTheme,
            logLevel: "error",
            flowchart: {
              useMaxWidth: false,
              htmlLabels: true,
              curve: "basis",
              padding: screenSize === "mobile" ? 10 : 20,
            },
            journey: {
              useMaxWidth: false,
            },
            sequence: {
              useMaxWidth: false,
              showSequenceNumbers: true,
              wrap: true,
              width: screenSize === "mobile" ? 120 : 150,
            },
            gantt: {
              useMaxWidth: false,
            },
          })

          const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

          let svg: string
          try {
            const result = await mermaid.render(id, cleanedCode)
            svg = result.svg
          } catch (renderError) {
            console.warn("Initial render failed, attempting with simplified syntax:", renderError)
            const simplifiedCode = createSimplifiedDiagram(cleanedCode)
            const simplifiedResult = await mermaid.render(id + "_simplified", simplifiedCode)
            svg = simplifiedResult.svg
            setWasFixed(true)
          }

          const wrapper = document.createElement("div")
          wrapper.innerHTML = svg
          wrapper.style.transformOrigin = "center center"
          wrapper.style.transition = isDragging ? "none" : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
          wrapper.style.width = "fit-content"
          wrapper.style.height = "fit-content"
          wrapper.style.position = "absolute"
          wrapper.style.top = "50%"
          wrapper.style.left = "50%"

          // Add interaction classes for better element selection
          const svgElement = wrapper.querySelector("svg")
          if (svgElement) {
            svgElement.style.userSelect = "none"
            svgElement.style.pointerEvents = "auto"

            // Add hover effects for interactive elements
            const nodes = svgElement.querySelectorAll("g[class*='node'], g[class*='actor']")
            nodes.forEach((node) => {
              const element = node as HTMLElement
              element.style.cursor = interactionMode === "select" ? "pointer" : "inherit"
              element.addEventListener("mouseenter", () => {
                if (interactionMode === "select") {
                  element.style.filter = "brightness(1.1)"
                }
              })
              element.addEventListener("mouseleave", () => {
                if (element !== selectedElement) {
                  element.style.filter = ""
                }
              })
            })
          }

          try {
            if (container && container.parentNode) {
              container.appendChild(wrapper)
            }
          } catch (e) {
            console.error("Error appending wrapper:", e)
            try {
              container.innerHTML = ""
              if (container && container.parentNode) {
                container.appendChild(wrapper)
              }
            } catch (innerError) {
              console.error("Failed to append after clearing:", innerError)
            }
          }

          if (autoFit) {
            setTimeout(() => handleFitToScreen(), 100)
          }

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

            const position = screenSize === "mobile" ? "top-2 left-2 right-2" : "top-4 left-4"
            successDiv.className = `absolute ${position} ${bgColor} border rounded-lg p-3 flex items-center gap-2 text-sm z-10 shadow-lg`
            successDiv.innerHTML = `
              <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
              </svg>
              <span class="flex-1">${messageText}</span>
            `

            try {
              container.appendChild(successDiv)
              setTimeout(() => {
                try {
                  if (container.contains(successDiv)) {
                    container.removeChild(successDiv)
                  }
                } catch (e) {
                  console.warn("Error removing success message:", e)
                  // Fallback: re-render without the message
                  try {
                    const messages = container.querySelectorAll('[class*="absolute"][class*="border"]')
                    messages.forEach((msg) => {
                      if (container.contains(msg)) {
                        container.removeChild(msg)
                      }
                    })
                  } catch (fallbackError) {
                    console.warn("Fallback removal also failed:", fallbackError)
                  }
                }
              }, 5000)
            } catch (e) {
              console.warn("Error adding success message:", e)
            }
          }
        } catch (error) {
          console.error("Mermaid rendering error:", error)
          const errorMessage = error instanceof Error ? error.message : "Unknown rendering error"
          setError(errorMessage)

          const errorDiv = document.createElement("div")
          errorDiv.className = "text-red-500 p-4 text-center max-w-lg mx-auto"

          let errorContent = `
            <div class="font-semibold mb-4 text-lg">Diagram Rendering Error</div>
            <div class="text-sm mb-6 text-red-600 bg-red-50 p-4 rounded-lg">${errorMessage}</div>
          `

          if (errorMessage.includes("Parse error") || errorMessage.includes("Expecting")) {
            errorContent += `
              <div class="text-xs text-gray-600 mb-6 p-4 bg-gray-50 rounded-lg">
                <strong class="block mb-2">Common fixes:</strong>
                • Check arrow syntax in sequence diagrams (-&gt;&gt;, --&gt;&gt;, -x)<br>
                • Ensure participant names don't contain spaces or special characters<br>
                • Verify all connections have proper arrow syntax (--&gt;)<br>
                • Make sure all brackets and quotes are properly closed
              </div>
            `
          }

          const buttonLayout = screenSize === "mobile" ? "flex-col space-y-2" : "space-x-3"
          errorContent += `
            <div class="flex ${buttonLayout}">
              <button class="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition-colors font-medium" id="show-code-btn">
                Show Diagram Code
              </button>
              <button class="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 transition-colors font-medium" id="retry-simplified-btn">
                Try Simplified Version
              </button>
            </div>
          `

          errorDiv.innerHTML = errorContent

          try {
            container.innerHTML = ""
            container.appendChild(errorDiv)
          } catch (e) {
            console.warn("Error adding error message:", e)
          }

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
      } finally {
        setIsRendering(false)
      }
    },
    [isClient, autoFit, handleFitToScreen, isDragging, wasFixed, screenSize, interactionMode, selectedElement],
  )

  // Update transform when zoom or pan changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const wrapper = container.querySelector("div")
    if (wrapper) {
      wrapper.style.transform = `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
      wrapper.style.transition = isDragging ? "none" : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
    }

    return () => {
      // Cleanup function
    }
  }, [zoom, pan, isDragging])

  // Render chart when chart or theme changes
  useEffect(() => {
    if (isClient && chart) {
      renderChart(chart, theme)
    }

    return () => {
      const container = containerRef.current
      if (container) {
        try {
          container.innerHTML = ""
        } catch (e) {
          console.warn("Error cleaning up container:", e)
        }
      }
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
    <div className={`w-full h-full relative ${isFullscreen ? "fixed inset-0 z-50 bg-white" : ""}`}>
      {/* Grid Background */}
      {showGrid && (
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
            `,
            backgroundSize: "20px 20px",
            transform: `translate(${pan.x % 20}px, ${pan.y % 20}px) scale(${zoom})`,
          }}
        />
      )}

      {/* Always Visible Canvas Controls */}
      <div className={`absolute ${screenSize === "mobile" ? "top-2 right-2 w-64" : "top-4 right-4 w-80"} z-20`}>
        <div className="bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-gray-200/50 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h3 className="font-semibold text-sm text-gray-800">Canvas Controls</h3>
          </div>

          {/* All Controls in One Panel */}
          <div className="p-4 space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto">
            {/* Quick Actions */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-3">Quick Actions</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="flex items-center justify-center gap-2 p-2 text-xs border rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={handleFitToScreen}
                >
                  <Maximize className="h-3 w-3" />
                  Fit Screen
                </button>
                <button
                  className="flex items-center justify-center gap-2 p-2 text-xs border rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={handleResetView}
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset View
                </button>
                <button
                  className="flex items-center justify-center gap-2 p-2 text-xs border rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={handleFullscreen}
                >
                  {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                  {isFullscreen ? "Exit Full" : "Fullscreen"}
                </button>
                <button
                  className={`flex items-center justify-center gap-2 p-2 text-xs border rounded-lg transition-colors ${
                    wasFixed
                      ? "border-green-300 text-green-700 bg-green-50"
                      : wasConverted
                        ? "border-blue-300 text-blue-700 bg-blue-50"
                        : "border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => setShowCode(!showCode)}
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
            </div>

            {/* Zoom Controls */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-3">Zoom & Pan</label>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-50"
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.1}
                  >
                    <ZoomOut className="h-3 w-3" />
                  </button>
                  <div className="flex-1 bg-gray-100 rounded-lg p-2 text-center">
                    <span className="text-sm font-mono">{Math.round(zoom * 100)}%</span>
                  </div>
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-50"
                    onClick={handleZoomIn}
                    disabled={zoom >= 5}
                  >
                    <ZoomIn className="h-3 w-3" />
                  </button>
                </div>

                {/* Pan Indicator */}
                {(Math.abs(pan.x) > 10 || Math.abs(pan.y) > 10) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <div className="flex items-center gap-2 text-xs text-blue-700">
                      <Move className="h-3 w-3" />
                      <span>
                        Pan: {Math.round(pan.x)}, {Math.round(pan.y)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Interaction Mode */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-3">Interaction Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`flex items-center justify-center gap-2 p-3 text-xs border rounded-lg transition-colors ${
                    interactionMode === "pan" ? "bg-blue-50 border-blue-300 text-blue-700" : "hover:bg-gray-50"
                  }`}
                  onClick={() => setInteractionMode("pan")}
                >
                  <Hand className="h-4 w-4" />
                  <span>Pan Mode</span>
                </button>
                <button
                  className={`flex items-center justify-center gap-2 p-3 text-xs border rounded-lg transition-colors ${
                    interactionMode === "select" ? "bg-blue-50 border-blue-300 text-blue-700" : "hover:bg-gray-50"
                  }`}
                  onClick={() => setInteractionMode("select")}
                >
                  <MousePointer2 className="h-4 w-4" />
                  <span>Select Mode</span>
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {interactionMode === "pan"
                  ? "Scroll to zoom • Drag to pan • Click elements to inspect"
                  : "Click to select elements • Drag to move • Enhanced element interaction"}
              </div>
            </div>

            {/* Grid Toggle */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Show Grid</span>
                <button
                  className={`w-12 h-6 rounded-full transition-colors ${showGrid ? "bg-blue-600" : "bg-gray-300"}`}
                  onClick={() => setShowGrid(!showGrid)}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      showGrid ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-500">Toggle background grid for better alignment</div>
            </div>

            {/* Theme Selection */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-3">Diagram Theme</label>
              <select
                value={theme}
                onChange={handleThemeChange}
                className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isRendering}
              >
                {Available_Themes.map((themeOption) => (
                  <option key={themeOption} value={themeOption}>
                    {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                  </option>
                ))}
              </select>

              {/* Theme Preview Buttons */}
              <div className="grid grid-cols-3 gap-1 mt-2">
                {Available_Themes.slice(0, 6).map((themeOption) => (
                  <button
                    key={themeOption}
                    className={`p-2 text-xs rounded border transition-colors ${
                      theme === themeOption
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => {
                      const event = { target: { value: themeOption } } as any
                      handleThemeChange(event)
                    }}
                  >
                    {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Export & Copy Options */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-3">Export & Copy</label>
              <div className="space-y-2">
                {/* Copy Options */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="flex items-center justify-center gap-2 p-2 text-xs border rounded-lg hover:bg-gray-50 transition-colors"
                    onClick={handleCopyClick}
                    disabled={isRendering}
                  >
                    <Copy className="h-3 w-3" />
                    Copy SVG
                  </button>
                  <button
                    className="flex items-center justify-center gap-2 p-2 text-xs border rounded-lg hover:bg-gray-50 transition-colors"
                    onClick={handleCodeCopy}
                  >
                    <Code className="h-3 w-3" />
                    Copy Code
                  </button>
                </div>

                {/* Download Options */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="flex items-center justify-center gap-2 p-2 text-xs border rounded-lg hover:bg-gray-50 transition-colors"
                    onClick={() => handleDownload("svg")}
                    disabled={isRendering}
                  >
                    <Download className="h-3 w-3" />
                    Download SVG
                  </button>
                  <button
                    className="flex items-center justify-center gap-2 p-2 text-xs border rounded-lg hover:bg-gray-50 transition-colors"
                    onClick={() => handleDownload("png")}
                    disabled={isRendering}
                  >
                    <Download className="h-3 w-3" />
                    Download PNG
                  </button>
                </div>
              </div>
            </div>

            {/* Status Information */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">Status</label>
              <div className="space-y-2">
                {isRendering && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <div className="flex items-center gap-2 text-xs text-blue-700">
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
                      <span>Rendering diagram...</span>
                    </div>
                  </div>
                )}

                {wasFixed && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                    <div className="flex items-center gap-2 text-xs text-green-700">
                      <CheckCircle className="h-3 w-3" />
                      <span>Syntax automatically fixed</span>
                    </div>
                  </div>
                )}

                {wasConverted && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <div className="flex items-center gap-2 text-xs text-blue-700">
                      <RefreshCw className="h-3 w-3" />
                      <span>Converted from old syntax</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <div className="flex items-center gap-2 text-xs text-red-700">
                      <AlertCircle className="h-3 w-3" />
                      <span>Rendering error occurred</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Code View */}
      {showCode && (
        <div className="absolute inset-0 bg-gray-900 text-gray-100 p-4 z-30 overflow-auto">
          <div className={`flex ${screenSize === "mobile" ? "flex-col gap-4" : "justify-between items-center"} mb-6`}>
            <div className="flex items-center gap-3">
              <h3 className={`${screenSize === "mobile" ? "text-base" : "text-lg"} font-semibold`}>
                Mermaid Diagram Code
              </h3>
              {wasFixed && (
                <span className="px-3 py-1 bg-green-800 text-green-100 rounded-full text-xs font-medium">
                  Automatically Fixed
                </span>
              )}
              {wasConverted && (
                <span className="px-3 py-1 bg-blue-800 text-blue-100 rounded-full text-xs font-medium">
                  Converted from Old Syntax
                </span>
              )}
            </div>
            <div className={`flex gap-3 ${screenSize === "mobile" ? "w-full" : ""}`}>
              <button
                className={`flex items-center gap-2 px-4 py-2 text-sm border border-gray-700 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors ${
                  screenSize === "mobile" ? "flex-1 justify-center" : ""
                }`}
                onClick={handleCodeCopy}
              >
                <Copy className="h-4 w-4" />
                Copy Code
              </button>
              <button
                className={`flex items-center gap-2 px-4 py-2 text-sm border border-gray-700 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors ${
                  screenSize === "mobile" ? "flex-1 justify-center" : ""
                }`}
                onClick={() => setShowCode(false)}
              >
                Close
              </button>
            </div>
          </div>

          {(wasFixed || wasConverted) && (
            <div
              className={`mb-6 p-4 border rounded-lg ${
                wasConverted ? "bg-blue-900 border-blue-700" : "bg-green-900 border-green-700"
              }`}
            >
              <div className={`text-sm font-medium mb-3 ${wasConverted ? "text-blue-100" : "text-green-100"}`}>
                {wasConverted ? "Old Flowchart Syntax Converted:" : "Syntax Issues Fixed:"}
              </div>
              <div className={`text-sm ${wasConverted ? "text-blue-200" : "text-green-200"}`}>
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
                    <br />• Optimized for better rendering performance
                  </>
                )}
              </div>
            </div>
          )}

          <pre
            className={`text-sm font-mono bg-gray-800 p-4 rounded-lg overflow-auto border border-gray-700 ${
              screenSize === "mobile" ? "text-xs" : ""
            }`}
          >
            {sanitizedCode || chart}
          </pre>
        </div>
      )}

      {/* Main Canvas Container */}
      <div
        ref={svgContainerRef}
        className={`w-full h-full relative overflow-hidden transition-colors duration-300 ${
          showGrid ? "bg-gray-50" : "bg-white"
        }`}
        style={{
          cursor:
            interactionMode === "select" ? "crosshair" : zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          minHeight: "300px",
          touchAction: "none", // Prevent default touch behaviors
        }}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => {
          // Controls always visible - no auto-hide
        }}
      >
        <div ref={containerRef} className="w-full h-full relative flex items-center justify-center">
          {isRendering && (
            <div className="flex flex-col items-center gap-4 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className={`${screenSize === "mobile" ? "text-sm" : "text-sm"} font-medium`}>
                Rendering diagram...
              </span>
              <div className={`${screenSize === "mobile" ? "text-xs" : "text-xs"} text-gray-400`}>
                This may take a moment for complex diagrams
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && !showCode && (
        <div
          className={`absolute ${
            screenSize === "mobile" ? "bottom-4 left-2 right-2" : "bottom-6 left-6 right-6"
          } bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 z-10 shadow-lg`}
        >
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className={`${screenSize === "mobile" ? "text-sm" : "text-sm"} font-semibold text-red-800`}>
              Diagram Rendering Error
            </p>
            <p className={`${screenSize === "mobile" ? "text-xs" : "text-xs"} text-red-600 mt-1`}>{error}</p>
            <button
              className={`mt-2 ${screenSize === "mobile" ? "text-xs" : "text-xs"} text-red-700 hover:text-red-800 underline`}
              onClick={() => setShowCode(true)}
            >
              View diagram code for debugging
            </button>
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
