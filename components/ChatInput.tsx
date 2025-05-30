"use client"

import type React from "react"

import { Textarea } from "./ui/textarea"
import { Button } from "./ui/button"
import { Send, Loader2 } from "lucide-react"
import type { KeyboardEvent } from "react"
import { APP_CONFIG } from "@/lib/constants"

interface Props {
  messageContent: string
  onChange: (messageContent: string) => void
  onSubmit: () => void
  isLoading?: boolean
}

export const ChatInput: React.FC<Props> = ({ messageContent, onChange, onSubmit, isLoading = false }) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading && messageContent.trim()) {
        onSubmit()
      }
    }
  }

  return (
    <div className="relative">
      <Textarea
        placeholder="Describe your diagram in detail... (e.g., 'Create a flowchart showing the user registration process with email verification')"
        value={messageContent}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        className="min-h-[60px] pr-12 resize-none border focus:border-primary transition-colors"
        maxLength={APP_CONFIG.MAX_MESSAGE_LENGTH}
      />
      <Button
        onClick={onSubmit}
        disabled={isLoading || !messageContent.trim()}
        size="sm"
        className="absolute bottom-2 right-2 h-7 w-7 p-0"
      >
        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
      </Button>
      <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
        <span>Press Enter to send • Be specific for better results</span>
        <span>
          {messageContent.length}/{APP_CONFIG.MAX_MESSAGE_LENGTH}
        </span>
      </div>
    </div>
  )
}
