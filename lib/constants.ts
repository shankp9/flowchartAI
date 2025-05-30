// lib/constants.ts
export const APP_CONFIG = {
  NAME: "FlowchartAI",
  DESCRIPTION: "Create professional diagrams using natural language with AI.",
  MAX_MESSAGE_LENGTH: 2000,
  MAX_RETRIES: 3,
  DEBOUNCE_DELAY: 300, // milliseconds
  DEFAULT_MERMAID_THEME: "default",
  AVAILABLE_MERMAID_THEMES: ["default", "neutral", "dark", "forest", "base"],
  API_TIMEOUT: 30000, // 30 seconds for API requests
}

export const ERROR_MESSAGES = {
  API_KEY_MISSING: "OpenAI API key not configured. Please set the OPENAI_API_KEY environment variable.",
  NETWORK_ERROR: "A network error occurred. Please check your connection and try again.",
  TIMEOUT_ERROR: "The request timed out. Please try again.",
  UNKNOWN_ERROR: "An unknown error occurred. Please try again later.",
  DIAGRAM_GENERATION_FAILED: "Failed to generate diagram after multiple attempts.",
  SUMMARY_GENERATION_FAILED: "Failed to generate diagram summary and suggestions.",
  INVALID_INPUT: "Invalid input provided. Please check your message.",
  RATE_LIMIT: "API rate limit exceeded. Please try again later.",
}

export const DIAGRAM_TYPES = {
  FLOWCHART: "flowchart",
  SEQUENCE: "sequence",
  CLASS: "class",
  JOURNEY: "journey",
  GANTT: "gantt",
  STATE: "state",
  ER: "er",
  PIE: "pie",
} as const

export type DiagramType = (typeof DIAGRAM_TYPES)[keyof typeof DIAGRAM_TYPES]
