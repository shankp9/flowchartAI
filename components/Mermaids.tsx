"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import mermaid from "mermaid"
import {
  Copy,
  Palette,
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
  Navigation,
  Settings,
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
  // wasFixed and wasConverted are now managed internally by renderChart or derived from sanitizedCode vs chart
  // const [wasFixed, setWasFixed] = useState(false);
  // const [wasConverted, setWasConverted] = useState(false);

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showControls, setShowControls] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [autoFit, setAutoFit] = useState(true)

  const [isElementDragging, setIsElementDragging] = useState(false)
  const [selectedElement, setSelectedElement] = useState<Element | null>(null)
  const [interactionMode, setInteractionMode] = useState<"pan" | "select">("pan")

  const [controlsExpanded, setControlsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<"zoom" | "theme" | "export">("zoom")
  const [screenSize, setScreenSize] = useState<"mobile" | "tablet" | "desktop">("desktop")

  const latestRenderIdRef = useRef(0)
  const successMessageTimeoutIdRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setIsClient(true)
    const savedTheme = localStorage.getItem("mermaid-theme")
    if (savedTheme && Available_Themes.includes(savedTheme as Theme)) {
      setTheme(savedTheme as Theme)
    }

    const handleResize = () => {
      const width = window.innerWidth
      if (width < 768) setScreenSize("mobile")
      else if (width < 1024) setScreenSize("tablet")
      else setScreenSize("desktop")
      if (width < 768) setControlsExpanded(false)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "default", // Initial theme, will be updated by renderChart
      logLevel: "error", // Reduce console noise
      flowchart: { useMaxWidth: false, htmlLabels: true, curve: "basis" },
      journey: { useMaxWidth: false },
      sequence: {
        useMaxWidth: false,
        showSequenceNumbers: true,
        wrap: true,
        width: screenSize === "mobile" ? 120 : 150,
      },
      gantt: { useMaxWidth: false },
    })

    const timer = setTimeout(() => {
      if (screenSize === "mobile" && !isFullscreen && !isStandalone) setShowControls(false)
    }, 3000)

    return () => {
      clearTimeout(timer)
      window.removeEventListener("resize", handleResize)
    }
  }, [isFullscreen, isStandalone, screenSize]) // screenSize dependency for sequence diagram width

  useEffect(() => {
    const svgEl = svgContainerRef.current
    if (!svgEl) return

    let lastTouchDistance = 0
    let lastTouchCenter = { x: 0, y: 0 }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const zoomSensitivity = screenSize === "mobile" ? 0.05 : 0.1
      const delta = e.deltaY > 0 ? -zoomSensitivity : zoomSensitivity
      const rect = svgEl.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      setZoom((prevZoom) => {
        const newZoom = Math.max(0.1, Math.min(5, prevZoom + delta))
        const zoomRatio = newZoom / prevZoom
        setPan((prevPan) => ({
          x: mouseX - (mouseX - prevPan.x) * zoomRatio,
          y: mouseY - (mouseY - prevPan.y) * zoomRatio,
        }))
        return newZoom
      })
      setShowControls(true)
      setAutoFit(false)
    }

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element
      if (
        interactionMode === "select" &&
        target.closest("g[class*='node'], g[class*='edgePath'], g[class*='actor'], g[class*='rect']")
      ) {
        setSelectedElement(target.closest("g"))
        setIsElementDragging(true)
        e.stopPropagation()
        return
      }
      if (e.button === 0 && interactionMode === "pan") {
        setIsDragging(true)
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
        svgEl.style.cursor = "grabbing"
        setAutoFit(false)
      }
    }
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && interactionMode === "pan") {
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
      } else if (isElementDragging && selectedElement) {
        ;(selectedElement as HTMLElement).style.filter = "drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))"
      }
      setShowControls(true)
    }
    const handleMouseUpOrLeave = () => {
      setIsDragging(false)
      setIsElementDragging(false)
      if (svgEl) svgEl.style.cursor = interactionMode === "pan" ? (zoom > 1 ? "grab" : "default") : "crosshair"
      if (selectedElement) (selectedElement as HTMLElement).style.filter = ""
    }

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        setIsDragging(true)
        setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y })
      } else if (e.touches.length === 2) {
        const t1 = e.touches[0],
          t2 = e.touches[1]
        lastTouchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        lastTouchCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }
      }
    }
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1 && isDragging) {
        const touch = e.touches[0]
        setPan({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y })
      } else if (e.touches.length === 2) {
        const t1 = e.touches[0],
          t2 = e.touches[1]
        const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        if (lastTouchDistance > 0) {
          const scale = distance / lastTouchDistance
          setZoom((prevZoom) => {
            const newZoom = Math.max(0.1, Math.min(5, prevZoom * scale))
            const rect = svgEl.getBoundingClientRect()
            const currentTouchCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }
            const centerX = currentTouchCenter.x - rect.left
            const centerY = currentTouchCenter.y - rect.top
            const zoomRatio = newZoom / prevZoom
            setPan((prevPan) => ({
              x: centerX - (centerX - prevPan.x) * zoomRatio,
              y: centerY - (centerY - prevPan.y) * zoomRatio,
            }))
            return newZoom
          })
        }
        lastTouchDistance = distance
        lastTouchCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }
      }
    }
    const handleTouchEnd = () => {
      setIsDragging(false)
      setIsElementDragging(false)
      lastTouchDistance = 0
    }

    svgEl.addEventListener("wheel", handleWheel, { passive: false })
    svgEl.addEventListener("mousedown", handleMouseDown)
    svgEl.addEventListener("mousemove", handleMouseMove)
    svgEl.addEventListener("mouseup", handleMouseUpOrLeave)
    svgEl.addEventListener("mouseleave", handleMouseUpOrLeave)
    svgEl.addEventListener("touchstart", handleTouchStart, { passive: false })
    svgEl.addEventListener("touchmove", handleTouchMove, { passive: false })
    svgEl.addEventListener("touchend", handleTouchEnd)

    return () => {
      svgEl.removeEventListener("wheel", handleWheel)
      svgEl.removeEventListener("mousedown", handleMouseDown)
      svgEl.removeEventListener("mousemove", handleMouseMove)
      svgEl.removeEventListener("mouseup", handleMouseUpOrLeave)
      svgEl.removeEventListener("mouseleave", handleMouseUpOrLeave)
      svgEl.removeEventListener("touchstart", handleTouchStart)
      svgEl.removeEventListener("touchmove", handleTouchMove)
      svgEl.removeEventListener("touchend", handleTouchEnd)
    }
  }, [zoom, pan, isDragging, dragStart, interactionMode, isElementDragging, selectedElement, screenSize])

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement("textarea")
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
    })
  }, [])

  const handleCopyClick = useCallback(() => {
    const svgEl = containerRef.current?.querySelector("svg")
    if (svgEl) {
      copyToClipboard(svgEl.outerHTML)
      setLabel("Copied SVG!")
    } else if (sanitizedCode) {
      copyToClipboard(sanitizedCode)
      setLabel("Copied code!")
    }
    setTimeout(() => setLabel("Copy SVG"), 2000)
  }, [copyToClipboard, sanitizedCode])

  const handleCodeCopy = useCallback(() => {
    if (sanitizedCode) {
      copyToClipboard(sanitizedCode)
      setLabel("Copied code!")
      setTimeout(() => setLabel("Copy SVG"), 2000)
    }
  }, [copyToClipboard, sanitizedCode])

  const handleDownload = useCallback((format: "svg" | "png" = "svg") => {
    const svgEl = containerRef.current?.querySelector("svg")
    if (!svgEl) return

    if (format === "svg") {
      const svgData = svgEl.outerHTML
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
      // PNG
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
        URL.revokeObjectURL(img.src) // Clean up blob URL for image source
      }
      const svgData = new XMLSerializer().serializeToString(svgEl)
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
      img.src = URL.createObjectURL(svgBlob)
    }
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(5, prev + (screenSize === "mobile" ? 0.15 : 0.2)))
    setShowControls(true)
    setAutoFit(false)
  }, [screenSize])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(0.1, prev - (screenSize === "mobile" ? 0.15 : 0.2)))
    setShowControls(true)
    setAutoFit(false)
  }, [screenSize])

  const handleFitToScreen = useCallback(() => {
    const svgDrawingArea = containerRef.current?.querySelector("div > svg") // Target the SVG element itself
    const svgViewport = svgContainerRef.current

    if (svgDrawingArea && svgViewport) {
      const drawingRect = svgDrawingArea.getBoundingClientRect()
      const viewportRect = svgViewport.getBoundingClientRect()

      if (drawingRect.width === 0 || drawingRect.height === 0) return // Avoid division by zero

      const paddingFactor = screenSize === "mobile" ? 0.85 : 0.9 // Slightly more padding for mobile
      const scaleX = (viewportRect.width * paddingFactor) / drawingRect.width
      const scaleY = (viewportRect.height * paddingFactor) / drawingRect.height
      const newZoom = Math.min(scaleX, scaleY, 3) // Cap max zoom for fit

      setZoom(newZoom)
      // Center the diagram
      const newPanX =
        (viewportRect.width - drawingRect.width * newZoom) / 2 -
        (((drawingRect.left - viewportRect.left) * newZoom) / drawingRect.width) * drawingRect.width
      const newPanY =
        (viewportRect.height - drawingRect.height * newZoom) / 2 -
        (((drawingRect.top - viewportRect.top) * newZoom) / drawingRect.height) * drawingRect.height

      // This pan calculation needs to be relative to the SVG's own coordinate system if it has a viewBox
      // For simplicity, if SVG is absolutely positioned and centered, pan might be simpler.
      // The current pan logic in handleWheel zooms towards mouse. For fit-to-screen, we want to center.
      // A simpler centering approach if the SVG wrapper is absolutely positioned at 50%, 50%:
      setPan({ x: 0, y: 0 }) // Reset pan, assuming the CSS handles centering of the scaled SVG wrapper

      setAutoFit(true)
      setShowControls(true)
    }
  }, [screenSize])

  const handleResetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setAutoFit(true)
    setShowControls(true)
  }, [])

  const handleFullscreen = useCallback(() => {
    onFullscreenChange?.(!isFullscreen)
  }, [isFullscreen, onFullscreenChange])

  const renderChart = useCallback(
    async (chartCode: string, currentTheme: Theme) => {
      const currentRenderId = ++latestRenderIdRef.current
      const internalContainer = containerRef.current

      if (!chartCode || !internalContainer || !isClient) return

      let localWasFixed = false
      let localWasConverted = false

      try {
        setIsRendering(true)
        setError("")

        internalContainer.innerHTML = "" // Clear previous content
        internalContainer.removeAttribute("data-processed")

        const isOldSyntax =
          chartCode.includes("=>") &&
          (chartCode.includes("start:") || chartCode.includes("operation:") || chartCode.includes("condition:"))
        const tempSanitizedCode = sanitizeMermaidCode(chartCode)
        setSanitizedCode(tempSanitizedCode) // Update state for code view

        localWasConverted = isOldSyntax
        localWasFixed = tempSanitizedCode !== chartCode.trim() && !isOldSyntax

        if (latestRenderIdRef.current !== currentRenderId) {
          console.log(`Render ID ${currentRenderId} stale (pre-mermaid), aborting.`)
          return
        }

        if (!tempSanitizedCode) throw new Error("Empty diagram code after sanitization.")

        mermaid.initialize({
          // Re-initialize with current theme
          startOnLoad: false,
          securityLevel: "loose",
          theme: currentTheme,
          logLevel: "error",
          flowchart: {
            useMaxWidth: false,
            htmlLabels: true,
            curve: "basis",
            padding: screenSize === "mobile" ? 10 : 20,
          },
          journey: { useMaxWidth: false },
          sequence: {
            useMaxWidth: false,
            showSequenceNumbers: true,
            wrap: true,
            width: screenSize === "mobile" ? 120 : 150,
          },
          gantt: { useMaxWidth: false },
        })

        let svgOutput: string
        try {
          const result = await mermaid.render(`mermaid-graph-${currentRenderId}`, tempSanitizedCode)
          svgOutput = result.svg
        } catch (renderErr) {
          console.warn("Initial Mermaid render failed, trying simplified:", renderErr)
          const simplified = createSimplifiedDiagram(tempSanitizedCode)
          const result = await mermaid.render(`mermaid-graph-${currentRenderId}-simplified`, simplified)
          svgOutput = result.svg
          localWasFixed = true // Mark as fixed if simplified version was used
        }

        if (latestRenderIdRef.current !== currentRenderId) {
          console.log(`Render ID ${currentRenderId} stale (post-mermaid), aborting DOM update.`)
          return
        }

        const wrapper = document.createElement("div")
        wrapper.innerHTML = svgOutput
        wrapper.style.transformOrigin = "center center"
        wrapper.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)" // Keep transition style
        wrapper.style.width = "fit-content"
        wrapper.style.height = "fit-content"
        wrapper.style.position = "absolute"
        wrapper.style.top = "50%"
        wrapper.style.left = "50%"
        internalContainer.appendChild(wrapper)

        if (autoFit) setTimeout(() => handleFitToScreen(), 100)

        if (localWasFixed || localWasConverted) {
          const successDiv = document.createElement("div")
          let msgText = localWasConverted ? "Converted from old syntax" : "Syntax auto-fixed"
          if (localWasFixed && !localWasConverted && svgOutput.includes("Simplified Diagram")) {
            // Check if simplified was used
            msgText = "Diagram simplified due to errors"
          }
          const bgColor = localWasConverted
            ? "bg-blue-50 text-blue-700"
            : msgText.includes("simplified")
              ? "bg-yellow-50 text-yellow-700"
              : "bg-green-50 text-green-700"

          successDiv.className = `absolute ${screenSize === "mobile" ? "top-2 left-2 right-2" : "top-4 left-4"} ${bgColor} border rounded-lg p-3 flex items-center gap-2 text-sm z-10 shadow-lg`
          successDiv.innerHTML = `<svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg><span>${msgText}</span>`

          internalContainer.appendChild(successDiv)

          if (successMessageTimeoutIdRef.current) clearTimeout(successMessageTimeoutIdRef.current)
          successMessageTimeoutIdRef.current = setTimeout(() => {
            if (containerRef.current && successDiv.parentNode === containerRef.current) {
              // Check parentNode
              try {
                containerRef.current.removeChild(successDiv)
              } catch (e) {
                console.warn("Failed to remove successDiv:", e)
              }
            }
            successMessageTimeoutIdRef.current = null
          }, 5000)
        }
      } catch (err: any) {
        if (latestRenderIdRef.current === currentRenderId) {
          // Only set error if this is the latest render
          console.error("Mermaid rendering process error:", err)
          setError(err.message || "Unknown rendering error")
          // Display error message in container (simplified)
          internalContainer.innerHTML = `<div class="text-red-500 p-4 text-center">Error: ${err.message}</div>`
        }
      } finally {
        if (latestRenderIdRef.current === currentRenderId) {
          setIsRendering(false)
        }
      }
    },
    [isClient, autoFit, handleFitToScreen, screenSize], // Removed interactionMode, selectedElement, isDragging, wasFixed
  )

  useEffect(() => {
    if (isClient && chart) {
      renderChart(chart, theme)
    }
    return () => {
      // Cleanup function
      latestRenderIdRef.current++ // Invalidate ongoing renders
      if (successMessageTimeoutIdRef.current) {
        clearTimeout(successMessageTimeoutIdRef.current)
        successMessageTimeoutIdRef.current = null
      }
      // The container's content will be cleared by the next renderChart call
      // or when the component truly unmounts by React.
    }
  }, [chart, theme, isClient, renderChart])

  useEffect(() => {
    // Effect for zoom/pan transform
    const wrapper = containerRef.current?.querySelector("div")
    if (wrapper) {
      ;(wrapper as HTMLElement).style.transform =
        `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
      ;(wrapper as HTMLElement).style.transition = isDragging ? "none" : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
    }
  }, [zoom, pan, isDragging])

  const handleThemeChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newTheme = event.target.value as Theme
      setTheme(newTheme)
      localStorage.setItem("mermaid-theme", newTheme)
      // renderChart will be called by the useEffect watching `theme`
    },
    [], // No need for chart, renderChart here, effect handles it
  )

  if (!isClient) {
    return <div className="w-full h-64 flex items-center justify-center text-gray-500">Loading diagram...</div>
  }

  // Determine wasFixed/wasConverted based on current state for UI display
  const displayWasConverted = sanitizedCode && isOldFlowchartSyntax(chart) // Check original chart for old syntax
  const displayWasFixed = sanitizedCode && sanitizedCode !== chart.trim() && !displayWasConverted

  return (
    <div className={`w-full h-full relative ${isFullscreen ? "fixed inset-0 z-50 bg-white" : ""}`}>
      {showGrid && (
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
            transform: `translate(${pan.x % 20}px, ${pan.y % 20}px) scale(${zoom})`,
          }}
        />
      )}

      <div
        className={`absolute ${screenSize === "mobile" ? "top-2 right-2" : "top-4 right-4"} z-20 transition-opacity duration-300 ${showControls || controlsExpanded ? "opacity-100" : "opacity-0 hover:opacity-100"}`}
      >
        <div className="bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-gray-200/50 overflow-hidden">
          {!controlsExpanded && (
            <div className={`p-2 flex items-center gap-1 ${screenSize === "mobile" ? "flex-col" : ""}`}>
              <div
                className={`flex items-center gap-1 bg-gray-50 rounded-lg p-1 ${screenSize === "mobile" ? "w-full" : ""}`}
              >
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white disabled:opacity-50"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.1}
                  title="Zoom out"
                >
                  <ZoomOut className="h-3 w-3" />
                </button>
                <div className="px-2 py-1 text-xs font-mono bg-white rounded min-w-[2.5rem] text-center">
                  {Math.round(zoom * 100)}%
                </div>
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white disabled:opacity-50"
                  onClick={handleZoomIn}
                  disabled={zoom >= 5}
                  title="Zoom in"
                >
                  <ZoomIn className="h-3 w-3" />
                </button>
              </div>
              <button
                className={`w-7 h-7 flex items-center justify-center rounded-lg ${interactionMode === "select" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
                onClick={() => setInteractionMode((prev) => (prev === "pan" ? "select" : "pan"))}
                title={interactionMode === "pan" ? "Select mode" : "Pan mode"}
              >
                {interactionMode === "pan" ? <Hand className="h-3 w-3" /> : <MousePointer2 className="h-3 w-3" />}
              </button>
              <button
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
                onClick={handleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                <Icon className="h-3 w-3" as={isFullscreen ? Minimize2 : Maximize2} />
              </button>
              {screenSize !== "mobile" && (
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
                  onClick={() => setControlsExpanded(true)}
                  title="More controls"
                >
                  <Settings className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          {controlsExpanded && (
            <div className={screenSize === "mobile" ? "w-72" : "w-80"}>
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold text-sm">Canvas Controls</h3>
                <button
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100"
                  onClick={() => setControlsExpanded(false)}
                >
                  <Minimize2 className="h-3 w-3" />
                </button>
              </div>
              <div className="flex border-b">
                {[
                  { id: "zoom", label: "View", icon: Navigation },
                  { id: "theme", label: "Theme", icon: Palette },
                  { id: "export", label: "Export", icon: Download },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 text-xs font-medium ${activeTab === tab.id ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:bg-gray-50"}`}
                    onClick={() => setActiveTab(tab.id as any)}
                  >
                    <tab.icon className="h-3 w-3" />
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="p-4">
                {activeTab === "zoom" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-2">Zoom Level</label>
                      <div className="flex items-center gap-2">
                        <button
                          className="w-8 h-8 flex items-center justify-center rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                          onClick={handleZoomOut}
                          disabled={zoom <= 0.1}
                        >
                          <ZoomOut className="h-3 w-3" />
                        </button>
                        <div className="flex-1 bg-gray-100 rounded-lg p-2 text-center">
                          <span className="text-sm font-mono">{Math.round(zoom * 100)}%</span>
                        </div>
                        <button
                          className="w-8 h-8 flex items-center justify-center rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                          onClick={handleZoomIn}
                          disabled={zoom >= 5}
                        >
                          <ZoomIn className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-2">Interaction Mode</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className={`flex items-center justify-center gap-2 p-2 text-xs border rounded-lg ${interactionMode === "pan" ? "bg-blue-50 border-blue-300 text-blue-700" : "hover:bg-gray-50"}`}
                          onClick={() => setInteractionMode("pan")}
                        >
                          <Hand className="h-3 w-3" />
                          Pan
                        </button>
                        <button
                          className={`flex items-center justify-center gap-2 p-2 text-xs border rounded-lg ${interactionMode === "select" ? "bg-blue-50 border-blue-300 text-blue-700" : "hover:bg-gray-50"}`}
                          onClick={() => setInteractionMode("select")}
                        >
                          <MousePointer2 className="h-3 w-3" />
                          Select
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="flex items-center justify-center gap-2 p-2 text-xs border rounded-lg hover:bg-gray-50"
                        onClick={handleFitToScreen}
                      >
                        <Maximize className="h-3 w-3" />
                        Fit Screen
                      </button>
                      <button
                        className="flex items-center justify-center gap-2 p-2 text-xs border rounded-lg hover:bg-gray-50"
                        onClick={handleResetView}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Show Grid</span>
                      <button
                        className={`w-10 h-6 rounded-full ${showGrid ? "bg-blue-600" : "bg-gray-300"}`}
                        onClick={() => setShowGrid(!showGrid)}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full transition-transform ${showGrid ? "translate-x-5" : "translate-x-1"}`}
                        />
                      </button>
                    </div>
                  </div>
                )}
                {activeTab === "theme" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-2">Diagram Theme</label>
                      <select
                        value={theme}
                        onChange={handleThemeChange}
                        className="w-full p-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isRendering}
                      >
                        {Available_Themes.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt.charAt(0).toUpperCase() + opt.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {Available_Themes.map((themeOption) => (
                        <button
                          key={themeOption}
                          className={`p-2 text-xs rounded-lg border ${theme === themeOption ? "border-blue-500 bg-blue-50 text-blue-700" : "hover:border-gray-300"}`}
                          onClick={() => handleThemeChange({ target: { value: themeOption } } as any)}
                        >
                          {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === "export" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-2">Copy</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="flex items-center justify-center gap-2 p-2 text-xs border rounded-lg hover:bg-gray-50"
                          onClick={handleCopyClick}
                          disabled={isRendering}
                        >
                          <Copy className="h-3 w-3" />
                          SVG
                        </button>
                        <button
                          className="flex items-center justify-center gap-2 p-2 text-xs border rounded-lg hover:bg-gray-50"
                          onClick={handleCodeCopy}
                        >
                          <Code className="h-3 w-3" />
                          Code
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-2">Download</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="flex items-center justify-center gap-2 p-2 text-xs border rounded-lg hover:bg-gray-50"
                          onClick={() => handleDownload("svg")}
                          disabled={isRendering}
                        >
                          <Download className="h-3 w-3" />
                          SVG
                        </button>
                        <button
                          className="flex items-center justify-center gap-2 p-2 text-xs border rounded-lg hover:bg-gray-50"
                          onClick={() => handleDownload("png")}
                          disabled={isRendering}
                        >
                          <Download className="h-3 w-3" />
                          PNG
                        </button>
                      </div>
                    </div>
                    <div>
                      <button
                        className={`w-full flex items-center justify-center gap-2 p-2 text-xs border rounded-lg ${displayWasFixed ? "border-green-300 text-green-700 bg-green-50" : displayWasConverted ? "border-blue-300 text-blue-700 bg-blue-50" : "hover:bg-gray-50"}`}
                        onClick={() => setShowCode(!showCode)}
                      >
                        {displayWasFixed ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : displayWasConverted ? (
                          <RefreshCw className="h-3 w-3" />
                        ) : (
                          <Code className="h-3 w-3" />
                        )}
                        {showCode
                          ? "Hide Code"
                          : displayWasFixed
                            ? "Fixed Code"
                            : displayWasConverted
                              ? "Converted Code"
                              : "Show Code"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {!showControls && !isRendering && !error && !controlsExpanded && (
        <div
          className={`absolute ${screenSize === "mobile" ? "bottom-4 left-2 right-2" : "bottom-6 left-6"} z-10 bg-black/80 backdrop-blur-sm text-white text-sm px-4 py-3 rounded-xl opacity-60 hover:opacity-100`}
        >
          <div className="flex items-center gap-3">
            {interactionMode === "pan" ? <Hand className="h-4 w-4" /> : <MousePointer2 className="h-4 w-4" />}
            <span className={screenSize === "mobile" ? "text-xs" : ""}>
              {screenSize === "mobile"
                ? "Pinch/Drag"
                : `${interactionMode === "pan" ? "Scroll/Drag" : "Click/Drag"} • Hover for controls`}
            </span>
          </div>
        </div>
      )}

      {(Math.abs(pan.x) > 10 || Math.abs(pan.y) > 10) && !isDragging && (
        <div
          className={`absolute ${screenSize === "mobile" ? "top-2 left-2" : "top-6 left-6"} z-10 bg-blue-600 text-white text-xs px-3 py-2 rounded-lg shadow-lg`}
        >
          <div className="flex items-center gap-2">
            <Move className="h-3 w-3" />
            <span>
              Pan: {Math.round(pan.x)}, {Math.round(pan.y)}
            </span>
          </div>
        </div>
      )}

      {showCode && (
        <div className="absolute inset-0 bg-gray-900 text-gray-100 p-4 z-30 overflow-auto">
          <div className={`flex ${screenSize === "mobile" ? "flex-col gap-4" : "justify-between items-center"} mb-6`}>
            <div className="flex items-center gap-3">
              <h3 className={`${screenSize === "mobile" ? "text-base" : "text-lg"} font-semibold`}>
                Mermaid Diagram Code
              </h3>
              {displayWasFixed && (
                <span className="px-3 py-1 bg-green-800 text-green-100 rounded-full text-xs">Auto-Fixed</span>
              )}
              {displayWasConverted && (
                <span className="px-3 py-1 bg-blue-800 text-blue-100 rounded-full text-xs">Converted</span>
              )}
            </div>
            <div className={`flex gap-3 ${screenSize === "mobile" ? "w-full" : ""}`}>
              <button
                className={`flex items-center gap-2 px-4 py-2 text-sm border border-gray-700 rounded-lg bg-gray-800 hover:bg-gray-700 ${screenSize === "mobile" ? "flex-1 justify-center" : ""}`}
                onClick={handleCodeCopy}
              >
                <Copy className="h-4 w-4" />
                Copy
              </button>
              <button
                className={`flex items-center gap-2 px-4 py-2 text-sm border border-gray-700 rounded-lg bg-gray-800 hover:bg-gray-700 ${screenSize === "mobile" ? "flex-1 justify-center" : ""}`}
                onClick={() => setShowCode(false)}
              >
                Close
              </button>
            </div>
          </div>
          {(displayWasFixed || displayWasConverted) && (
            <div
              className={`mb-6 p-4 border rounded-lg ${displayWasConverted ? "bg-blue-900 border-blue-700" : "bg-green-900 border-green-700"}`}
            >
              <div className={`text-sm font-medium mb-3 ${displayWasConverted ? "text-blue-100" : "text-green-100"}`}>
                {displayWasConverted ? "Old Syntax Converted:" : "Syntax Issues Fixed:"}
              </div>
              <div className={`text-sm ${displayWasConverted ? "text-blue-200" : "text-green-200"}`}>
                {/* Details */}
              </div>
            </div>
          )}
          <pre
            className={`text-sm font-mono bg-gray-800 p-4 rounded-lg overflow-auto border border-gray-700 ${screenSize === "mobile" ? "text-xs" : ""}`}
          >
            {sanitizedCode || chart}
          </pre>
        </div>
      )}

      <div
        ref={svgContainerRef}
        className={`w-full h-full relative overflow-hidden ${showGrid ? "bg-gray-50" : "bg-white"}`}
        style={{
          cursor:
            interactionMode === "select" ? "crosshair" : zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          minHeight: "300px",
          touchAction: "none",
        }}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => {
          if (!isFullscreen && !isStandalone && !controlsExpanded && screenSize !== "mobile")
            setTimeout(() => setShowControls(false), 3000)
        }}
      >
        <div ref={containerRef} className="w-full h-full relative flex items-center justify-center">
          {isRendering && (
            <div className="flex flex-col items-center gap-4 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className={`${screenSize === "mobile" ? "text-sm" : ""} font-medium`}>Rendering...</span>
              <div className={`${screenSize === "mobile" ? "text-xs" : ""} text-gray-400`}>
                Complex diagrams may take a moment.
              </div>
            </div>
          )}
        </div>
      </div>

      {error && !showCode && (
        <div
          className={`absolute ${screenSize === "mobile" ? "bottom-4 left-2 right-2" : "bottom-6 left-6 right-6"} bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 z-10 shadow-lg`}
        >
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className={`${screenSize === "mobile" ? "text-sm" : ""} font-semibold text-red-800`}>Diagram Error</p>
            <p className={`${screenSize === "mobile" ? "text-xs" : ""} text-red-600 mt-1`}>{error}</p>
            <button
              className={`mt-2 ${screenSize === "mobile" ? "text-xs" : ""} text-red-700 hover:text-red-800 underline`}
              onClick={() => setShowCode(true)}
            >
              View Code
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper Icon component to avoid repetition
const Icon = ({ as: Component, ...props }: { as: React.ElementType; [key: string]: any }) => <Component {...props} />

function createSimplifiedDiagram(originalCode: string): string {
  const lines = originalCode
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (lines.length === 0) return "graph TD\nA[Error] --> B[Empty input]"
  const firstLine = lines[0].toLowerCase()

  if (firstLine.startsWith("sequencediagram")) return "sequenceDiagram\n  A->>B: Request\n  B-->>A: Response"
  if (firstLine.startsWith("graph") || firstLine.startsWith("flowchart")) return "graph TD\n  A --> B"
  if (firstLine.startsWith("journey")) return "journey\n  title Simplified Journey\n  section Task\n    Step: 1: User"
  return `graph TD\n  Error([Original diagram had issues])\n  Error --> Simplified["Using simplified fallback"]`
}

// Helper to check if original chart string used old syntax (used for UI display)
function isOldFlowchartSyntax(code: string): boolean {
  return code.includes("=>") && (code.includes("start:") || code.includes("operation:") || code.includes("condition:"))
}
