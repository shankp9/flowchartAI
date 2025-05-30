import { User, Bot } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface ChatMessageProps {
  message: string
  role?: "user" | "assistant"
}

export function ChatMessage({ message, role = "user" }: ChatMessageProps) {
  return (
    <div className="flex gap-4 p-4 rounded-lg hover:bg-muted/30 transition-colors">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}>
          {role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-2">
        <div className="font-medium text-sm text-muted-foreground">{role === "user" ? "You" : "AI Assistant"}</div>
        <div className="text-sm leading-relaxed whitespace-pre-wrap">{message}</div>
      </div>
    </div>
  )
}
