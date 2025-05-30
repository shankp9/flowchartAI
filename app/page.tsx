"use client"

import { useEffect, useState, useCallback } from "react"
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react"

import { Mermaid } from "@/components/Mermaids"
import { ChatInput } from "@/components/ChatInput"
import { ChatMessage } from "@/components/ChatMessage"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Message } from "@/types/type"
import { parseCodeFromMessage, sanitizeMermaidCode } from "@/lib/utils"

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

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Show canvas when there's content
  useEffect(() => {
    if (outputCode && !canvasVisible) {
      setCanvasVisible(true)
    }
  }, [outputCode, canvasVisible])

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
            const summary = parsed.summary || "Diagram generated successfully"
            const suggestions = parsed.suggestions || [
              "Add more detail to the process steps",
              "Include error handling paths",
              "Add decision points for better flow control",
            ]

            // Add summary as AI message
            const summaryMessage: Message = {
              role: "assistant",
              content: `📊 **Diagram Analysis:**\n\n${summary}\n\n💡 **Suggestions for improvement:**\n${suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\n\n*Click on any suggestion above to apply it to your diagram.*`,
            }

            setMessages((prev) => [...prev, summaryMessage])
          } catch {
            const fallbackMessage: Message = {
              role: "assistant",
              content: "✅ Diagram generated successfully! The diagram looks good and follows proper syntax.",
            }
            setMessages((prev) => [...prev, fallbackMessage])
          }
        }
      }
    } catch (error) {
      console.error("Error generating summary:", error)
    }
  }, [])

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
    setError("")
    setRetryCount(0)

    // Determine if the user is asking for a specific diagram type
    const diagramType = detectDiagramType(draftMessage)
    let promptContent = draftMessage

    // Get current diagram for context if this seems like a modification request
    const isModificationRequest =
      draftMessage.toLowerCase().includes("add") ||
      draftMessage.toLowerCase().includes("modify") ||
      draftMessage.toLowerCase().includes("change") ||
      draftMessage.toLowerCase().includes("update") ||
      draftMessage.toLowerCase().includes("improve")

    if (isModificationRequest && outputCode) {
      promptContent = `${draftMessage}

Current diagram:
\`\`\`mermaid
${outputCode}
\`\`\`

Please modify this diagram according to the request while maintaining proper Mermaid syntax.`
    } else if (diagramType) {
      promptContent = `Create a ${diagramType} diagram for: ${draftMessage}. Use proper Mermaid syntax for ${diagramType} diagrams.`
    }

    // Create the message with enhanced prompt
    const enhancedMessage: Message = {
      role: "user",
      content: promptContent,
    }

    try {
      const response = await fetch("/api/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, enhancedMessage],
          model: "gpt-3.5-turbo",
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
        setDraftOutputCode((prevCode) => prevCode + chunkValue)
      }

      // Parse and sanitize the code
      const parsedCode = parseCodeFromMessage(code)
      const sanitizedCode = sanitizeMermaidCode(parsedCode)

      if (sanitizedCode && !sanitizedCode.includes("Error: Invalid Response")) {
        setOutputCode(sanitizedCode)
        // Clear draft code after setting final code
        setDraftOutputCode("")
        // Generate summary and suggestions
        await generateSummaryAndSuggestions(sanitizedCode)
      } else {
        throw new Error("Invalid diagram syntax received")
      }
    } catch (error) {
      console.error("Request error:", error)
      setError(error instanceof Error ? error.message : "An error occurred")

      // Enhanced retry logic with better prompts
      if (retryCount === 0) {
        setRetryCount(1)
        const fallbackType = diagramType || "flowchart"

        const retryMessage: Message = {
          role: "user",
          content: `Create a simple ${fallbackType} diagram for: ${draftMessage}. 
        
Use this exact syntax pattern:
${EXAMPLE_DIAGRAMS[fallbackType as keyof typeof EXAMPLE_DIAGRAMS] || EXAMPLE_DIAGRAMS.flowchart}

Replace the content with elements relevant to my request, but keep the exact same syntax structure.`,
        }

        const retryMessages = [...newMessages, retryMessage]

        try {
          setError("Retrying with simplified syntax...")

          const retryResponse = await fetch("/api/openai", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: retryMessages,
              model: "gpt-3.5-turbo",
            }),
          })

          if (retryResponse.ok) {
            const retryData = retryResponse.body
            if (retryData) {
              const retryReader = retryData.getReader()
              const retryDecoder = new TextDecoder()
              let retryDone = false
              let retryCode = ""

              while (!retryDone) {
                const { value, done: retryDoneReading } = await retryReader.read()
                retryDone = retryDoneReading
                const retryChunkValue = retryDecoder.decode(value)
                retryCode += retryChunkValue
              }

              const retryParsedCode = parseCodeFromMessage(retryCode)
              const retrySanitizedCode = sanitizeMermaidCode(retryParsedCode)

              if (retrySanitizedCode && !retrySanitizedCode.includes("Error: Invalid Response")) {
                setOutputCode(retrySanitizedCode)
                setDraftOutputCode("")
                await generateSummaryAndSuggestions(retrySanitizedCode)
                setError("")
              } else {
                setError("Unable to generate a valid diagram. Please try a more specific request.")
              }
            }
          }
        } catch (retryError) {
          console.error("Retry error:", retryError)
          setError("Unable to generate diagram. Please try again with a more specific request.")
        }
      }
    } finally {
      // Always set loading to false when done
      setIsLoading(false)
    }
  }, [draftMessage, messages, generateSummaryAndSuggestions, retryCount, outputCode])

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
      // Get the current diagram code for context
      const currentDiagram = outputCode || draftOutputCode

      const improvementPrompt = `Based on the current diagram, ${suggestion.toLowerCase()}. 

Current diagram:
\`\`\`mermaid
${currentDiagram}
\`\`\`

Please update this diagram to incorporate the suggestion while maintaining the existing structure and connections.`

      const newMessage: Message = {
        role: "user",
        content: improvementPrompt,
      }
      const newMessages = [...messages, newMessage]

      setMessages(newMessages)
      setDraftMessage("")
      setDraftOutputCode("")
      setIsLoading(true)
      setError("")

      try {
        const response = await fetch("/api/openai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: newMessages,
            model: "gpt-3.5-turbo",
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
          setDraftOutputCode((prevCode) => prevCode + chunkValue)
        }

        const parsedCode = parseCodeFromMessage(code)
        const sanitizedCode = sanitizeMermaidCode(parsedCode)

        if (sanitizedCode && !sanitizedCode.includes("Error: Invalid Response")) {
          setOutputCode(sanitizedCode)
          setDraftOutputCode("")
          await generateSummaryAndSuggestions(sanitizedCode)
        } else {
          throw new Error("Invalid diagram syntax received")
        }
      } catch (error) {
        console.error("Request error:", error)
        setError(error instanceof Error ? error.message : "An error occurred")
      } finally {
        // Always set loading to false when done
        setIsLoading(false)
      }
    },
    [messages, generateSummaryAndSuggestions, outputCode, draftOutputCode],
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
    <main className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden bg-gray-50">
      {/* Chat Panel */}
      <div
        className={`${chatWidth} transition-all duration-500 ease-in-out border-r border-gray-200 flex flex-col bg-white shadow-lg`}
      >
        {/* Chat Header - Fixed */}
        <div className="border-b border-gray-200 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between flex-shrink-0">
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
              <span>{isLoading ? "Generating..." : "Ready"}</span>
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

        {/* Messages - Scrollable */}
        <div className="flex-1 overflow-y-auto chat-scroll">
          {messages.length === 0 ? (
            <div className="p-6 text-center space-y-6">
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
                  Instant Generation
                </Badge>
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                  Multiple Formats
                </Badge>
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                  Export Ready
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
                    <span className="text-sm font-medium">Generating diagram...</span>
                    {draftOutputCode && (
                      <div className="mt-2 text-xs text-gray-500">Received {draftOutputCode.length} characters...</div>
                    )}
                  </div>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-3 text-red-600 p-4 bg-red-50 rounded-lg border border-red-200">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{error}</span>
                    {retryCount > 0 && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRetry}
                          className="text-xs flex items-center gap-2 hover:bg-red-100"
                          disabled={isLoading}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Try Again with Different Format
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
        <div className={`${canvasWidth} transition-all duration-500 ease-in-out flex flex-col bg-gray-50 shadow-lg`}>
          {/* Canvas Header - Fixed */}
          <div className="border-b border-gray-200 p-4 bg-gradient-to-r from-gray-50 to-slate-50 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-lg text-gray-800">Interactive Canvas</h2>
              {outputCode && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                    Live
                  </Badge>
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                    Interactive
                  </Badge>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Chat visibility toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleChatVisibility}
                className="h-8 w-8 p-0 hover:bg-gray-200"
                title={chatVisible ? "Hide Chat" : "Show Chat"}
              >
                {chatVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>

              {/* Canvas collapse toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCanvasVisibility}
                className="h-8 w-8 p-0 hover:bg-gray-200"
                title="Hide Canvas"
              >
                <PanelRightClose className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden">
            {outputCode ? (
              <Mermaid
                chart={outputCode}
                isFullscreen={isFullscreen}
                onFullscreenChange={setIsFullscreen}
                isStandalone={!chatVisible}
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
