"use client"

import { useEffect, useState, useCallback } from "react"
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  AlertCircle,
  RefreshCw,
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
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const [diagramCollapsed, setDiagramCollapsed] = useState(false)
  // Removed diagramSummary and suggestions state - now handled as chat messages
  const [error, setError] = useState<string>("")
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    setIsClient(true)
  }, [])

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

    // Add specific instructions based on diagram type
    if (diagramType) {
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
        await generateSummaryAndSuggestions(sanitizedCode)
      } else {
        throw new Error("Invalid diagram syntax received")
      }
    } catch (error) {
      console.error("Request error:", error)
      setError(error instanceof Error ? error.message : "An error occurred")

      // If this is the first attempt, try again with more specific instructions
      if (retryCount === 0) {
        setRetryCount(1)

        // Determine the best diagram type if not already specified
        const fallbackType = diagramType || "flowchart"

        // Create a more specific prompt with an example
        const retryMessage: Message = {
          role: "user",
          content: `Create a ${fallbackType} diagram for: ${draftMessage}. 
          
Here's an example of valid ${fallbackType} syntax:
${EXAMPLE_DIAGRAMS[fallbackType as keyof typeof EXAMPLE_DIAGRAMS] || EXAMPLE_DIAGRAMS.flowchart}

Please follow this exact syntax pattern but create a diagram for my request.`,
        }

        // Add the retry message to the conversation
        const retryMessages = [...newMessages, retryMessage]

        try {
          setIsLoading(true)
          setError("Retrying with more specific instructions...")

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
      setIsLoading(false)
    }
  }, [draftMessage, messages, generateSummaryAndSuggestions, retryCount])

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
      const improvementPrompt = `Based on the current diagram, ${suggestion.toLowerCase()}. Please update the diagram accordingly.`

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

        if (sanitizedCode) {
          setOutputCode(sanitizedCode)
          await generateSummaryAndSuggestions(sanitizedCode)
        }
      } catch (error) {
        console.error("Request error:", error)
        setError(error instanceof Error ? error.message : "An error occurred")
      } finally {
        setIsLoading(false)
      }
    },
    [messages, generateSummaryAndSuggestions],
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

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <main className="flex-1 flex h-[calc(100vh-4rem)]">
      {/* Chat Panel */}
      <div
        className={`${chatCollapsed ? "w-12" : "w-1/2"} transition-all duration-300 border-r border-gray-200 flex flex-col`}
      >
        {/* Chat Header */}
        <div className="border-b border-gray-200 p-4 bg-gray-50 flex items-center justify-between">
          {!chatCollapsed && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <span className="font-bold text-lg">FlowchartAI</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>AI Chat</span>
              </div>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => setChatCollapsed(!chatCollapsed)} className="h-8 w-8 p-0">
            {chatCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        {!chatCollapsed && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="p-6 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">Create Professional Diagrams</h3>
                    <p className="text-sm text-gray-600 max-w-md mx-auto">
                      Transform your ideas into beautiful flowcharts, sequence diagrams, and more using the power of AI.
                      Simply describe what you want, and watch it come to life.
                    </p>
                  </div>

                  {/* Example prompts */}
                  <div className="space-y-2 pt-4">
                    <p className="text-xs text-gray-500 font-medium">Try these examples:</p>
                    <div className="space-y-1">
                      {[
                        "Create a user login flowchart",
                        "Design a sequence diagram for API authentication",
                        "Make a class diagram for an e-commerce system",
                        "Build a gantt chart for project timeline",
                      ].map((example, index) => (
                        <button
                          key={index}
                          onClick={() => setDraftMessage(example)}
                          className="block w-full text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded transition-colors"
                        >
                          "{example}"
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2 pt-4">
                    <Badge variant="secondary" className="text-xs">
                      Instant Generation
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Multiple Formats
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
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
                    />
                  ))}
                  {isLoading && (
                    <div className="flex items-center gap-2 text-gray-600 p-4">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm">Generating diagram...</span>
                    </div>
                  )}
                  {error && (
                    <div className="flex items-center gap-2 text-red-600 p-4 bg-red-50 rounded-lg">
                      <AlertCircle className="h-4 w-4" />
                      <div className="flex-1">
                        <span className="text-sm">{error}</span>
                        {retryCount > 0 && (
                          <div className="mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRetry}
                              className="text-xs flex items-center gap-1"
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

            {/* Input */}
            <div className="border-t border-gray-200 p-4 bg-white">
              <ChatInput
                messageCotent={draftMessage}
                onChange={setDraftMessage}
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />
            </div>
          </>
        )}
      </div>

      {/* Diagram Panel */}
      <div className={`${diagramCollapsed ? "w-12" : "w-1/2"} transition-all duration-300 flex flex-col`}>
        {/* Diagram Header */}
        <div className="border-b border-gray-200 p-4 bg-gray-50 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDiagramCollapsed(!diagramCollapsed)}
            className="h-8 w-8 p-0"
          >
            {diagramCollapsed ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
          {!diagramCollapsed && (
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Diagram</h2>
            </div>
          )}
        </div>

        {!diagramCollapsed && (
          <>
            {/* Diagram Display */}
            <div className="flex-1 relative bg-gray-50 overflow-hidden">
              {outputCode ? (
                <Mermaid chart={outputCode} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-4 max-w-md">
                    <div className="w-16 h-16 mx-auto bg-gray-200 rounded-full flex items-center justify-center">
                      <Sparkles className="h-8 w-8 text-gray-500" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold">Your diagram will appear here</h3>
                      <p className="text-sm text-gray-600">
                        Describe the diagram you want to create in natural language
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
