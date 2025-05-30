// Consolidated and improved type definitions
export type OpenAIModel = "gpt-3.5-turbo" | "gpt-4" | "gpt-4-turbo"

export interface Message {
  role: "system" | "user" | "assistant"
  content: string
  timestamp?: number
  id?: string
}

export interface APIRequestBody {
  messages: Message[]
  model: OpenAIModel
  retryAttempt?: number
  previousErrors?: string[]
  currentDiagram?: string
  isModification?: boolean
  diagramType?: DiagramType | null
}

export type DiagramType =
  | "flowchart"
  | "sequence"
  | "class"
  | "journey"
  | "gantt"
  | "state"
  | "er"
  | "pie"
  | "gitgraph"
  | "mindmap"

export type MermaidTheme = "default" | "neutral" | "dark" | "forest" | "base"

export interface MermaidValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
}

export interface DiagramGenerationResult {
  success: boolean
  code?: string
  error?: string
  retryCount?: number
}

export interface ChatState {
  messages: Message[]
  isLoading: boolean
  error: string | null
  retryCount: number
}

// Screen size breakpoints
export type ScreenSize = "mobile" | "tablet" | "desktop"

// Interaction modes for canvas
export type InteractionMode = "pan" | "select"

// Control panel tabs
export type ControlPanelTab = "zoom" | "theme" | "export"
