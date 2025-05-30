"use client"

import { useEffect, useState } from "react"
import { useAtom } from "jotai"

import { modelAtom } from "@/lib/atom"
import { Mermaid } from "@/components/Mermaids"
import { ChatInput } from "@/components/ChatInput"
import { CodeBlock } from "@/components/CodeBlock"
import { ChatMessage } from "@/components/ChatMessage"
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

  useEffect(() => {
    setIsClient(true)
    const savedModel = localStorage.getItem("model")

    if (savedModel) {
      setModel(savedModel as OpenAIModel)
    }
  }, [setModel])

  const handleSubmit = async () => {
    if (!draftMessage) {
      alert("Please enter a message.")
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

        if (response.status === 401) {
          alert("Authentication error: Please check if your OpenAI API key is valid and has sufficient credits.")
        } else {
          alert(`Error: ${errorMessage}`)
        }
        return
      }

      const data = response.body

      if (!data) {
        alert("No response data received.")
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
    } catch (error) {
      console.error("Request error:", error)
      alert("An error occurred while processing your request. Please try again.")
    }
  }

  if (!isClient) {
    return <div>Loading...</div>
  }

  return (
    <main className="container flex-1 w-full flex flex-wrap">
      <div className="flex border md:border-r-0 flex-col justify-between w-full md:w-1/2">
        <div className="">
          <div className="">
            {messages.map((message, index) => {
              return <ChatMessage key={`${message.content}-${index}`} message={message.content} />
            })}
          </div>
        </div>
        <div className="w-full p-2">
          <ChatInput messageCotent={draftMessage} onChange={setDraftMessage} onSubmit={handleSubmit} />
        </div>
      </div>
      <div className="border w-full md:w-1/2 p-2 flex flex-col">
        <CodeBlock code={draftOutputCode} />

        <div className="flex-1 flex justify-center border relative">
          <Mermaid chart={outputCode} />
        </div>
      </div>
    </main>
  )
}
