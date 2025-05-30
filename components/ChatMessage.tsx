import { User, Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message } from "@/types/type"

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex items-start gap-4 rounded-lg p-4", isUser ? "bg-muted/50" : "bg-background")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border",
          isUser ? "bg-background" : "bg-primary text-primary-foreground",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex-1 space-y-2">
        <div className="prose-sm">{message.content}</div>
      </div>
    </div>
  )
}
