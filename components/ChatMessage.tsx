"use client"

import { User, Bot } from "lucide-react"
import { Button } from "./ui/button"

interface ChatMessageProps {
  message: string
  role?: "user" | "assistant" | "system"
  onSuggestionClick?: (suggestion: string) => void
  isLoading?: boolean
}

export function ChatMessage({ message, role = "user", onSuggestionClick, isLoading = false }: ChatMessageProps) {
  // Check if this is a suggestion message
  const isSuggestionMessage = message.includes("💡 **Suggestions for improvement:**")

  // Parse suggestions from the message
  const suggestions: string[] = []
  if (isSuggestionMessage && onSuggestionClick) {
    const suggestionLines = message.split("\n").filter((line) => /^\d+\./.test(line.trim()))
    suggestions.push(...suggestionLines.map((line) => line.replace(/^\d+\.\s*/, "").trim()))
  }

  const formatMessage = (text: string) => {
    // Convert markdown-style formatting to HTML
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .split("\n")
      .map((line, index) => (
        <div key={index} className={line.trim() === "" ? "h-2" : ""}>
          {line.trim() === "" ? "" : <span dangerouslySetInnerHTML={{ __html: line }} />}
        </div>
      ))
  }

  return (
    <div className="flex gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center bg-gray-100">
        {role === "user" ? <User className="h-4 w-4 text-gray-600" /> : <Bot className="h-4 w-4 text-blue-600" />}
      </div>
      <div className="flex-1 space-y-2">
        <div className="font-medium text-sm text-gray-600">{role === "user" ? "You" : "AI Assistant"}</div>
        <div className="text-sm leading-relaxed">
          {formatMessage(message)}

          {/* Render clickable suggestion buttons */}
          {suggestions.length > 0 && onSuggestionClick && (
            <div className="mt-4 space-y-2">
              <div className="text-xs text-gray-500 font-medium mb-2">Click any suggestion to apply it:</div>
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="w-full text-left justify-start h-auto p-3 text-xs hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                  onClick={() => onSuggestionClick(suggestion)}
                  disabled={isLoading}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-medium">💡</span>
                    <span className="flex-1">{suggestion}</span>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
