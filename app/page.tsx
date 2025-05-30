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
} from "lucide-react"

import { Mermaid } from "@/components/Mermaids"
import { ChatInput } from "@/components/ChatInput"
import { ChatMessage } from "@/components/ChatMessage"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Message } from "@/types/type"
import { parseCodeFromMessage, sanitizeMermaidCode, validateMermaidCode } from "@/lib/utils"

// Example diagrams for different types
const EXAMPLE_DIAGRAMS = {
  flowchart: `graph TD
    A[Start] --> B{User Input?};
    B -- Yes --> C[Process Data];
    C --> D[Display Results];
    B -- No --> E[Show Error];
    D --> F[End];
    E --> F;`,
  sequence: `sequenceDiagram
    actor User
    participant WebServer
    participant APIService
    participant Database
    
    User->>WebServer: Submit login form
    WebServer->>APIService: Validate credentials (username, password)
    activate APIService
    APIService->>Database: Query user record
    activate Database
    Database-->>APIService: User record (or not found)
    deactivate Database
    alt Credentials valid
        APIService-->>WebServer: Authentication success
        WebServer-->>User: Redirect to dashboard
    else Credentials invalid
        APIService-->>WebServer: Authentication failure
        WebServer-->>User: Show error message
    end
    deactivate APIService`,
  journey: `journey
    title Customer Purchase Journey
    section Discovery
      User searches online: 5: User
      Finds product page: 4: User, WebSite
    section Consideration
      Reads reviews: 3: User
      Compares features: 4: User
    section Purchase
      Adds to cart: 5: User, WebSite
      Completes checkout: 5: User, PaymentGateway`,
}

export default function Home() {
  const [draftMessage, setDraftMessage] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])
  const [draftOutputCode, setDraftOutputCode] = useState<string>("")
  const [outputCode, setOutputCode] = useState<string>(EXAMPLE_DIAGRAMS.sequence) // Default to a valid example
  const [isClient, setIsClient] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [chatVisible, setChatVisible] = useState(true)
  const [canvasVisible, setCanvasVisible] = useState(true) // Start with canvas visible if there's default code

  const [error, setError] = useState<string>("")
  const [retryCount, setRetryCount] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [retryAttempts, setRetryAttempts] = useState(0)
  const [retryHistory, setRetryHistory] = useState<string[]>([])
  const [isRetrying, setIsRetrying] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatScrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsClient(true)
    // Optionally set a default diagram on load
    // setOutputCode(EXAMPLE_DIAGRAMS.sequence);
  }, [])

  useEffect(() => {
    if (messagesEndRef.current && chatScrollContainerRef.current) {
      const scrollContainer = chatScrollContainerRef.current
      const isNearBottom =
        scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 100
      if (isNearBottom || messages.length <= 1) {
        // Scroll if near bottom or it's one of the first messages
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
      }
    }
  }, [messages, isLoading, error, draftOutputCode]) // Added draftOutputCode to dependencies

  useEffect(() => {
    if (outputCode && !canvasVisible) {
      setCanvasVisible(true)
    }
  }, [outputCode, canvasVisible])

  const getPanelWidths = () => {
    if (isFullscreen) return { chatWidth: "hidden", canvasWidth: "w-full" }
    if (chatVisible && canvasVisible) return { chatWidth: "w-1/2", canvasWidth: "w-1/2" }
    if (chatVisible) return { chatWidth: "w-full", canvasWidth: "hidden" }
    if (canvasVisible) return { chatWidth: "hidden", canvasWidth: "w-full" }
    setChatVisible(true) // Default fallback
    return { chatWidth: "w-full", canvasWidth: "hidden" }
  }

  const { chatWidth, canvasWidth } = getPanelWidths()

  const generateSummaryAndSuggestions = useCallback(async (code: string) => {
    if (!code.trim()) return
    try {
      const summaryResponse = await fetch("/api/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are an expert diagram analyst..." }, // Keep summary prompt concise
            { role: "user", content: `Analyze this Mermaid diagram and provide summary and suggestions:\n\n${code}` },
          ],
          model: "gpt-3.5-turbo", // Use a fast model for summary
        }),
      })

      if (summaryResponse.ok) {
        const resultText = await summaryResponse.text()
        try {
          const parsed = JSON.parse(resultText) // Ensure parsing the text response
          const summary = parsed.summary || "Diagram analysis complete."
          const suggestions = parsed.suggestions || [
            "Review diagram for clarity.",
            "Consider adding more details.",
            "Check connections.",
          ]
          const summaryMessage: Message = {
            role: "assistant",
            content: `📊 **Diagram Analysis:**\n\n${summary}\n\n💡 **Suggestions for improvement:**\n${suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\n\n*Click any suggestion to apply it.*`,
          }
          setMessages((prev) => [...prev, summaryMessage])
        } catch (parseError) {
          console.error("Failed to parse summary JSON:", parseError, "Raw response:", resultText)
          const fallbackMessage: Message = {
            role: "assistant",
            content: "✅ Diagram generated. Analysis available if needed.",
          }
          setMessages((prev) => [...prev, fallbackMessage])
        }
      }
    } catch (error) {
      console.error("Error generating summary:", error)
    }
  }, [])

  const generateDiagramWithRetry = useCallback(
    async (
      userMessage: string,
      currentMessages: Message[],
      attemptNumber = 0,
      previousErrors: string[] = [],
      isModification = false,
    ): Promise<{ success: boolean; code?: string; error?: string }> => {
      const maxRetries = 3 // Max 3 attempts (0, 1, 2)

      try {
        const diagramType = detectDiagramType(userMessage)
        const response = await fetch("/api/openai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...currentMessages, { role: "user", content: userMessage }],
            model: "gpt-3.5-turbo", // Consider gpt-4 for complex diagrams if available & cost-effective
            retryAttempt: attemptNumber,
            previousErrors,
            currentDiagram: outputCode,
            isModification,
            diagramType,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to parse error response from API" }))
          throw new Error(errorData.error || `API request failed with status ${response.status}`)
        }

        const data = response.body
        if (!data) throw new Error("No response data received.")

        const reader = data.getReader()
        const decoder = new TextDecoder()
        let codeChunk = ""
        setDraftOutputCode("") // Clear previous draft

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true }) // stream: true for proper multi-byte char handling
          codeChunk += chunk
          setDraftOutputCode((prev) => prev + chunk) // Live update draft
        }

        const parsedCode = parseCodeFromMessage(codeChunk)
        const sanitizedCode = sanitizeMermaidCode(parsedCode)
        const validationResult = validateMermaidCode(sanitizedCode)

        if (validationResult.isValid && sanitizedCode.trim() && !sanitizedCode.includes("Error: Invalid Response")) {
          return { success: true, code: sanitizedCode }
        } else {
          const errorMessage = validationResult.errors.join("; ") || "Invalid diagram syntax generated by AI."
          if (attemptNumber < maxRetries - 1) {
            // Corrected retry condition
            console.warn(`Attempt ${attemptNumber + 1} failed: ${errorMessage}. Retrying...`)
            const newErrors = [...previousErrors, errorMessage]
            setRetryHistory(newErrors) // Update history for UI
            setRetryAttempts(attemptNumber + 1) // Update attempts for UI
            await new Promise((resolve) => setTimeout(resolve, 1200 + attemptNumber * 500)) // Exponential backoff
            return generateDiagramWithRetry(userMessage, currentMessages, attemptNumber + 1, newErrors, isModification)
          } else {
            return { success: false, error: `Failed after ${maxRetries} attempts. Last error: ${errorMessage}` }
          }
        }
      } catch (error: any) {
        const errorMessage = error.message || "Unknown error during generation."
        if (attemptNumber < maxRetries - 1) {
          // Corrected retry condition
          console.warn(`Attempt ${attemptNumber + 1} (catch block) failed: ${errorMessage}. Retrying...`)
          const newErrors = [...previousErrors, errorMessage]
          setRetryHistory(newErrors)
          setRetryAttempts(attemptNumber + 1)
          await new Promise((resolve) => setTimeout(resolve, 1200 + attemptNumber * 500))
          return generateDiagramWithRetry(userMessage, currentMessages, attemptNumber + 1, newErrors, isModification)
        } else {
          return { success: false, error: `Failed after ${maxRetries} attempts (catch). Last error: ${errorMessage}` }
        }
      }
    },
    [outputCode], // outputCode is a dependency for modification context
  )

  const handleSubmit = useCallback(
    async (messageContent?: string) => {
      const currentMessage = messageContent || draftMessage
      if (!currentMessage.trim()) return

      const newMessage: Message = { role: "user", content: currentMessage }
      const newMessages = [...messages, newMessage]

      setMessages(newMessages)
      if (!messageContent) setDraftMessage("") // Clear input only if not from suggestion

      setIsLoading(true)
      setIsRetrying(true) // Indicate retry process starts
      setError("")
      setRetryAttempts(0) // Reset for UI
      setRetryHistory([]) // Reset for UI
      setDraftOutputCode("Generating...") // Initial draft message

      const isModificationRequest =
        currentMessage.toLowerCase().includes("add") ||
        currentMessage.toLowerCase().includes("modify") ||
        currentMessage.toLowerCase().includes("change") ||
        currentMessage.toLowerCase().includes("update") ||
        currentMessage.toLowerCase().includes("improve") ||
        currentMessage.toLowerCase().includes("refine") ||
        currentMessage.toLowerCase().includes("enhance")

      try {
        const result = await generateDiagramWithRetry(currentMessage, messages, 0, [], isModificationRequest)

        if (result.success && result.code) {
          setOutputCode(result.code)
          if (retryAttempts > 0) {
            // Check component state for retries
            const successRetryMessage: Message = {
              role: "assistant",
              content: `✅ Diagram generated successfully after ${retryAttempts + 1} attempts!`,
            }
            setMessages((prev) => [...prev, successRetryMessage])
          }
          await generateSummaryAndSuggestions(result.code)
        } else {
          throw new Error(result.error || "Failed to generate valid diagram after all retries.")
        }
      } catch (error: any) {
        console.error("Final generation error:", error)
        const finalErrorMsg = error.message || "An unknown error occurred."
        setError(
          finalErrorMsg +
            (retryHistory.length > 0
              ? `\n\nRetry attempts details:\n${retryHistory.map((e, i) => `Attempt ${i + 1}: ${e}`).join("\n")}`
              : ""),
        )
      } finally {
        setIsLoading(false)
        setIsRetrying(false)
        setDraftOutputCode("") // Clear draft code display
      }
    },
    [draftMessage, messages, generateDiagramWithRetry, generateSummaryAndSuggestions, retryAttempts, retryHistory],
  ) // Added retryAttempts & retryHistory

  const detectDiagramType = (input: string): string | null => {
    const lc = input.toLowerCase()
    if (lc.includes("flow") || lc.includes("process")) return "flowchart"
    if (lc.includes("sequence") || lc.includes("interaction")) return "sequence"
    if (lc.includes("class") || lc.includes("object")) return "class"
    if (lc.includes("journey") || lc.includes("user experience")) return "journey"
    if (lc.includes("gantt") || lc.includes("timeline") || lc.includes("schedule")) return "gantt"
    // Add more types as needed
    return null
  }

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      // Add suggestion as a new user message and submit
      const suggestionMessage: Message = { role: "user", content: `Apply suggestion: "${suggestion}"` }
      setMessages((prev) => [...prev, suggestionMessage])
      handleSubmit(suggestion) // Pass suggestion directly to handleSubmit
    },
    [handleSubmit],
  ) // handleSubmit is now a dependency

  const handleRetry = useCallback(() => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
    if (lastUserMessage) {
      handleSubmit(lastUserMessage.content) // Retry with the last user message
    } else if (draftMessage) {
      handleSubmit(draftMessage) // Or retry with current draft if no history
    }
  }, [messages, draftMessage, handleSubmit])

  const toggleChatVisibility = () => setChatVisible((v) => !v)
  const toggleCanvasVisibility = () => setCanvasVisible((v) => !v)

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <main className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden bg-gray-50">
      {chatVisible && (
        <div
          className={`${chatWidth} transition-all duration-300 ease-in-out border-r flex flex-col bg-white shadow-md`}
        >
          <div className="border-b p-4 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                FlowchartAI
              </span>
              <Badge variant={isLoading ? "destructive" : "default"} className="text-xs">
                {isLoading ? (isRetrying ? `Retrying ${retryAttempts + 1}/3` : "Generating...") : "Ready"}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              {outputCode && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleCanvasVisibility}
                  title={canvasVisible ? "Hide Canvas" : "Show Canvas"}
                  className="h-8 w-8"
                >
                  <EyeOff className={`h-4 w-4 ${!canvasVisible ? "text-gray-400" : ""}`} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleChatVisibility}
                title="Toggle Chat Panel"
                className="h-8 w-8"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div ref={chatScrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 chat-scroll">
            {messages.length === 0 && !isLoading && (
              <div className="text-center py-10">
                <Sparkles className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                <h3 className="font-semibold text-lg">Describe Your Diagram</h3>
                <p className="text-sm text-gray-500">e.g., "User login sequence diagram"</p>
              </div>
            )}
            {messages.map((msg, index) => (
              <ChatMessage
                key={`msg-${index}-${msg.role}`}
                {...msg}
                onSuggestionClick={handleSuggestionClick}
                isLoading={isLoading}
              />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 p-3 bg-blue-50 rounded-md">
                <Clock className="h-4 w-4 animate-spin" />
                <span>
                  {draftOutputCode ||
                    (isRetrying ? `Attempting correction (attempt ${retryAttempts + 1})...` : "AI is thinking...")}
                </span>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 p-3 bg-red-50 rounded-md border border-red-200">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">Error:</p>
                  <pre className="whitespace-pre-wrap text-xs">{error}</pre>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    className="mt-2 text-xs"
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-4 bg-white shrink-0">
            <ChatInput
              messageCotent={draftMessage}
              onChange={setDraftMessage}
              onSubmit={() => handleSubmit()}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}

      {canvasVisible && (
        <div className={`${canvasWidth} transition-all duration-300 ease-in-out flex flex-col bg-gray-100`}>
          <div className="border-b p-4 bg-slate-50 flex items-center justify-between shrink-0">
            <h2 className="font-semibold text-gray-700">Interactive Canvas</h2>
            <div className="flex items-center gap-1">
              {!chatVisible && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleChatVisibility}
                  title="Show Chat"
                  className="h-8 w-8"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCanvasVisibility}
                title="Hide Canvas"
                className="h-8 w-8"
              >
                <PanelRightClose className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden">
            {outputCode || draftOutputCode ? (
              <Mermaid
                chart={outputCode || draftOutputCode}
                isFullscreen={isFullscreen}
                onFullscreenChange={setIsFullscreen}
                isStandalone={!chatVisible}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <Sparkles className="h-8 w-8 mr-2" /> Your diagram will appear here.
              </div>
            )}
          </div>
        </div>
      )}
      {!canvasVisible && outputCode && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            onClick={() => setCanvasVisible(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-full px-5 py-3"
          >
            <Eye className="h-5 w-5 mr-2" /> Show Canvas
          </Button>
        </div>
      )}
    </main>
  )
}
