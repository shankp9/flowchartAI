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
  Minimize2,
  RotateCcw,
  Maximize,
  MousePointer2,
  Hand,
  Move,
  Palette,
  FileImage,
  ChevronDown,
  EyeOff,
  Eye,
  PanelRightClose,
} from "lucide-react"
import type { Theme } from "@/types/type"
import { sanitizeMermaidCode } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface MermaidProps {
  chart: string
  isFullscreen?: boolean
  onFullscreenChange?: (fullscreen: boolean) => void
  isStandalone?: boolean
  outputCode?: boolean
  toggleChatVisibility?: () => void
  toggleCanvasVisibility?: () => void
  chatVisible?: boolean
  theme?: Theme
}

const Available_Themes: Theme[] = ["default", "neutral", "dark", "forest", "base"]

const ThemeConfigs = {
  default: {
    name: "Default",
    canvasBackground: "bg-white",
    description: "Clean white background",
  },
  neutral: {
    name: "Neutral",
    canvasBackground: "bg-gray-50",
    description: "Soft gray background",
  },
  dark: {
    name: "Dark",
    canvasBackground: "bg-gray-900",
    description: "Dark theme for low light",
  },
  forest: {
    name: "Forest",
    canvasBackground: "bg-green-50",
    description: "Nature-inspired green tones",
  },
  base: {
    name: "Base",
    canvasBackground: "bg-slate-100",
    description: "Minimal slate background",
  },
}

export function Mermaid({
  chart,
  isFullscreen = false,
  onFullscreenChange,
  isStandalone = false,
  outputCode = false,
  toggleChatVisibility = () => {},
  toggleCanvasVisibility = () => {},
  chatVisible = false,
  theme: propTheme,
}: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState<string>("Copy SVG")
  const [theme, setTheme] = useState<Theme>(propTheme || "default")
  const [isClient, setIsClient] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [error, setError] = useState<string>("")
  const [showCode, setShowCode] = useState(false)
  const [sanitizedCode, setSanitizedCode] = useState("")
  const [wasFixed, setWasFixed] = useState(false)
  const [wasConverted, setWasConverted] = useState(false)
  const [showGrid, setShowGrid] = useState(false)

  // Enhanced zoom and pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showControls, setShowControls] = useState(isFullscreen)
  const [autoFit, setAutoFit] = useState(true)

  const [isElementDragging, setIsElementDragging] = useState(false)
  const [selectedElement, setSelectedElement] = useState<Element | null>(null)
  const [interactionMode, setInteractionMode] = useState<"pan" | "select">("pan")

  const [showThemeSelector, setShowThemeSelector] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const [screenSize, setScreenSize] = useState<"mobile" | "tablet" | "desktop">("desktop")

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true)
    const savedTheme = localStorage.getItem("mermaid-theme")
    if (savedTheme && Available_Themes.includes(savedTheme as Theme)) {
      setTheme(savedTheme as Theme)
    }

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

    // Initialize mermaid for v11.6.0
    try {
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
        sequence: {
          useMaxWidth: false,
          showSequenceNumbers: true,
          wrap: true,
          width: screenSize === "mobile" ? 120 : 150,
        },
        gantt: {
          useMaxWidth: false,
        },
        // v11.6.0 specific configurations
        mindmap: {
          useMaxWidth: false,
        },
        timeline: {
          useMaxWidth: false,
        },
        sankey: {
          useMaxWidth: false,
        },
        c4: {
          useMaxWidth: false,
          diagramPadding: 20,
        },
      })
    } catch (error) {
      console.warn("Mermaid initialization error:", error)
    }

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  // Auto-adjust controls visibility
  useEffect(() => {
    setShowControls(isFullscreen)
  }, [isFullscreen])

  // Enhanced mouse and touch interactions
  useEffect(() => {
    const container = svgContainerRef.current
    if (!container) return

    let lastTouchDistance = 0
    let lastTouchCenter = { x: 0, y: 0 }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const zoomSensitivity = screenSize === "mobile" ? 0.015 : 0.03
      const delta = e.deltaY > 0 ? -zoomSensitivity : zoomSensitivity

      const rect = container.getBoundingClientRect()
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
      const target = e.target as Element

      if (target.closest("g[class*='node'], g[class*='edgePath'], g[class*='actor'], g[class*='rect']")) {
        if (interactionMode === "select") {
          setSelectedElement(target.closest("g") as Element)
          setIsElementDragging(true)
          e.stopPropagation()
          return
        }
      }

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

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()

      if (e.touches.length === 1) {
        const touch = e.touches[0]
        setIsDragging(true)
        setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y })
      } else if (e.touches.length === 2) {
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
      }
    }

    const handleTouchEnd = () => {
      setIsDragging(false)
      setIsElementDragging(false)
      lastTouchDistance = 0
    }

    container.addEventListener("wheel", handleWheel, { passive: false, capture: true })
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

  const handleDownload = useCallback(
    async (format: "svg" | "png" | "jpeg" = "svg") => {
      const container = containerRef.current
      if (!container) return

      setIsDownloading(true)
      setShowDownloadMenu(false)

      try {
        const svgElement = container.querySelector("svg")
        if (!svgElement) {
          throw new Error("No SVG element found")
        }

        if (format === "svg") {
          const svgData = svgElement.outerHTML
          const blob = new Blob([svgData], { type: "image/svg+xml" })
          const url = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = url
          link.download = `diagram.${format}`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        } else {
          const canvas = document.createElement("canvas")
          const ctx = canvas.getContext("2d")
          if (!ctx) throw new Error("Could not get canvas context")

          const img = new Image()

          await new Promise((resolve, reject) => {
            img.onload = () => {
              const scale = window.devicePixelRatio || 1
              canvas.width = img.width * scale
              canvas.height = img.height * scale
              canvas.style.width = img.width + "px"
              canvas.style.height = img.height + "px"

              ctx.scale(scale, scale)

              if (format === "jpeg") {
                const bgColor = theme === "dark" ? "#1f2937" : "#ffffff"
                ctx.fillStyle = bgColor
                ctx.fillRect(0, 0, img.width, img.height)
              }

              ctx.drawImage(img, 0, 0)
              resolve(null)
            }

            img.onerror = reject
            img.crossOrigin = "anonymous"

            const svgData = svgElement.outerHTML
            const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
            const svgUrl = URL.createObjectURL(svgBlob)
            img.src = svgUrl
          })

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob)
                const link = document.createElement("a")
                link.href = url
                link.download = `diagram.${format}`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
              }
            },
            `image/${format}`,
            format === "jpeg" ? 0.95 : 1.0,
          )
        }
      } catch (error) {
        console.error("Download failed:", error)
        setLabel("Download failed")
        setTimeout(() => setLabel("Copy SVG"), 3000)
      } finally {
        setIsDownloading(false)
      }
    },
    [theme],
  )

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

        // Enhanced DOM cleanup
        const safeCleanContainer = () => {
          try {
            while (container.firstChild) {
              try {
                container.removeChild(container.firstChild)
              } catch (e) {
                container.innerHTML = ""
                break
              }
            }
            if (container.children.length > 0) {
              container.innerHTML = ""
            }
          } catch (e) {
            console.warn("Error during container cleanup:", e)
            try {
              container.innerHTML = ""
            } catch (innerError) {
              console.warn("Fallback cleanup also failed:", innerError)
            }
          }
        }

        safeCleanContainer()
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
          // Initialize mermaid with the selected theme for v11.6.0
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
            sequence: {
              useMaxWidth: false,
              showSequenceNumbers: true,
              wrap: true,
              width: screenSize === "mobile" ? 120 : 150,
            },
            gantt: {
              useMaxWidth: false,
            },
            er: {
              useMaxWidth: false,
            },
            gitGraph: {
              useMaxWidth: false,
            },
            class: {
              useMaxWidth: false,
            },
            state: {
              useMaxWidth: false,
            },
            pie: {
              useMaxWidth: false,
            },
            requirement: {
              useMaxWidth: false,
            },
            // v11.6.0 specific configurations
            mindmap: {
              useMaxWidth: false,
            },
            timeline: {
              useMaxWidth: false,
            },
            sankey: {
              useMaxWidth: false,
            },
            c4: {
              useMaxWidth: false,
              diagramPadding: 20,
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
            try {
              const simplifiedResult = await mermaid.render(id + "_simplified", simplifiedCode)
              svg = simplifiedResult.svg
              setWasFixed(true)
            } catch (simplifiedError) {
              throw new Error(`Rendering failed: ${simplifiedError}`)
            }
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

          const svgElement = wrapper.querySelector("svg")
          if (svgElement) {
            svgElement.style.userSelect = "none"
            svgElement.style.pointerEvents = "auto"

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
            if (container && container.parentNode && document.contains(container)) {
              container.appendChild(wrapper)
            } else {
              console.warn("Container is not in DOM, skipping append")
            }
          } catch (e) {
            console.error("Error appending wrapper:", e)
            try {
              safeCleanContainer()
              if (container && container.parentNode && document.contains(container)) {
                container.appendChild(wrapper)
              }
            } catch (innerError) {
              console.error("Failed to append after cleanup:", innerError)
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
              if (container && document.contains(container)) {
                container.appendChild(successDiv)
                setTimeout(() => {
                  try {
                    if (container && container.contains(successDiv)) {
                      container.removeChild(successDiv)
                    }
                  } catch (e) {
                    console.warn("Error removing success message:", e)
                  }
                }, 5000)
              }
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

          if (
            errorMessage.includes("Parse error") ||
            errorMessage.includes("Expecting") ||
            errorMessage.includes("Syntax error")
          ) {
            errorContent += `
              <div class="text-xs text-gray-600 mb-6 p-4 bg-gray-50 rounded-lg">
                <strong class="block mb-2">Common fixes for Mermaid v11.6.0:</strong>
                • Check diagram type declaration (graph TD, sequenceDiagram, etc.)<br>
                • Ensure proper spacing between elements<br>
                • Check for missing or extra characters<br>
                • Verify all brackets and quotes are properly closed<br>
                • Escape special characters (&lt;, &gt;, &amp;) in labels<br>
                • Try simplifying complex parts of your diagram
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
            safeCleanContainer()
            if (container && document.contains(container)) {
              container.appendChild(errorDiv)
            }
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
      const timeoutId = setTimeout(() => {
        renderChart(chart, theme)
      }, 100)

      return () => {
        clearTimeout(timeoutId)
      }
    }

    return () => {
      const container = containerRef.current
      if (container) {
        try {
          while (container.firstChild) {
            try {
              container.removeChild(container.firstChild)
            } catch (e) {
              container.innerHTML = ""
              break
            }
          }
        } catch (e) {
          console.warn("Error cleaning up container:", e)
        }
      }
    }
  }, [chart, theme, isClient, renderChart])

  useEffect(() => {
    if (propTheme && propTheme !== theme) {
      setTheme(propTheme)
    }
  }, [propTheme, theme])

  const handleThemeChange = useCallback(
    async (newTheme: Theme) => {
      if (newTheme === theme) return

      setTheme(newTheme)
      setShowThemeSelector(false)

      if (isClient) {
        localStorage.setItem("mermaid-theme", newTheme)
        if (chart) {
          await new Promise((resolve) => setTimeout(resolve, 50))
          await renderChart(chart, newTheme)
        }
      }
    },
    [isClient, chart, renderChart, theme],
  )

  if (!isClient) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="text-gray-500">Loading diagram...</div>
      </div>
    )
  }

  const currentThemeConfig = ThemeConfigs[theme]

  return (
    <div
      className={`w-full h-full relative ${isFullscreen ? "fixed inset-0 z-50 bg-white" : ""}`}
      style={{ isolation: "isolate" }}
    >
      {/* Enhanced Canvas Header with All Controls - Fixed */}
      <div className="border-b border-gray-200 p-4 bg-gradient-to-r from-gray-50 to-slate-50 flex items-center justify-between flex-shrink-0 fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-lg text-gray-800">Interactive Canvas</h2>
          {outputCode && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                Mermaid v11.6.0
              </Badge>
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                Syntax Safe
              </Badge>
            </div>
          )}
        </div>

        {/* All Canvas Controls in Header */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-white/80 rounded-lg border border-gray-200 px-2 py-1">
            <button
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
              onClick={handleZoomOut}
              disabled={zoom <= 0.1}
              title="Zoom Out"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <div className="bg-gray-100 rounded px-2 py-1 text-center min-w-12">
              <span className="text-xs font-mono">{Math.round(zoom * 100)}%</span>
            </div>
            <button
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
              onClick={handleZoomIn}
              disabled={zoom >= 5}
              title="Zoom In"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>

          {/* View Controls */}
          <div className="flex items-center gap-1 bg-white/80 rounded-lg border border-gray-200 px-2 py-1">
            <button
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 transition-colors"
              onClick={handleFitToScreen}
              title="Fit to Screen"
            >
              <Maximize className="h-3 w-3" />
            </button>
            <button
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 transition-colors"
              onClick={handleResetView}
              title="Reset View"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>

          {/* Interaction Mode */}
          <div className="flex items-center gap-1 bg-white/80 rounded-lg border border-gray-200 px-1 py-1">
            <button
              className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                interactionMode === "pan" ? "bg-blue-50 border border-blue-200 text-blue-700" : "hover:bg-gray-50"
              }`}
              onClick={() => setInteractionMode("pan")}
              title="Pan Mode"
            >
              <Hand className="h-3 w-3" />
            </button>
            <button
              className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                interactionMode === "select" ? "bg-blue-50 border border-blue-200 text-blue-700" : "hover:bg-gray-50"
              }`}
              onClick={() => setInteractionMode("select")}
              title="Select Mode"
            >
              <MousePointer2 className="h-3 w-3" />
            </button>
          </div>

          {/* Theme Selector */}
          <div className="relative">
            <button
              className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded bg-white/80 hover:bg-gray-50 transition-colors"
              onClick={() => setShowThemeSelector(!showThemeSelector)}
              title="Change Theme"
            >
              <Palette className="h-3 w-3" />
              <span>{ThemeConfigs[theme].name}</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${showThemeSelector ? "rotate-180" : ""}`} />
            </button>

            {showThemeSelector && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto min-w-48">
                {Available_Themes.map((themeOption) => {
                  const themeConfig = ThemeConfigs[themeOption]
                  return (
                    <button
                      key={themeOption}
                      className={`w-full flex items-center gap-3 p-3 text-xs hover:bg-gray-50 transition-colors ${
                        theme === themeOption ? "bg-blue-50 text-blue-700" : ""
                      }`}
                      onClick={() => handleThemeChange(themeOption)}
                    >
                      <div
                        className={`w-4 h-4 rounded border-2 ${themeConfig.canvasBackground} ${
                          themeOption === "dark" ? "border-gray-600" : "border-gray-300"
                        }`}
                      />
                      <div className="flex-1 text-left">
                        <div className="font-medium">{themeConfig.name}</div>
                        <div className="text-gray-500">{themeConfig.description}</div>
                      </div>
                      {theme === themeOption && <CheckCircle className="h-3 w-3 text-blue-600" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Download Options */}
          <div className="relative">
            <button
              className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded bg-white/80 hover:bg-gray-50 transition-colors"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              disabled={isRendering || isDownloading}
              title="Download Options"
            >
              <FileImage className="h-3 w-3" />
              <span>{isDownloading ? "Downloading..." : "Download"}</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${showDownloadMenu ? "rotate-180" : ""}`} />
            </button>

            {showDownloadMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-48">
                <button
                  className="w-full flex items-center gap-3 p-3 text-xs hover:bg-gray-50 transition-colors"
                  onClick={() => handleDownload("svg")}
                  disabled={isDownloading}
                >
                  <div className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center">
                    <span className="text-blue-600 text-xs font-bold">S</span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">SVG Vector</div>
                    <div className="text-gray-500">Scalable, small file</div>
                  </div>
                </button>
                <button
                  className="w-full flex items-center gap-3 p-3 text-xs hover:bg-gray-50 transition-colors"
                  onClick={() => handleDownload("png")}
                  disabled={isDownloading}
                >
                  <div className="w-4 h-4 bg-green-100 rounded flex items-center justify-center">
                    <span className="text-green-600 text-xs font-bold">P</span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">PNG Image</div>
                    <div className="text-gray-500">Transparent background</div>
                  </div>
                </button>
                <button
                  className="w-full flex items-center gap-3 p-3 text-xs hover:bg-gray-50 transition-colors rounded-b-lg"
                  onClick={() => handleDownload("jpeg")}
                  disabled={isDownloading}
                >
                  <div className="w-4 h-4 bg-orange-100 rounded flex items-center justify-center">
                    <span className="text-orange-600 text-xs font-bold">J</span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">JPEG Image</div>
                    <div className="text-gray-500">Solid background</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Copy Button */}
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded bg-white/80 hover:bg-gray-50 transition-colors"
            onClick={handleCopyClick}
            disabled={isRendering}
            title="Copy SVG to Clipboard"
          >
            <Copy className="h-3 w-3" />
            <span>{label}</span>
          </button>

          {/* Code Toggle */}
          <button
            className={`flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded transition-colors ${
              wasFixed
                ? "bg-green-50 border-green-200 text-green-700"
                : wasConverted
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white/80 hover:bg-gray-50"
            }`}
            onClick={() => setShowCode(!showCode)}
            title={
              showCode ? "Hide Code" : wasFixed ? "Show Fixed Code" : wasConverted ? "Show Converted Code" : "Show Code"
            }
          >
            {wasFixed ? (
              <CheckCircle className="h-3 w-3" />
            ) : wasConverted ? (
              <RefreshCw className="h-3 w-3" />
            ) : (
              <Code className="h-3 w-3" />
            )}
            <span>Code</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded bg-white/80 hover:bg-gray-50 transition-colors"
            onClick={handleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
          </button>

          {/* Chat visibility toggle */}
          <button
            className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 transition-colors"
            onClick={toggleChatVisibility}
            title={chatVisible ? "Hide Chat" : "Show Chat"}
          >
            {chatVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>

          {/* Canvas collapse toggle */}
          <button
            className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 transition-colors"
            onClick={toggleCanvasVisibility}
            title="Hide Canvas"
          >
            <PanelRightClose className="h-3 w-3" />
          </button>
        </div>
      </div>

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

      {/* Pan Indicator */}
      {(Math.abs(pan.x) > 10 || Math.abs(pan.y) > 10) && (
        <div className={`absolute ${screenSize === "mobile" ? "top-2 left-2" : "top-4 left-4"} z-20`}>
          <div className="bg-white/95 rounded-lg shadow-lg border border-gray-200/50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Move className="h-3 w-3" />
              <span className="font-mono">
                {Math.round(pan.x)}, {Math.round(pan.y)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Code View */}
      {showCode && (
        <div className="absolute inset-0 bg-gray-900 text-gray-100 p-4 z-30 overflow-auto">
          <div className={`flex ${screenSize === "mobile" ? "flex-col gap-4" : "justify-between items-center"} mb-6`}>
            <div className="flex items-center gap-3">
              <h3 className={`${screenSize === "mobile" ? "text-base" : "text-lg"} font-semibold`}>
                Mermaid Diagram Code (v11.6.0)
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
                {wasConverted ? "Old Flowchart Syntax Converted:" : "Syntax Issues Fixed for v11.6.0:"}
              </div>
              <div className={`text-sm ${wasConverted ? "text-blue-200" : "text-green-200"}`}>
                {wasConverted ? (
                  <>
                    • Converted old flowchart.js syntax to Mermaid format
                    <br />• Transformed node definitions (start, operation, condition, end)
                    <br />• Fixed connection syntax and arrow formats
                    <br />• Applied v11.6.0 compatibility enhancements
                  </>
                ) : (
                  <>
                    • Fixed missing connections and syntax errors
                    <br />• Ensured proper Mermaid v11.6.0 syntax compliance
                    <br />• Escaped special characters in labels (&lt;, &gt;, &amp;)
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

      {/* Main Canvas Container with Theme-based Background */}
      <div
        ref={svgContainerRef}
        className={`w-full h-full relative overflow-hidden transition-colors duration-300 ${
          showGrid
            ? theme === "dark"
              ? "bg-gray-800"
              : currentThemeConfig.canvasBackground
            : currentThemeConfig.canvasBackground
        }`}
        style={{
          cursor:
            interactionMode === "select" ? "crosshair" : zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          minHeight: "300px",
          touchAction: "none",
          position: "relative",
          isolation: "isolate",
        }}
      >
        <div
          ref={containerRef}
          className="w-full h-full relative flex items-center justify-center"
          style={{
            position: "relative",
            overflow: "hidden",
            isolation: "isolate",
          }}
        >
          {isRendering && (
            <div className="flex flex-col items-center gap-4 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className={`${screenSize === "mobile" ? "text-sm" : "text-sm"} font-medium`}>
                Rendering diagram with Mermaid v11.6.0...
              </span>
              <div className={`${screenSize === "mobile" ? "text-xs" : "text-xs"} text-gray-400`}>
                Enhanced syntax validation and error prevention
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
              Mermaid v11.6.0 Rendering Error
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
  } else if (firstLine.startsWith("mindmap")) {
    return `mindmap
  root((Main Topic))
    A[Subtopic 1]
    B[Subtopic 2]`
  } else if (firstLine.startsWith("timeline")) {
    return `timeline
    title Timeline
    2023 : Event 1
    2024 : Event 2`
  } else {
    return `graph TD
    A[Simplified Diagram] --> B[Original syntax had errors]
    B --> C[Please check the code and try again]
    style A fill:#ffcccc
    style B fill:#ffffcc
    style C fill:#ccffcc`
  }
}
