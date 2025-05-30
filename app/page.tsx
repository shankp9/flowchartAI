"use client"

import { useEffect, useState } from "react"
import { useAtom } from "jotai"
import { Sparkles, Loader2, Lightbulb } from "lucide-react"

import { modelAtom } from "@/lib/atom"
import { Mermaid } from "@/components/Mermaids"
import { ChatInput } from "@/components/ChatInput"
import { CodeBlock } from "@/components/CodeBlock"
import { ChatMessage } from "@/components/ChatMessage"
import { DiagramTypeSelector } from "@/components/DiagramTypeSelector"
import { ModelSelector } from "@/components/ModelSelector"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { parseCodeFromMessage } from "@/lib/utils"
import type { Message, OpenAIModel, DiagramType } from "@/types/type"

const EXAMPLE_PROMPTS = [
  "Create a flowchart for user registration process",
  "Draw a sequence diagram for API authentication flow",
  "Generate a class diagram for a library management system",
  "Create a user journey for e-commerce checkout process",
  "Draw a gantt chart for a software development project",
]

export default function Home() {
  const [model, setModel] = useAtom(modelAtom)
  const [draftMessage, setDraftMessage] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])
  const [draftOutputCode, setDraftOutputCode] = useState<string>("")
  const [outputCode, setOutputCode] = useState<string>("")
  const [isClient, setIsClient] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [diagramType, setDiagramType] = useState<DiagramType>("flowchart")
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<string>("diagram")

  useEffect(() => {
    setIsClient(true)
    const savedModel = localStorage.getItem("model")

    if (savedModel) {
      setModel(savedModel as OpenAIModel)
    }
  }, [setModel])

  const handleSubmit = async () => {
    if (!draftMessage) {
      toast({
        title: "Empty message",
        description: "Please enter a message to generate a diagram.",
        variant: "destructive",
      })
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
          model,
          diagramType,
        }),
      })

      if (!response.ok) {
        let errorMessage = "Something went wrong"

        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = (await response.text()) || errorMessage
        }

        if (response.status === 401) {
          toast({
            title: "Authentication Error",
            description: "Please check if your OpenAI API key is valid and has sufficient credits.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          })
        }
        setIsLoading(false)
        return
      }

      const data = response.body

      if (!data) {
        toast({
          title: "Error",
          description: "No response data received.",
          variant: "destructive",
        })
        setIsLoading(false)
        return
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
      setIsLoading(false)

      // Add assistant message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: code,
        },
      ])

      // Switch to diagram tab after generation
      setActiveTab("diagram")

      toast({
        title: "Diagram generated",
        description: "Your diagram has been successfully created.",
      })
    } catch (error) {
      console.error("Request error:", error)
      toast({
        title: "Error",
        description: "An error occurred while processing your request. Please try again.",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  const handleExampleClick = (example: string) => {
    setDraftMessage(example)
  }

  if (!isClient) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <main className="container py-6 flex-1 flex flex-col">
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight mb-2">FlowchartAI</h1>
          <p className="text-muted-foreground">
            Generate beautiful diagrams from natural language descriptions using AI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DiagramTypeSelector value={diagramType} onValueChange={setDiagramType} />
          <ModelSelector value={model} onValueChange={setModel} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        <Card className="flex flex-col overflow-hidden">
          <CardContent className="flex flex-col flex-1 p-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length > 0 ? (
                messages.map((message, index) => <ChatMessage key={`${index}-${message.role}`} message={message} />)
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <Sparkles className="h-12 w-12 text-primary mb-4" />
                  <h3 className="text-xl font-medium mb-2">Start with a description</h3>
                  <p className="text-muted-foreground mb-6">
                    Describe the diagram you want to create in natural language
                  </p>
                  <div className="grid grid-cols-1 gap-2 w-full max-w-md">
                    {EXAMPLE_PROMPTS.map((prompt, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        className="justify-start text-left h-auto py-2"
                        onClick={() => handleExampleClick(prompt)}
                      >
                        <Lightbulb className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{prompt}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t p-4">
              <ChatInput
                messageCotent={draftMessage}
                onChange={setDraftMessage}
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
            <div className="border-b px-4">
              <TabsList className="h-12">
                <TabsTrigger value="code">Code</TabsTrigger>
                <TabsTrigger value="diagram">Diagram</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="code" className="flex-1 p-4 overflow-auto data-[state=inactive]:hidden">
              <CodeBlock code={draftOutputCode} />
            </TabsContent>
            <TabsContent value="diagram" className="flex-1 p-4 overflow-auto data-[state=inactive]:hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">Generating diagram...</p>
                  </div>
                </div>
              ) : outputCode ? (
                <Mermaid chart={outputCode} />
              ) : (
                <div className="flex items-center justify-center h-full text-center p-8">
                  <div>
                    <h3 className="text-xl font-medium mb-2">No diagram yet</h3>
                    <p className="text-muted-foreground">Your generated diagram will appear here</p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </main>
  )
}
