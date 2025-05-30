"use client"

import { useEffect, useState } from "react"
import { useAtom } from "jotai"
import { Sparkles, Zap, FileText, Download } from "lucide-react"

import { modelAtom } from "@/lib/atom"
import { Mermaid } from "@/components/Mermaids"
import { ChatInput } from "@/components/ChatInput"
import { CodeBlock } from "@/components/CodeBlock"
import { ChatMessage } from "@/components/ChatMessage"
import { ModelSelector } from "@/components/ModelSelector"
import { DiagramExamples } from "@/components/DiagramExamples"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Message, RequestBody } from "@/types/type"
import { parseCodeFromMessage } from "@/lib/utils"
import type { OpenAIModel } from "@/types/type"

export default function Home() {
  const [model, setModel] = useAtom(modelAtom)
  const [draftMessage, setDraftMessage] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])
  const [draftOutputCode, setDraftOutputCode] = useState<string>("")
  const [outputCode, setOutputCode] = useState<string>("")
  const [isClient, setIsClient] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const savedModel = localStorage.getItem("model")
    if (savedModel) {
      setModel(savedModel as OpenAIModel)
    }
  }, [setModel])

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
      const body: RequestBody = { messages: newMessages, model }

      const response = await fetch("/api/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        let errorMessage = "Something went wrong"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = (await response.text()) || errorMessage
        }
        throw new Error(errorMessage)
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

      setOutputCode(parseCodeFromMessage(code))
    } catch (error) {
      console.error("Request error:", error)
      // You could add a toast notification here
    } finally {
      setIsLoading(false)
    }
  }

  const handleExampleSelect = (example: string) => {
    setDraftMessage(example)
  }

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <main className="flex-1 flex flex-col">
      {/* Hero Section */}
      {messages.length === 0 && (
        <div className="border-b bg-gradient-to-br from-background via-background to-muted/20">
          <div className="container py-12 md:py-16">
            <div className="text-center space-y-6 max-w-3xl mx-auto">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
                <Badge variant="secondary" className="text-sm font-medium">
                  AI-Powered Diagram Generator
                </Badge>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                Create <span className="gradient-text">Professional Diagrams</span> with Natural Language
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Transform your ideas into beautiful flowcharts, sequence diagrams, and more using the power of AI.
                Simply describe what you want, and watch it come to life.
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4 text-primary" />
                  Instant Generation
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Multiple Formats
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Download className="h-4 w-4 text-primary" />
                  Export Ready
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left Panel - Chat */}
        <div className="w-full lg:w-1/2 flex flex-col border-r">
          {/* Model Selector */}
          <div className="border-b p-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm text-muted-foreground">AI Model</h2>
              <ModelSelector />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="p-6">
                <DiagramExamples onExampleSelect={handleExampleSelect} />
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
        </div>

        {/* Right Panel - Diagram */}
        <div className="hidden lg:flex lg:w-1/2 flex-col">
          {/* Code Block */}
          {(draftOutputCode || outputCode) && (
            <div className="border-b">
              <CodeBlock code={draftOutputCode || outputCode} />
            </div>
          )}

          {/* Diagram Display */}
          <div className="flex-1 relative bg-muted/10">
            {outputCode ? (
              <Mermaid chart={outputCode} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md">
                  <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
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
        </div>
      </div>

      {/* Mobile Diagram View */}
      <div className="lg:hidden">
        {(draftOutputCode || outputCode) && (
          <Card className="m-4">
            <CardHeader>
              <CardTitle className="text-lg">Generated Diagram</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CodeBlock code={draftOutputCode || outputCode} />
              {outputCode && (
                <div className="border rounded-lg p-4 bg-muted/10">
                  <Mermaid chart={outputCode} />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
