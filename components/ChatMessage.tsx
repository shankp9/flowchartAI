import { User, Bot } from "lucide-react"

interface ChatMessageProps {
  message: string
  role?: "user" | "assistant"
}

export function ChatMessage({ message, role = "user" }: ChatMessageProps) {
  return (
    <div className="flex gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center bg-gray-100">
        {role === "user" ? <User className="h-4 w-4 text-gray-600" /> : <Bot className="h-4 w-4 text-blue-600" />}
      </div>
      <div className="flex-1 space-y-2">
        <div className="font-medium text-sm text-gray-600">{role === "user" ? "You" : "AI Assistant"}</div>
        <div className="text-sm leading-relaxed whitespace-pre-wrap">{message}</div>
      </div>
    </div>
  )
}
