export type OpenAIModel = "gpt-3.5-turbo" | "gpt-4"

export interface Message {
  role: "system" | "user" | "assistant"
  content: string
}

export interface RequestBody {
  messages: Message[]
  model: OpenAIModel
}

export type Theme = "default" | "neutral" | "dark" | "forest" | "base"

export interface MermaidProps {
  chart: string
  isFullscreen?: boolean
  onFullscreenChange?: (fullscreen: boolean) => void
  isStandalone?: boolean
  outputCode?: boolean
  toggleChatVisibility?: () => void
  toggleCanvasVisibility?: () => void
  chatVisible?: boolean
  theme?: Theme
}

export interface ChatMessageProps {
  message: string
  role?: "user" | "assistant" | "system"
  onSuggestionClick?: (suggestion: string) => void
  isLoading?: boolean
}

export interface ChatInputProps {
  messageCotent: string
  onChange: (messageCotent: string) => void
  onSubmit: () => void
  isLoading?: boolean
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export interface ThemeConfig {
  name: string
  canvasBackground: string
  description: string
}
