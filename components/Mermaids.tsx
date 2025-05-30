"use client"

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
  RotateCcw,
  Download,
  Maximize,
  MousePointer2,
  Hand,
  X,
  Grid,
} from "lucide-react"
import type { Theme } from "@/types/type"
import { sanitizeMermaidCode, createFallbackDiagram } from "@/lib/utils"
import { Button } from "./ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import { APP_CONFIG } from "@/lib/constants"
import { toast } from "sonner"

interface MermaidProps {
  chart: string
  isFullscreen?: boolean
  onFullscreenChange?: (fullscreen: boolean) => void
  isStandalone?: boolean
}

// Helper function to validate Mermaid code (basic check)
function isPotentiallyValidMermaid(code: string): boolean {
  if (!code || typeof code !== "string") return false
  const trimmedCode = code.trim()
  if (trimmedCode.length < 5) return false // Arbitrary short length check
  const firstLine = trimmedCode.split("\n")[0].toLowerCase()
  const validStarts = [
    "graph",
    "flowchart",
    "sequencediagram",
    "classdiagram",
    "journey",
    "gantt",
    "statediagram",
    "erdiagram",
    "pie",
    "mindmap",
    "timeline",
  ]
  return validStarts.some((start) => firstLine.startsWith(start))
}

export function Mermaid({ chart, isFullscreen = false, onFullscreenChange, isStandalone = false }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<Theme>(APP_CONFIG.DEFAULT_MERMAID_THEME as Theme)
  const [isClient, setIsClient] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [error, setError] = useState<string>("")
  const [showCode, setShowCode] = useState(false)
  const [sanitizedCode, setSanitizedCode] = useState("")
  const [wasFixed, setWasFixed] = useState(false)

  // Enhanced zoom and pan state with better control
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showControls, setShowControls] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [autoFit, setAutoFit] = useState(true)

  // Enhanced interaction state
  const [interactionMode, setInteractionMode] = useState<"pan" | "select">("pan")

  // Control panel state
  const [controlsExpanded, setControlsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<"zoom" | "theme" | "export">("zoom")

  // Responsive breakpoints
  const [screenSize, setScreenSize] = useState<"mobile" | "tablet" | "desktop">("desktop")

  // Initialize client-side state and responsive handling
  useEffect(() => {
    setIsClient(true)
    const savedTheme = localStorage.getItem("mermaid-theme")
    if (savedTheme && APP_CONFIG.AVAILABLE_MERMAID_THEMES.includes(savedTheme)) {
      setTheme(savedTheme as Theme)
    }

    // Handle responsive breakpoints
    const handleResize = () => {
      const width = window.innerWidth
      if (width < 768) setScreenSize("mobile")
      else if (width < 1024) setScreenSize("tablet")
      else setScreenSize("desktop")
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const initializeMermaid = useCallback(
    (currentTheme: Theme) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: currentTheme,
        logLevel: "error", // Only log errors
        suppressErrorRendering: true, // We handle error display
        flowchart: { useMaxWidth: false, htmlLabels: true, curve: "basis" },
        sequence: {
          useMaxWidth: false,
          showSequenceNumbers: true,
          wrap: true,
          width: screenSize === "mobile" ? 120 : 150,
        },
        // Add other diagram type configs if needed
      })
    },
    [screenSize],
  )

  // Enhanced mouse and touch interactions with better zoom control
  const renderChart = useCallback(
    async (chartCode: string, currentTheme: Theme) => {
      const diagramContainer = containerRef.current
      if (!chartCode || !diagramContainer || !isClient) return

      setIsRendering(true)
      setError("")
      setWasFixed(false)

      // Clear previous content
      diagramContainer.innerHTML = ""
      diagramContainer.removeAttribute("data-processed")

      let currentSanitizedCode = ""
      try {
        currentSanitizedCode = sanitizeMermaidCode(chartCode)
        setSanitizedCode(currentSanitizedCode)
        if (currentSanitizedCode !== chartCode.trim()) {
          setWasFixed(true)
          toast.info("Diagram syntax automatically corrected.", { duration: 3000 })
        }
      } catch (e) {
        console.error("Sanitization error:", e)
        setError("Failed to sanitize diagram code.")
        currentSanitizedCode = createFallbackDiagram(chartCode, "Sanitization Error")
        setSanitizedCode(currentSanitizedCode)
        setWasFixed(true)
      }

      if (!isPotentiallyValidMermaid(currentSanitizedCode)) {
        setError("Invalid Mermaid code structure after sanitization.")
        currentSanitizedCode = createFallbackDiagram(currentSanitizedCode, "Invalid Structure")
        setSanitizedCode(currentSanitizedCode)
        setWasFixed(true)
      }

      try {
        initializeMermaid(currentTheme)
        const id = `mermaid-diagram-${Date.now()}`
        const { svg } = await mermaid.render(id, currentSanitizedCode)

        const wrapper = document.createElement("div")
        wrapper.innerHTML = svg
        wrapper.style.transformOrigin = "center center"
        wrapper.style.transition = isDragging ? "none" : "transform 0.2s ease-out"
        wrapper.style.width = "fit-content"
        wrapper.style.height = "fit-content"
        wrapper.style.position = "absolute"
        wrapper.style.top = "50%"
        wrapper.style.left = "50%"
        diagramContainer.appendChild(wrapper)

        if (autoFit) {
          setTimeout(() => handleFitToScreen(), 50) // Slight delay for layout
        }
      } catch (e: any) {
        console.error("Mermaid rendering error:", e)
        const errorMessage = e.message || "Unknown rendering error"
        setError(`Rendering failed: ${errorMessage}. Displaying fallback.`)
        toast.error(`Diagram rendering failed: ${errorMessage}`)

        // Attempt to render fallback diagram
        try {
          const fallbackCode = createFallbackDiagram(chartCode, errorMessage)
          setSanitizedCode(fallbackCode) // Show fallback code if user views code
          initializeMermaid(currentTheme) // Re-initialize for fallback
          const fallbackId = `mermaid-fallback-${Date.now()}`
          const { svg: fallbackSvg } = await mermaid.render(fallbackId, fallbackCode)
          diagramContainer.innerHTML = fallbackSvg // Directly set SVG for fallback
          // Adjust styles for fallback if needed
          const fallbackSvgElement = diagramContainer.querySelector("svg")
          if (fallbackSvgElement) {
            fallbackSvgElement.style.position = "absolute"
            fallbackSvgElement.style.top = "50%"
            fallbackSvgElement.style.left = "50%"
            fallbackSvgElement.style.transform = "translate(-50%, -50%)"
            fallbackSvgElement.style.maxWidth = "90%"
            fallbackSvgElement.style.maxHeight = "90%"
          }
        } catch (fallbackError: any) {
          console.error("Fallback diagram rendering error:", fallbackError)
          diagramContainer.innerHTML = `<div class="text-destructive p-4 text-center">Failed to render diagram and fallback. Error: ${fallbackError.message}</div>`
        }
        setWasFixed(true) // Indicate that a fix (fallback) was applied
      } finally {
        setIsRendering(false)
      }
    },
    [isClient, autoFit, isDragging, initializeMermaid], // Removed handleFitToScreen from deps to break cycle
  )

  const handleFitToScreen = useCallback(() => {
    const diagramDisplayContainer = svgContainerRef.current // This is the scrollable/pannable area
    const renderedSvgWrapper = containerRef.current?.firstChild as HTMLElement // The div containing the <svg>

    if (
      diagramDisplayContainer &&
      renderedSvgWrapper &&
      renderedSvgWrapper.offsetWidth > 0 &&
      renderedSvgWrapper.offsetHeight > 0
    ) {
      const containerRect = diagramDisplayContainer.getBoundingClientRect()
      const svgRect = renderedSvgWrapper.getBoundingClientRect() // Get actual rendered size

      // Use renderedSvgWrapper dimensions for scaling
      const svgWidth = renderedSvgWrapper.offsetWidth
      const svgHeight = renderedSvgWrapper.offsetHeight

      if (svgWidth === 0 || svgHeight === 0) return // Avoid division by zero

      const padding = 0.9 // 90% of container
      const scaleX = (containerRect.width * padding) / svgWidth
      const scaleY = (containerRect.height * padding) / svgHeight
      const newZoom = Math.min(scaleX, scaleY, 3) // Cap max zoom at 3x

      setZoom(newZoom)
      setPan({ x: 0, y: 0 }) // Center the diagram
      setAutoFit(true)
    }
  }, []) // Removed screenSize from deps as it's handled by resize effect

  const handleZoomIn = useCallback(() => {
    setZoom((prevZoom) => Math.min(prevZoom * 1.1, 5))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((prevZoom) => Math.max(prevZoom * 0.9, 0.1))
  }, [])

  useEffect(() => {
    if (isClient && chart) {
      renderChart(chart, theme)
    }
  }, [chart, theme, isClient, renderChart])

  useEffect(() => {
    const diagramDisplayContainer = svgContainerRef.current
    if (!diagramDisplayContainer) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const zoomSensitivity = 0.1
      const delta = e.deltaY > 0 ? -zoomSensitivity : zoomSensitivity
      const rect = diagramDisplayContainer.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const newZoom = Math.max(0.1, Math.min(5, zoom + delta))
      const zoomRatio = newZoom / zoom
      const newPanX = mouseX - (mouseX - pan.x) * zoomRatio
      const newPanY = mouseY - (mouseY - pan.y) * zoomRatio
      setZoom(newZoom)
      setPan({ x: newPanX, y: newPanY })
      setAutoFit(false)
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && interactionMode === "pan") {
        setIsDragging(true)
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
        diagramDisplayContainer.style.cursor = "grabbing"
        setAutoFit(false)
      }
    }
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && interactionMode === "pan") {
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
      }
    }
    const handleMouseUpOrLeave = () => {
      setIsDragging(false)
      diagramDisplayContainer.style.cursor = interactionMode === "pan" ? (zoom > 1 ? "grab" : "default") : "crosshair"
    }

    diagramDisplayContainer.addEventListener("wheel", handleWheel, { passive: false })
    diagramDisplayContainer.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mousemove", handleMouseMove) // Listen on window for dragging outside
    window.addEventListener("mouseup", handleMouseUpOrLeave)
    diagramDisplayContainer.addEventListener("mouseleave", handleMouseUpOrLeave)

    return () => {
      diagramDisplayContainer.removeEventListener("wheel", handleWheel)
      diagramDisplayContainer.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUpOrLeave)
      diagramDisplayContainer.removeEventListener("mouseleave", handleMouseUpOrLeave)
    }
  }, [zoom, pan, isDragging, dragStart, interactionMode])

  useEffect(() => {
    const renderedSvgWrapper = containerRef.current?.firstChild as HTMLElement
    if (renderedSvgWrapper) {
      renderedSvgWrapper.style.transform = `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
    }
  }, [zoom, pan])

  const copyToClipboard = useCallback((text: string, type: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(`${type} copied to clipboard!`)
      })
      .catch(() => {
        toast.error(`Failed to copy ${type}.`)
      })
  }, [])

  const handleCopySvg = useCallback(() => {
    const svgElement = containerRef.current?.querySelector("svg")
    if (svgElement) copyToClipboard(svgElement.outerHTML, "SVG")
    else toast.error("No SVG found to copy.")
  }, [copyToClipboard])

  const handleCopyCode = useCallback(() => {
    if (sanitizedCode) copyToClipboard(sanitizedCode, "Mermaid code")
    else toast.error("No code found to copy.")
  }, [copyToClipboard, sanitizedCode])

  const handleDownload = useCallback((format: "svg" | "png") => {
    const svgElement = containerRef.current?.querySelector("svg")
    if (!svgElement) {
      toast.error("No diagram to download.")
      return
    }
    const svgData = new XMLSerializer().serializeToString(svgElement)
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url

    if (format === "svg") {
      link.download = "diagram.svg"
      link.click()
      toast.success("SVG downloaded.")
    } else {
      // PNG
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        // Add padding for better PNG export
        const padding = 20
        canvas.width = img.width + padding * 2
        canvas.height = img.height + padding * 2
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.fillStyle = "white" // Set background to white for PNG
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, padding, padding)
          const pngUrl = canvas.toDataURL("image/png")
          link.href = pngUrl
          link.download = "diagram.png"
          link.click()
          toast.success("PNG downloaded.")
        } else {
          toast.error("Failed to create PNG.")
        }
        URL.revokeObjectURL(url) // Revoke blob URL after image is loaded
      }
      img.onerror = () => {
        toast.error("Failed to load SVG for PNG conversion.")
        URL.revokeObjectURL(url)
      }
      img.src = url // Use blob URL directly
      return // Don't revoke URL until image is processed for PNG
    }
    URL.revokeObjectURL(url)
  }, [])

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem("mermaid-theme", newTheme)
    // Re-render is handled by useEffect watching `theme`
  }, [])

  const controlButtonClass =
    "p-2 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
  const activeControlButtonClass = "bg-primary text-primary-foreground hover:bg-primary/90"

  // Enhanced zoom controls with better increments
  const handleResetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setAutoFit(true)
    setShowControls(true)
  }, [])

  const handleFullscreen = useCallback(() => {
    if (onFullscreenChange) {
      onFullscreenChange(!isFullscreen)
    }
  }, [isFullscreen, onFullscreenChange])

  // Don't render anything on server side
  if (!isClient) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-muted rounded-lg">
        <div className="text-muted-foreground">Loading diagram...</div>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`w-full h-full relative flex flex-col ${isFullscreen ? "fixed inset-0 z-50 bg-background" : ""}`}>
        {/* Top Controls Bar */}
        <div className="p-2 border-b bg-background flex items-center justify-between space-x-2 flex-wrap">
          <div className="flex items-center space-x-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={zoom >= 5}
                  className={controlButtonClass}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom In</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.1}
                  className={controlButtonClass}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom Out</TooltipContent>
            </Tooltip>
            <div className="px-3 py-1.5 text-xs font-mono bg-muted rounded-md min-w-[60px] text-center border">
              {Math.round(zoom * 100)}%
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleFitToScreen} className={controlButtonClass}>
                  <Maximize className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fit to Screen</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleResetView} className={controlButtonClass}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset View</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center space-x-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setInteractionMode("pan")}
                  className={`${controlButtonClass} ${interactionMode === "pan" ? activeControlButtonClass : ""}`}
                >
                  <Hand className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pan Mode (Drag to move)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setInteractionMode("select")}
                  className={`${controlButtonClass} ${interactionMode === "select" ? activeControlButtonClass : ""}`}
                >
                  <MousePointer2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Select Mode (Future feature)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowGrid(!showGrid)}
                  className={`${controlButtonClass} ${showGrid ? activeControlButtonClass : ""}`}
                >
                  <Grid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showGrid ? "Hide" : "Show"} Grid</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center space-x-1">
            <select
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value as Theme)}
              className="px-2 py-1.5 text-xs border bg-background hover:bg-muted rounded-md focus:outline-none focus:ring-1 focus:ring-ring h-9"
              aria-label="Select diagram theme"
            >
              {APP_CONFIG.AVAILABLE_MERMAID_THEMES.map((themeOption) => (
                <option key={themeOption} value={themeOption}>
                  {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                </option>
              ))}
            </select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCode(!showCode)}
                  className={`${controlButtonClass} ${showCode ? activeControlButtonClass : ""}`}
                >
                  <Code className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showCode ? "Hide" : "Show"} Mermaid Code</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleFullscreen} className={controlButtonClass}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Main Canvas Container */}
        <div
          ref={svgContainerRef}
          className="flex-1 w-full h-full relative overflow-hidden bg-background"
          style={{
            cursor: interactionMode === "select" ? "crosshair" : isDragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
        >
          {showGrid && (
            <div
              className="absolute inset-0 opacity-50 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(var(--border) 1px, transparent 1px),
                  linear-gradient(90deg, var(--border) 1px, transparent 1px)
                `,
                backgroundSize: "20px 20px",
                transform: `translate(${pan.x % 20}px, ${pan.y % 20}px) scale(${zoom})`, // Grid moves with pan/zoom
              }}
            />
          )}
          <div ref={containerRef} className="w-full h-full relative flex items-center justify-center">
            {isRendering && (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm font-medium">Rendering diagram...</span>
              </div>
            )}
          </div>
        </div>

        {/* Code View Modal */}
        {showCode && (
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm z-30 p-4 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="code-view-title"
          >
            <div className="bg-card p-4 rounded-lg shadow-xl flex-1 flex flex-col overflow-hidden border">
              <div className="flex justify-between items-center mb-3">
                <h3 id="code-view-title" className="text-lg font-semibold">
                  Mermaid Diagram Code
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCode(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              {wasFixed && (
                <div className="mb-3 p-2 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-200 rounded-md text-xs flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>Syntax was automatically corrected or simplified.</span>
                </div>
              )}
              <pre className="text-sm font-mono bg-muted p-3 rounded-md overflow-auto flex-1 border text-muted-foreground">
                <code>{sanitizedCode || chart}</code>
              </pre>
              <div className="mt-4 flex justify-end space-x-2">
                <Button variant="outline" onClick={handleCopyCode}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Code
                </Button>
                <Button variant="outline" onClick={() => handleDownload("svg")}>
                  <Download className="h-4 w-4 mr-2" />
                  Download SVG
                </Button>
                <Button variant="outline" onClick={() => handleDownload("png")}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PNG
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && !isRendering && !showCode && (
          <div className="absolute bottom-4 left-4 right-4 bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg text-xs flex items-start gap-2 z-10 shadow-md">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Diagram Error:</p>
              <p>{error}</p>
              <Button
                variant="link"
                size="sm"
                className="text-destructive h-auto p-0 mt-1 text-xs"
                onClick={() => setShowCode(true)}
              >
                View Code
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
