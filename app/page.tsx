"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Clock,
  Maximize2,
  Minimize2,
} from "lucide-react"

import { Mermaid } from "@/components/Mermaids"
import { ChatInput } from "@/components/ChatInput"
import { ChatMessage } from "@/components/ChatMessage"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Message } from "@/types/type"
import {
  parseCodeFromMessage,
  sanitizeMermaidCode,
  validateMermaidCode,
  generateContextAwareSuggestions,
  detectDiagramTypeFromCode,
} from "@/lib/utils"

// Example diagrams for different types
const EXAMPLE_DIAGRAMS = {
  flowchart: `graph TD
    A[Start] --> B[Process]
    B --> C{Decision}
    C -->|Yes| D[Action 1]
    C -->|No| E[Action 2]
    D --> F[End]
    E --> F`,
  sequence: `sequenceDiagram
    participant User
    participant System
    participant Database
    
    User->>System: Request data
    System->>Database: Query data
    Database-->>System: Return results
    System-->>User: Display results`,
  journey: `journey
    title User Journey
    section Login
      Enter credentials: 3: User
      Validate: 2: System
      Success: 5: User
    section Dashboard
      View data: 4: User
      Interact: 3: User`,
}

export default function Home() {
  const [draftMessage, setDraftMessage] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])
  const [draftOutputCode, setDraftOutputCode] = useState<string>("")
  const [outputCode, setOutputCode] = useState<string>("")
  const [isClient, setIsClient] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Independent window visibility states
  const [chatVisible, setChatVisible] = useState(true)
  const [canvasVisible, setCanvasVisible] = useState(false)

  const [error, setError] = useState<string>("")
  const [retryCount, setRetryCount] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Enhanced retry state
  const [retryAttempts, setRetryAttempts] = useState(0)
  const [retryHistory, setRetryHistory] = useState<string[]>([])
  const [isRetrying, setIsRetrying] = useState(false)

  // Add this after the existing state declarations (around line 60)
  const [currentTheme, setCurrentTheme] = useState<"default" | "neutral" | "dark" | "forest" | "base">("default")
  const [showThemeSelector, setShowThemeSelector] = useState(false)

  // Ref for auto-scrolling chat messages
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatScrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Auto-scroll chat to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current && chatScrollContainerRef.current) {
      const scrollContainer = chatScrollContainerRef.current
      const isNearBottom =
        scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 100

      // Only auto-scroll if user is near the bottom (to not interrupt manual scrolling)
      if (isNearBottom || messages.length === 1) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
      }
    }
  }, [messages, isLoading, error])

  // Show canvas when there's content
  useEffect(() => {
    if (outputCode && !canvasVisible) {
      setCanvasVisible(true)
    }
  }, [outputCode, canvasVisible])

  // Add this useEffect after the existing useEffect hooks (around line 90)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("mermaid-theme")
      if (savedTheme && ["default", "neutral", "dark", "forest", "base"].includes(savedTheme)) {
        setCurrentTheme(savedTheme as any)
      }
    }
  }, [])

  // Add this useEffect after the theme loading useEffect
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showThemeSelector) {
        const target = event.target as Element
        if (!target.closest("[data-theme-selector]")) {
          setShowThemeSelector(false)
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showThemeSelector])

  // Calculate panel widths based on visibility
  const getPanelWidths = () => {
    if (isFullscreen) {
      return { chatWidth: "hidden", canvasWidth: "w-full" }
    }

    if (chatVisible && canvasVisible) {
      return { chatWidth: "w-1/2", canvasWidth: "w-1/2" }
    } else if (chatVisible && !canvasVisible) {
      return { chatWidth: "w-full", canvasWidth: "hidden" }
    } else if (!chatVisible && canvasVisible) {
      return { chatWidth: "hidden", canvasWidth: "w-full" }
    } else {
      // Both hidden - show chat by default
      setChatVisible(true)
      return { chatWidth: "w-full", canvasWidth: "hidden" }
    }
  }

  const { chatWidth, canvasWidth } = getPanelWidths()

  const generateSummaryAndSuggestions = useCallback(async (code: string) => {
    try {
      // First try to get AI-generated suggestions
      const summaryResponse = await fetch("/api/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are an expert diagram analyst. Analyze the given Mermaid diagram and provide: 1) A brief summary of what the diagram shows, 2) Three specific suggestions for improving or expanding the diagram. Format your response as JSON with 'summary' and 'suggestions' (array of strings) fields.",
            },
            {
              role: "user",
              content: `Analyze this Mermaid diagram and provide summary and suggestions:\n\n${code}`,
            },
          ],
          model: "gpt-3.5-turbo",
        }),
      })

      let summary = "Diagram generated successfully"
      let suggestions: string[] = []

      if (summaryResponse.ok) {
        const reader = summaryResponse.body?.getReader()
        const decoder = new TextDecoder()
        let result = ""

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            result += decoder.decode(value)
          }

          try {
            const parsed = JSON.parse(result)
            summary = parsed.summary || summary
            suggestions = parsed.suggestions || []
          } catch {
            // If AI parsing fails, use context-aware suggestions
            console.log("AI suggestions failed, using context-aware fallback")
          }
        }
      }

      // If AI suggestions failed or are empty, use context-aware suggestions
      if (suggestions.length === 0) {
        const diagramType = detectDiagramTypeFromCode(code)
        suggestions = generateContextAwareSuggestions(code, diagramType)
      }

      // Validate suggestions to ensure they're actionable
      const validatedSuggestions = suggestions
        .filter(
          (suggestion) =>
            suggestion.length > 10 &&
            suggestion.length < 100 &&
            !suggestion.toLowerCase().includes("error") &&
            !suggestion.toLowerCase().includes("invalid"),
        )
        .slice(0, 3)

      // Add fallback suggestions if we don't have enough
      if (validatedSuggestions.length < 3) {
        const diagramType = detectDiagramTypeFromCode(code)
        const fallbackSuggestions = generateContextAwareSuggestions(code, diagramType)
        validatedSuggestions.push(...fallbackSuggestions.slice(0, 3 - validatedSuggestions.length))
      }

      // Add summary as AI message
      const summaryMessage: Message = {
        role: "assistant",
        content: `📊 **Diagram Analysis:**\n\n${summary}\n\n💡 **Suggestions for improvement:**\n${validatedSuggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\n\n*Click on any suggestion above to apply it to your diagram.*`,
      }

      setMessages((prev) => [...prev, summaryMessage])
    } catch (error) {
      console.error("Error generating summary:", error)

      // Fallback to context-aware suggestions
      const diagramType = detectDiagramTypeFromCode(code)
      const fallbackSuggestions = generateContextAwareSuggestions(code, diagramType)

      const fallbackMessage: Message = {
        role: "assistant",
        content: `✅ **Diagram generated successfully!**\n\n💡 **Suggestions for improvement:**\n${fallbackSuggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\n\n*Click on any suggestion above to apply it to your diagram.*`,
      }
      setMessages((prev) => [...prev, fallbackMessage])
    }
  }, [])

  // Enhanced diagram generation with automatic retry logic
  const generateDiagramWithRetry = useCallback(
    async (
      userMessage: string,
      currentMessages: Message[],
      attemptNumber = 0,
      previousErrors: string[] = [],
      isModification = false,
    ): Promise<{ success: boolean; code?: string; error?: string }> => {
      const maxRetries = 3

      try {
        // Determine if the user is asking for a specific diagram type
        const diagramType = detectDiagramType(userMessage)

        const response = await fetch("/api/openai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [...currentMessages, { role: "user", content: userMessage }],
            model: "gpt-3.5-turbo",
            retryAttempt: attemptNumber,
            previousErrors: previousErrors,
            currentDiagram: outputCode, // Send current diagram for context
            isModification: isModification,
            diagramType: diagramType,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to generate diagram")
        }

        const data = response.body
        if (!data) {
          throw new Error("No response data received.")
        }

        const reader = data.getReader()
        const decoder = new TextDecoder()
        let done = false
        let code = ""

        while (!done) {
          const { value, done: doneReading } = await reader.read()
          done = doneReading
          const chunkValue = decoder.decode(value)
          code += chunkValue

          // Update draft code for real-time feedback
          if (attemptNumber === 0) {
            setDraftOutputCode((prevCode) => prevCode + chunkValue)
          }
        }

        // Parse and sanitize the code
        const parsedCode = parseCodeFromMessage(code)
        const sanitizedCode = sanitizeMermaidCode(parsedCode)

        // Validate the generated code
        const validationResult = validateMermaidCode(sanitizedCode)

        if (validationResult.isValid && sanitizedCode && !sanitizedCode.includes("Error: Invalid Response")) {
          return { success: true, code: sanitizedCode }
        } else {
          const errorMessage = validationResult.errors.join("; ") || "Invalid diagram syntax generated"

          // If we haven't reached max retries, try again
          if (attemptNumber < maxRetries - 1) {
            console.warn(`Attempt ${attemptNumber + 1} failed: ${errorMessage}. Retrying...`)

            // Add this error to the history
            const newErrors = [...previousErrors, errorMessage]
            setRetryHistory(newErrors)
            setRetryAttempts(attemptNumber + 1)

            // Wait a brief moment before retrying
            await new Promise((resolve) => setTimeout(resolve, 1000))

            return await generateDiagramWithRetry(
              userMessage,
              currentMessages,
              attemptNumber + 1,
              newErrors,
              isModification,
            )
          } else {
            return { success: false, error: `Failed after ${maxRetries} attempts. Last error: ${errorMessage}` }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

        // If we haven't reached max retries, try again
        if (attemptNumber < maxRetries - 1) {
          console.warn(`Attempt ${attemptNumber + 1} failed: ${errorMessage}. Retrying...`)

          const newErrors = [...previousErrors, errorMessage]
          setRetryHistory(newErrors)
          setRetryAttempts(attemptNumber + 1)

          // Wait a brief moment before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000))

          return await generateDiagramWithRetry(
            userMessage,
            currentMessages,
            attemptNumber + 1,
            newErrors,
            isModification,
          )
        } else {
          return { success: false, error: `Failed after ${maxRetries} attempts. Last error: ${errorMessage}` }
        }
      }
    },
    [outputCode],
  )

  const handleSubmit = useCallback(async () => {
    if (!draftMessage.trim()) {
      return
    }

    const newMessage: Message = {
      role: "user",
      content: draftMessage,
    }
    const newMessages = [...messages, newMessage]

    setMessages(newMessages)
    setDraftMessage("")
    setDraftOutputCode("")
    setIsLoading(true)
    setIsRetrying(false)
    setError("")
    setRetryCount(0)
    setRetryAttempts(0)
    setRetryHistory([])

    // Check if this is a modification request
    const isModificationRequest =
      draftMessage.toLowerCase().includes("add") ||
      draftMessage.toLowerCase().includes("modify") ||
      draftMessage.toLowerCase().includes("change") ||
      draftMessage.toLowerCase().includes("update") ||
      draftMessage.toLowerCase().includes("improve") ||
      draftMessage.toLowerCase().includes("refine") ||
      draftMessage.toLowerCase().includes("enhance")

    try {
      setIsRetrying(true)
      const result = await generateDiagramWithRetry(draftMessage, messages, 0, [], isModificationRequest)

      if (result.success && result.code) {
        setOutputCode(result.code)
        setDraftOutputCode("")
        await generateSummaryAndSuggestions(result.code)

        // Add success message if there were retries
        if (retryAttempts > 0) {
          const retryMessage: Message = {
            role: "assistant",
            content: `✅ **Diagram generated successfully after ${retryAttempts + 1} attempts!**\n\nThe system automatically corrected syntax issues to ensure proper rendering.`,
          }
          setMessages((prev) => [...prev, retryMessage])
        }
      } else {
        throw new Error(result.error || "Failed to generate valid diagram")
      }
    } catch (error) {
      console.error("Final generation error:", error)
      setError(error instanceof Error ? error.message : "An error occurred")

      // Show retry history in error message
      if (retryHistory.length > 0) {
        const retryInfo = `\n\nRetry attempts made:\n${retryHistory.map((err, i) => `• Attempt ${i + 1}: ${err}`).join("\n")}`
        setError((prev) => prev + retryInfo)
      }
    } finally {
      setIsLoading(false)
      setIsRetrying(false)
    }
  }, [draftMessage, messages, generateDiagramWithRetry, generateSummaryAndSuggestions, retryAttempts, retryHistory])

  // Function to detect the diagram type from user input
  const detectDiagramType = (input: string): string | null => {
    const lowercaseInput = input.toLowerCase()

    if (lowercaseInput.includes("flow") || lowercaseInput.includes("process")) {
      return "flowchart"
    }
    if (
      lowercaseInput.includes("sequence") ||
      lowercaseInput.includes("interaction") ||
      lowercaseInput.includes("api")
    ) {
      return "sequence"
    }
    if (lowercaseInput.includes("class") || lowercaseInput.includes("object")) {
      return "class"
    }
    if (lowercaseInput.includes("journey") || lowercaseInput.includes("user experience")) {
      return "journey"
    }
    if (
      lowercaseInput.includes("gantt") ||
      lowercaseInput.includes("timeline") ||
      lowercaseInput.includes("schedule")
    ) {
      return "gantt"
    }
    if (lowercaseInput.includes("state") || lowercaseInput.includes("status")) {
      return "state"
    }
    if (lowercaseInput.includes("er") || lowercaseInput.includes("entity") || lowercaseInput.includes("database")) {
      return "er"
    }
    if (lowercaseInput.includes("pie") || lowercaseInput.includes("chart") || lowercaseInput.includes("distribution")) {
      return "pie"
    }

    return null
  }

  const handleSuggestionClick = useCallback(
    async (suggestion: string) => {
      const newMessage: Message = {
        role: "user",
        content: suggestion, // Just show the clean suggestion text to user
      }
      const newMessages = [...messages, newMessage]

      setMessages(newMessages)
      setDraftMessage("")
      setDraftOutputCode("")
      setIsLoading(true)
      setIsRetrying(false)
      setError("")
      setRetryAttempts(0)
      setRetryHistory([])

      try {
        setIsRetrying(true)
        // Pass true for isModification since suggestions are always modifications
        const result = await generateDiagramWithRetry(suggestion, messages, 0, [], true)

        if (result.success && result.code) {
          setOutputCode(result.code)
          setDraftOutputCode("")
          await generateSummaryAndSuggestions(result.code)
        } else {
          throw new Error(result.error || "Failed to generate valid diagram")
        }
      } catch (error) {
        console.error("Suggestion generation error:", error)
        setError(error instanceof Error ? error.message : "An error occurred")
      } finally {
        setIsLoading(false)
        setIsRetrying(false)
      }
    },
    [messages, generateDiagramWithRetry, generateSummaryAndSuggestions],
  )

  const handleRetry = useCallback(() => {
    if (draftMessage) {
      handleSubmit()
    } else if (messages.length > 0) {
      // Retry the last message
      const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
      if (lastUserMessage) {
        setDraftMessage(lastUserMessage.content)
        setTimeout(() => {
          handleSubmit()
        }, 100)
      }
    }
  }, [draftMessage, messages, handleSubmit])

  // Add this after the toggleCanvasVisibility function (around line 450)
  const handleThemeChange = useCallback((newTheme: "default" | "neutral" | "dark" | "forest" | "base") => {
    setCurrentTheme(newTheme)
    setShowThemeSelector(false)
    if (typeof window !== "undefined") {
      localStorage.setItem("mermaid-theme", newTheme)
    }
    // Force a re-render by updating a timestamp or trigger
    setOutputCode((prev) => prev) // This will trigger the Mermaid component to re-render with new theme
  }, [])

  // Toggle functions for independent window control
  const toggleChatVisibility = () => {
    if (chatVisible && canvasVisible) {
      // Both visible - hide chat
      setChatVisible(false)
    } else if (!chatVisible && canvasVisible) {
      // Only canvas visible - show chat
      setChatVisible(true)
    } else if (chatVisible && !canvasVisible) {
      // Only chat visible - show canvas if we have content
      if (outputCode) {
        setCanvasVisible(true)
      }
    }
  }

  const toggleCanvasVisibility = () => {
    if (chatVisible && canvasVisible) {
      // Both visible - hide canvas
      setCanvasVisible(false)
    } else if (chatVisible && !canvasVisible) {
      // Only chat visible - show canvas if we have content
      if (outputCode) {
        setCanvasVisible(true)
      }
    } else if (!chatVisible && canvasVisible) {
      // Only canvas visible - show chat
      setChatVisible(true)
    }
  }

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <main className="flex-1 flex h-[calc(100vh-0rem)] overflow-hidden bg-gray-50">
      {/* Chat Panel */}
      <div
        className={`${chatWidth} transition-all duration-500 ease-in-out border-r border-gray-200 flex flex-col bg-white shadow-lg overflow-hidden`}
      >
        {/* Chat Header - Fixed */}
        <div className="border-b border-gray-200 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between flex-shrink-0 fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                FlowchartAI
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span
                className={`w-2 h-2 rounded-full ${isLoading ? "bg-yellow-500 animate-pulse" : "bg-green-500"}`}
              ></span>
              <span>
                {isLoading ? (isRetrying ? `Retrying... (${retryAttempts + 1}/3)` : "Generating...") : "Ready"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Canvas visibility toggle */}
            {outputCode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCanvasVisibility}
                className="h-8 w-8 p-0 hover:bg-blue-100"
                title={canvasVisible ? "Hide Canvas" : "Show Canvas"}
              >
                {canvasVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            )}

            {/* Chat collapse toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleChatVisibility}
              className="h-8 w-8 p-0 hover:bg-blue-100"
              title="Toggle Chat Panel"
            >
              {chatVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Messages - Scrollable Container */}
        <div
          ref={chatScrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden chat-scroll pt-20"
          style={{
            scrollBehavior: "smooth",
            overscrollBehavior: "contain",
          }}
        >
          {messages.length === 0 ? (
            <div className="p-6 text-center space-y-6 min-h-full flex flex-col justify-center">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center shadow-lg">
                <Sparkles className="h-10 w-10 text-blue-600" />
              </div>
              <div className="space-y-3">
                <h3 className="font-bold text-xl text-gray-800">Create Professional Diagrams</h3>
                <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                  Transform your ideas into beautiful flowcharts, sequence diagrams, and more using the power of AI.
                  Simply describe what you want, and watch it come to life.
                </p>
              </div>

              {/* Example prompts */}
              <div className="space-y-3 pt-4">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Try these examples:</p>
                <div className="space-y-2">
                  {[
                    "Create a user login flowchart",
                    "Design a sequence diagram for API authentication",
                    "Make a class diagram for an e-commerce system",
                    "Build a gantt chart for project timeline",
                  ].map((example, index) => (
                    <button
                      key={index}
                      onClick={() => setDraftMessage(example)}
                      className="block w-full text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-4 py-3 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200"
                      disabled={isLoading}
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2 pt-4">
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                  Auto-Retry
                </Badge>
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                  Error Correction
                </Badge>
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                  Valid Syntax
                </Badge>
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {messages.map((message, index) => (
                <ChatMessage
                  key={`${message.content}-${index}`}
                  message={message.content}
                  role={message.role}
                  onSuggestionClick={handleSuggestionClick}
                  isLoading={isLoading}
                />
              ))}
              {isLoading && (
                <div className="flex items-center gap-3 text-gray-600 p-4 bg-blue-50 rounded-lg">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {isRetrying ? `Generating diagram (Attempt ${retryAttempts + 1}/3)` : "Generating diagram..."}
                      </span>
                      {isRetrying && <Clock className="h-4 w-4 text-blue-600" />}
                    </div>
                    {draftOutputCode && (
                      <div className="mt-2 text-xs text-gray-500">Received {draftOutputCode.length} characters...</div>
                    )}
                    {isRetrying && retryHistory.length > 0 && (
                      <div className="mt-2 text-xs text-blue-600">
                        Auto-correcting syntax issues from previous attempts...
                      </div>
                    )}
                  </div>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-3 text-red-600 p-4 bg-red-50 rounded-lg border border-red-200">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{error}</span>
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetry}
                        className="text-xs flex items-center gap-2 hover:bg-red-100"
                        disabled={isLoading}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Try Again
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {/* Invisible element for auto-scrolling */}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          )}
        </div>

        {/* Input - Fixed at bottom */}
        <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
          <ChatInput
            messageCotent={draftMessage}
            onChange={setDraftMessage}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Canvas Panel - Only show when there's content and visible */}
      {canvasVisible && (
        <div
          className={`${canvasWidth} transition-all duration-500 ease-in-out flex flex-col bg-gray-50 shadow-lg overflow-hidden`}
        >
          {/* Canvas Header - Fixed */}
          <div className="border-b border-gray-200 p-3 bg-gradient-to-r from-gray-50 to-slate-50 flex items-center justify-between flex-shrink-0 fixed top-0 left-1/2 right-0 z-20 bg-white/95 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-lg text-gray-800">Interactive Canvas</h2>
              {outputCode && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                    Valid Syntax
                  </Badge>
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                    Context-Aware
                  </Badge>
                </div>
              )}
            </div>

            {/* Canvas Controls - Pass handlers to Mermaid component */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 px-1">
              {/* We'll keep the UI elements but connect them to the Mermaid component via props */}
              {outputCode && (
                <>
                  {/* Panel Controls */}
                  <div className="flex items-center gap-1 bg-white/80 rounded-lg border border-gray-200 px-1 py-1">
                    <button
                      className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                      {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                    </button>
                    <button
                      className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                      onClick={toggleCanvasVisibility}
                      title="Hide Canvas"
                    >
                      <PanelRightClose className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Theme Selector */}
                  <div className="relative" data-theme-selector>
                    <button
                      className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded bg-white/80 hover:bg-gray-50 transition-colors"
                      onClick={() => setShowThemeSelector(!showThemeSelector)}
                      title="Change Theme"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4z"
                        />
                      </svg>
                      <span>{currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)}</span>
                      <svg
                        className={`h-3 w-3 transition-transform ${showThemeSelector ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showThemeSelector && (
                      <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-48">
                        {["default", "neutral", "dark", "forest", "base"].map((theme) => (
                          <button
                            key={theme}
                            className={`w-full flex items-center gap-3 p-3 text-xs hover:bg-gray-50 transition-colors ${
                              currentTheme === theme ? "bg-blue-50 text-blue-700" : ""
                            }`}
                            onClick={() => handleThemeChange(theme as any)}
                          >
                            <div
                              className={`w-4 h-4 rounded border-2 ${
                                theme === "dark"
                                  ? "bg-gray-900 border-gray-600"
                                  : theme === "forest"
                                    ? "bg-green-50 border-green-300"
                                    : theme === "neutral"
                                      ? "bg-gray-50 border-gray-300"
                                      : theme === "base"
                                        ? "bg-slate-100 border-slate-300"
                                        : "bg-white border-gray-300"
                              }`}
                            />
                            <div className="flex-1 text-left">
                              <div className="font-medium">{theme.charAt(0).toUpperCase() + theme.slice(1)}</div>
                            </div>
                            {currentTheme === theme && (
                              <svg className="h-3 w-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Fullscreen Toggle */}
                  <button
                    className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded bg-white/80 hover:bg-gray-50 transition-colors"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                    <span>{isFullscreen ? "Exit" : "Full"}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Canvas Content - Fixed height, no scrolling */}
          <div className="flex-1 relative overflow-hidden h-full pt-20">
            {outputCode ? (
              <Mermaid
                chart={outputCode}
                isFullscreen={isFullscreen}
                onFullscreenChange={setIsFullscreen}
                isStandalone={!chatVisible}
                toggleChatVisibility={toggleChatVisibility}
                toggleCanvasVisibility={toggleCanvasVisibility}
                chatVisible={chatVisible}
                theme={currentTheme}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                    <Sparkles className="h-10 w-10 text-gray-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">Your diagram will appear here</h3>
                    <p className="text-sm text-gray-600">Describe the diagram you want to create in natural language</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Show canvas button when hidden but has content */}
      {!canvasVisible && outputCode && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            onClick={() => setCanvasVisible(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 px-4 py-2 rounded-full"
          >
            <Eye className="h-4 w-4 mr-2" />
            Show Canvas
          </Button>
        </div>
      )}
    </main>
  )
}
