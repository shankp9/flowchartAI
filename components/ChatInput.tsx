"use client"

import type React from "react"

import { Textarea } from "./ui/textarea"
import { Button } from "./ui/button"
import { Send, Loader2 } from "lucide-react"
import type { KeyboardEvent } from "react"

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
        placeholder="Describe your diagram in natural language... (e.g., 'Create a flowchart for user login process')"
        value={messageCotent}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        className="min-h-[80px] pr-12 resize-none border-2 focus:border-primary transition-colors"
      />
      <Button
        onClick={onSubmit}
        disabled={isLoading || !messageCotent.trim()}
        size="sm"
        className="absolute bottom-2 right-2 h-8 w-8 p-0"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
      <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
        <span>Press Enter to send, Shift+Enter for new line</span>
        <span>{messageCotent.length}/2000</span>
      </div>
    </div>
  )
}
