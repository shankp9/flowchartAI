import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { MermaidValidationResult, DiagramType } from "@/types"
import { DIAGRAM_TYPES } from "./constants"
import { MermaidError } from "./errors"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function serializeCode(code: string): string {
  try {
    return btoa(unescape(encodeURIComponent(code)))
  } catch (error) {
    console.error("Error serializing code:", error)
    return ""
  }
}

export function parseCodeFromMessage(message: string): string {
  const codeBlockRegex = /```(?:mermaid)?\n([\s\S]*?)\n```/g
  const match = codeBlockRegex.exec(message)
  return match ? match[1].trim() : message.trim()
}

export function detectDiagramType(input: string): DiagramType | null {
  const lowercaseInput = input.toLowerCase()

  const typeMap: Record<string, DiagramType> = {
    flow: DIAGRAM_TYPES.FLOWCHART,
    process: DIAGRAM_TYPES.FLOWCHART,
    sequence: DIAGRAM_TYPES.SEQUENCE,
    interaction: DIAGRAM_TYPES.SEQUENCE,
    api: DIAGRAM_TYPES.SEQUENCE,
    class: DIAGRAM_TYPES.CLASS,
    object: DIAGRAM_TYPES.CLASS,
    journey: DIAGRAM_TYPES.JOURNEY,
    "user experience": DIAGRAM_TYPES.JOURNEY,
    gantt: DIAGRAM_TYPES.GANTT,
    timeline: DIAGRAM_TYPES.GANTT,
    schedule: DIAGRAM_TYPES.GANTT,
    state: DIAGRAM_TYPES.STATE,
    status: DIAGRAM_TYPES.STATE,
    er: DIAGRAM_TYPES.ER,
    entity: DIAGRAM_TYPES.ER,
    database: DIAGRAM_TYPES.ER,
    pie: DIAGRAM_TYPES.PIE,
    chart: DIAGRAM_TYPES.PIE,
    distribution: DIAGRAM_TYPES.PIE,
  }

  for (const [keyword, type] of Object.entries(typeMap)) {
    if (lowercaseInput.includes(keyword)) {
      return type
    }
  }

  return null
}

export function validateMermaidCode(code: string): MermaidValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!code || typeof code !== "string") {
    errors.push("Empty or invalid code")
    return { isValid: false, errors, warnings }
  }

  const lines = code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    errors.push("No content found")
    return { isValid: false, errors, warnings }
  }

  const firstLine = lines[0].toLowerCase()
  const validStarts = [
    "graph",
    "flowchart",
    "sequencediagram",
    "classdiagram",
    "journey",
    "gantt",
    "statediagram",
    "erdiagram",
    "pie",
  ]

  if (!validStarts.some((start) => firstLine.startsWith(start))) {
    errors.push(`Invalid diagram type. Must start with one of: ${validStarts.join(", ")}`)
  }

  // Check for error patterns
  const problematicPatterns = [
    /syntax\s+error/i,
    /parse\s+error/i,
    /mermaid\s+error/i,
    /error\s*:\s*error/i,
    /^error$/im,
    /identifying\s+error/i,
  ]

  for (const pattern of problematicPatterns) {
    if (pattern.test(code)) {
      errors.push("Contains error keywords that will cause parsing failures")
      break
    }
  }

  return { isValid: errors.length === 0, errors, warnings }
}

export function sanitizeMermaidCode(code: string): string {
  if (!code || typeof code !== "string") {
    throw new MermaidError("Empty or invalid code", code)
  }

  let cleanedCode = code.trim()

  // Remove markdown code block markers
  cleanedCode = cleanedCode.replace(/^```(?:mermaid)?\n?/gm, "")
  cleanedCode = cleanedCode.replace(/\n?```$/gm, "")

  // Find diagram start
  const lines = cleanedCode.split("\n")
  let diagramStartIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase()
    if (
      line.startsWith("graph") ||
      line.startsWith("flowchart") ||
      line.startsWith("sequencediagram") ||
      line.startsWith("classdiagram") ||
      line.startsWith("journey") ||
      line.startsWith("gantt") ||
      line.startsWith("statediagram") ||
      line.startsWith("erdiagram") ||
      line.startsWith("pie")
    ) {
      diagramStartIndex = i
      break
    }
  }

  if (diagramStartIndex > 0) {
    cleanedCode = lines.slice(diagramStartIndex).join("\n")
  }

  // Apply formatting fixes
  cleanedCode = fixMermaidFormatting(cleanedCode)

  // Apply diagram-specific fixes
  try {
    const lowerCode = cleanedCode.toLowerCase()
    if (lowerCode.includes("sequencediagram")) {
      cleanedCode = fixSequenceDiagramSyntax(cleanedCode)
    } else if (lowerCode.includes("graph") || lowerCode.includes("flowchart")) {
      cleanedCode = fixFlowchartSyntax(cleanedCode)
    } else if (lowerCode.includes("classdiagram")) {
      cleanedCode = fixClassDiagramSyntax(cleanedCode)
    }
  } catch (error) {
    console.warn("Failed to apply diagram-specific fixes:", error)
    throw new MermaidError("Failed to apply diagram-specific fixes", code)
  }

  if (!cleanedCode || cleanedCode.length < 5) {
    throw new MermaidError("Invalid code length after sanitization", code)
  }

  return cleanedCode
}

function fixMermaidFormatting(code: string): string {
  let formatted = code

  // Fix missing spaces after diagram type declarations
  formatted = formatted.replace(
    /^(graph|flowchart|sequenceDiagram|classDiagram|journey|gantt|stateDiagram|erDiagram|pie)([A-Z])/gm,
    "$1 $2",
  )

  // Fix missing line breaks after diagram declarations
  formatted = formatted.replace(
    /^(graph\s+(?:TD|LR|TB|RL|BT)|flowchart\s+(?:TD|LR|TB|RL|BT)|sequenceDiagram|classDiagram|journey|gantt|stateDiagram|erDiagram|pie)([^\n])/gm,
    "$1\n    $2",
  )

  // Fix missing spaces around arrows
  formatted = formatted.replace(/([a-zA-Z0-9\]})])-->/g, "$1 -->")
  formatted = formatted.replace(/-->([a-zA-Z0-9[{(])/g, "--> $1")

  return formatted
}

function fixSequenceDiagramSyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []
  let lastParticipant = ""
  const participants = new Set<string>()

  for (const line of lines) {
    let fixedLine = line.trim()

    if (!fixedLine || fixedLine === "sequenceDiagram") {
      fixedLines.push(fixedLine)
      continue
    }

    if (fixedLine.startsWith("participant")) {
      fixedLines.push(fixedLine)
      const participantMatch = fixedLine.match(/participant\s+(\w+)/)
      if (participantMatch) {
        const participant = participantMatch[1]
        participants.add(participant)
        lastParticipant = participant
      }
      continue
    }

    // Fix arrows without senders
    if (fixedLine.match(/^(--?>>?|--?\+\+|-x)/)) {
      if (lastParticipant) {
        fixedLine = `${lastParticipant} ${fixedLine}`
      } else {
        if (participants.size === 0) {
          fixedLines.splice(-1, 0, "participant System")
          participants.add("System")
        }
        const defaultParticipant = Array.from(participants)[0]
        fixedLine = `${defaultParticipant} ${fixedLine}`
      }
    }

    const arrowMatch = fixedLine.match(/^(\w+)\s*(--?>>?|--?\+\+|-x)\s*(\w+)/)
    if (arrowMatch) {
      const [, sender, , receiver] = arrowMatch
      participants.add(sender)
      participants.add(receiver)
      lastParticipant = sender
    }

    fixedLines.push(fixedLine)
  }

  return fixedLines.join("\n")
}

function fixFlowchartSyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []

  for (const line of lines) {
    let fixedLine = line.trim()

    if (!fixedLine || fixedLine.startsWith("graph") || fixedLine.startsWith("flowchart")) {
      fixedLines.push(fixedLine)
      continue
    }

    if (fixedLine.includes("-->") || fixedLine.includes("->")) {
      fixedLine = fixedLine.replace(/([a-zA-Z0-9\]})])-->/g, "$1 -->")
      fixedLine = fixedLine.replace(/-->([a-zA-Z0-9[{(])/g, "--> $1")
      fixedLines.push(`    ${fixedLine}`)
    } else if (fixedLine.match(/^\s*[a-zA-Z0-9]+\s*[[{(].*[\]})]\s*$/)) {
      fixedLines.push(`    ${fixedLine}`)
    } else {
      fixedLines.push(`    ${fixedLine}`)
    }
  }

  return fixedLines.join("\n")
}

function fixClassDiagramSyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []

  for (const line of lines) {
    let fixedLine = line.trim()

    if (!fixedLine) continue

    if (fixedLine.toLowerCase() === "classdiagram" || fixedLine.toLowerCase().startsWith("classdiagram")) {
      fixedLines.push("classDiagram")
      continue
    }

    if (fixedLine.includes("class ") || fixedLine.match(/^class\w/)) {
      fixedLine = fixedLine.replace(/^class\s*(\w+)\s*\{?/, "class $1 {")
      fixedLines.push("    " + fixedLine)
      continue
    }

    if (fixedLine.match(/^[+\-#~]/)) {
      fixedLines.push("        " + fixedLine)
      continue
    }

    if (fixedLine === "}") {
      fixedLines.push("    }")
      continue
    }

    if (!fixedLine.startsWith("    ")) {
      fixedLines.push("    " + fixedLine)
    } else {
      fixedLines.push(fixedLine)
    }
  }

  return fixedLines.join("\n")
}

export function createFallbackDiagram(originalCode: string, errorMessage: string): string {
  const lines = originalCode
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return `graph TD
    A[Start] --> B[Process]
    B --> C[End]`
  }

  const firstLine = lines[0].toLowerCase()

  if (firstLine.startsWith("sequencediagram")) {
    return `sequenceDiagram
    participant User
    participant System
    User->>System: Request
    System-->>User: Response`
  } else if (firstLine.startsWith("classdiagram")) {
    return `classDiagram
    class User {
      +String name
      +login()
    }
    class System {
      +process()
    }
    User --> System`
  } else {
    return `graph TD
    A[Start] --> B[Process]
    B --> C{Decision}
    C -->|Yes| D[Success]
    C -->|No| E[Retry]
    D --> F[End]
    E --> F`
  }
}

// Debounce utility
export function debounce(func: any, wait: number): any {
  let timeout: NodeJS.Timeout | null = null

  return (...args: any[]) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Local storage utilities
export const storage = {
  get: (key: string, defaultValue: any): any => {
    if (typeof window === "undefined") return defaultValue
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch {
      return defaultValue
    }
  },

  set: (key: string, value: any): void => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.warn("Failed to save to localStorage:", error)
    }
  },

  remove: (key: string): void => {
    if (typeof window === "undefined") return
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.warn("Failed to remove from localStorage:", error)
    }
  },
}
