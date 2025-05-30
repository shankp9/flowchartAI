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
