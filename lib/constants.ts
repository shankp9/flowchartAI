// Application constants
export const APP_CONFIG = {
  NAME: "FlowchartAI",
  DESCRIPTION: "AI-Powered Diagram Generator",
  VERSION: "2.0.0",
  MAX_RETRIES: 3,
  MAX_MESSAGE_LENGTH: 2000,
  DEBOUNCE_DELAY: 300,
} as const

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

export const MERMAID_THEMES = ["default", "neutral", "dark", "forest", "base"] as const

export const SCREEN_BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
} as const

export const ZOOM_CONFIG = {
  MIN: 0.1,
  MAX: 5,
  STEP: 0.2,
  MOBILE_STEP: 0.15,
} as const

export const EXAMPLE_DIAGRAMS = {
  flowchart: `graph TD
    A[Start] --> B[Process]
    B --> C{Decision}
    C -->|Yes| D[Action 1]
    C -->|No| E[Action 2]
    D --> F[End]
    E --> F`,
  sequence: `sequenceDiagram
    participant User
    participant System
    participant Database
    
    User->>System: Request data
    System->>Database: Query data
    Database-->>System: Return results
    System-->>User: Display results`,
  journey: `journey
    title User Journey
    section Login
      Enter credentials: 3: User
      Validate: 2: System
      Success: 5: User
    section Dashboard
      View data: 4: User
      Interact: 3: User`,
} as const
