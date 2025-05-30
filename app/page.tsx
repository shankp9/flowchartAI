"use client"

import { useEffect, useState } from "react"
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Lightbulb, Sparkles } from "lucide-react"

import { Mermaid } from "@/components/Mermaids"
import { ChatInput } from "@/components/ChatInput"
import { ChatMessage } from "@/components/ChatMessage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Message } from "@/types/type"
import { parseCodeFromMessage } from "@/lib/utils"

export default function Home() {
  const [draftMessage, setDraftMessage] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])
  const [draftOutputCode, setDraftOutputCode] = useState<string>("")
  const [outputCode, setOutputCode] = useState<string>("")
  const [isClient, setIsClient] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const [diagramCollapsed, setDiagramCollapsed] = useState(false)
  const [diagramSummary, setDiagramSummary] = useState<string>("")
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    setIsClient(true)
  }, [])

  const generateSummaryAndSuggestions = async (code: string) => {
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
            setDiagramSummary(parsed.summary || "")
            setSuggestions(parsed.suggestions || [])
          } catch {
            // Fallback if JSON parsing fails
            setDiagramSummary("Diagram generated successfully")
            setSuggestions([
              "Add more detail to the process steps",
              "Include error handling paths",
              "Add decision points for better flow control",
            ])
          }
        }
      }
    } catch (error) {
      console.error("Error generating summary:", error)
    }
  }

  const handleSubmit = async () => {
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
        throw new Error("Failed to generate diagram")
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

      const finalCode = parseCodeFromMessage(code)
      setOutputCode(finalCode)

      // Generate summary and suggestions
      if (finalCode) {
        await generateSummaryAndSuggestions(finalCode)
      }
    } catch (error) {
      console.error("Request error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestionClick = async (suggestion: string) => {
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
        throw new Error("Failed to generate diagram")
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

      const finalCode = parseCodeFromMessage(code)
      setOutputCode(finalCode)

      // Generate new summary and suggestions
      if (finalCode) {
        await generateSummaryAndSuggestions(finalCode)
      }
    } catch (error) {
      console.error("Request error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <main className="flex-1 flex h-[calc(100vh-4rem)]">
      {/* Chat Panel */}
      <div className={`${chatCollapsed ? "w-12" : "w-1/2"} transition-all duration-300 border-r flex flex-col`}>
        {/* Chat Header */}
        <div className="border-b p-4 bg-muted/30 flex items-center justify-between">
          {!chatCollapsed && (
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">AI Chat</h2>
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
                  <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">Create Professional Diagrams</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Transform your ideas into beautiful flowcharts, sequence diagrams, and more using the power of AI.
                      Simply describe what you want, and watch it come to life.
                    </p>
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
                    <ChatMessage key={`${message.content}-${index}`} message={message.content} />
                  ))}
                  {isLoading && (
                    <div className="flex items-center gap-2 text-muted-foreground p-4">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span className="text-sm">Generating diagram...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t p-4 bg-background">
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
        <div className="border-b p-4 bg-muted/30 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDiagramCollapsed(!diagramCollapsed)}
            className="h-8 w-8 p-0"
          >
            {diagramCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
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
            <div className="flex-1 relative bg-muted/10 overflow-hidden">
              {outputCode ? (
                <Mermaid chart={outputCode} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-4 max-w-md">
                    <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                      <Sparkles className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold">Your diagram will appear here</h3>
                      <p className="text-sm text-muted-foreground">
                        Describe the diagram you want to create in natural language
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Summary and Suggestions */}
            {(diagramSummary || suggestions.length > 0) && (
              <div className="border-t p-4 space-y-4 max-h-64 overflow-y-auto">
                {diagramSummary && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">{diagramSummary}</p>
                    </CardContent>
                  </Card>
                )}

                {suggestions.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Suggestions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {suggestions.map((suggestion, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="w-full text-left justify-start h-auto p-3 text-xs"
                          onClick={() => handleSuggestionClick(suggestion)}
                          disabled={isLoading}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
