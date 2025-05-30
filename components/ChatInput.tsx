"use client"

import type React from "react"

import type { KeyboardEvent } from "react"
import { Textarea } from "./ui/textarea"
import { Button } from "./ui/button"
import { Send, Loader2 } from "lucide-react"

interface Props {
  messageCotent: string
  onChange: (messageCotent: string) => void
  onSubmit: () => void
  isLoading?: boolean
}

export const ChatInput: React.FC<Props> = ({ messageCotent, onChange, onSubmit, isLoading = false }) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading && messageCotent.trim()) {
        onSubmit()
      }
    }
  }

  return (
    <div className="relative">
      <Textarea
        placeholder="Describe the diagram you want to create..."
        value={messageCotent}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="min-h-[80px] pr-12 resize-none"
        disabled={isLoading}
      />
      <Button
        onClick={onSubmit}
        className="absolute right-2 bottom-2 h-8 w-8 p-0"
        disabled={isLoading || !messageCotent.trim()}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        <span className="sr-only">Send message</span>
      </Button>
    </div>
  )
}
