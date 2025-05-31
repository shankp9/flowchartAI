"use client"

import type React from "react"

import { Textarea } from "./ui/textarea"
import { Button } from "./ui/button"
import { Send, Loader2 } from "lucide-react"
import type { KeyboardEvent } from "react"
import type { ChatInputProps } from "@/types/type"

export const ChatInput: React.FC<ChatInputProps> = ({ messageCotent, onChange, onSubmit, isLoading = false }) => {
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
        placeholder="Describe your diagram in detail... (e.g., 'Create a flowchart showing the user registration process with email verification')"
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
        className="absolute bottom-2 right-2 h-9 w-9 p-0 flex items-center justify-center rounded-md"
      >
        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
      </Button>
      <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
        <span>Press Enter to send • Be specific for better results</span>
        <span>{messageCotent.length}/2000</span>
      </div>
    </div>
  )
}
