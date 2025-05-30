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
        placeholder="Describe your diagram... (e.g., 'Create a user login flowchart')"
        value={messageCotent}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        className="min-h-[60px] pr-12 resize-none border focus:border-primary transition-colors"
        maxLength={2000}
      />
      <Button
        onClick={onSubmit}
        disabled={isLoading || !messageCotent.trim()}
        size="sm"
        className="absolute bottom-2 right-2 h-7 w-7 p-0"
      >
        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
      </Button>
      <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
        <span>Press Enter to send</span>
        <span>{messageCotent.length}/2000</span>
      </div>
    </div>
  )
}
