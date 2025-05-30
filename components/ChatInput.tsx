"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { Textarea } from "./ui/textarea"
import { Button } from "./ui/button"
import { Send, Loader2 } from "lucide-react"
import { useDebounce } from "@/hooks/useDebounce"
import { APP_CONFIG } from "@/lib/constants"

interface ChatInputProps {
  messageContent: string
  onChange: (content: string) => void
  onSubmit: () => void
  isLoading?: boolean
  disabled?: boolean
}

export function ChatInput({ messageContent, onChange, onSubmit, isLoading = false, disabled = false }: ChatInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const debouncedContent = useDebounce(messageContent, APP_CONFIG.DEBOUNCE_DELAY)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        if (!isLoading && !disabled && messageContent.trim()) {
          onSubmit()
        }
      }
    },
    [isLoading, disabled, messageContent, onSubmit],
  )

  const handleSubmit = useCallback(() => {
    if (!isLoading && !disabled && messageContent.trim()) {
      onSubmit()
    }
  }, [isLoading, disabled, messageContent, onSubmit])

  const isSubmitDisabled = isLoading || disabled || !messageContent.trim()
  const characterCount = messageContent.length
  const isNearLimit = characterCount > APP_CONFIG.MAX_MESSAGE_LENGTH * 0.8
  const isOverLimit = characterCount > APP_CONFIG.MAX_MESSAGE_LENGTH

  return (
    <div className="relative">
      <Textarea
        placeholder="Describe your diagram in detail... (e.g., 'Create a flowchart showing the user registration process with email verification')"
        value={messageContent}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={isLoading || disabled}
        className={`min-h-[60px] pr-12 resize-none border transition-all duration-200 ${
          isFocused ? "border-primary ring-2 ring-primary/20" : "border-border"
        } ${isOverLimit ? "border-red-500 ring-red-200" : ""}`}
        maxLength={APP_CONFIG.MAX_MESSAGE_LENGTH}
        aria-label="Diagram description input"
      />
      <Button
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
        size="sm"
        className="absolute bottom-2 right-2 h-7 w-7 p-0 transition-all duration-200"
        aria-label="Send message"
      >
        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
      </Button>
      <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
        <span>Press Enter to send • Be specific for better results</span>
        <span className={isNearLimit ? (isOverLimit ? "text-red-500" : "text-yellow-500") : ""}>
          {characterCount}/{APP_CONFIG.MAX_MESSAGE_LENGTH}
        </span>
      </div>
    </div>
  )
}
