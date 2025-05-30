import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Message, OpenAIModel } from "@/types/type"

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

// Enhanced validation function with detailed error reporting
export function validateMermaidCode(code: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!code || typeof code !== "string") {
    errors.push("Empty or invalid code")
    return { isValid: false, errors }
  }

  const lines = code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    errors.push("No content found")
    return { isValid: false, errors }
  }

  const firstLine = lines[0].toLowerCase()

  // Check if it starts with a valid diagram type
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

  const hasValidStart = validStarts.some((start) => firstLine.startsWith(start))
  if (!hasValidStart) {
    errors.push(`Invalid diagram type. Must start with one of: ${validStarts.join(", ")}`)
  }

  // Diagram-specific validation
  if (firstLine.startsWith("sequencediagram")) {
    validateSequenceDiagram(lines.slice(1), errors)
  } else if (firstLine.startsWith("graph") || firstLine.startsWith("flowchart")) {
    validateFlowchart(lines.slice(1), errors)
  } else if (firstLine.startsWith("classdiagram")) {
    validateClassDiagram(lines.slice(1), errors)
  } else if (firstLine.startsWith("erdiagram")) {
    validateERDiagram(lines.slice(1), errors)
  }

  // Check for common error patterns
  const codeText = code.toLowerCase()
  if (codeText.includes("error") || codeText.includes("identifying") || codeText.includes("parse error")) {
    errors.push("Contains error keywords that will cause parsing failures")
  }

  return { isValid: errors.length === 0, errors }
}

function validateSequenceDiagram(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for arrows without senders
    if (line.match(/^\s*(--?>>?|--?\+\+|-x)/)) {
      errors.push(`Invalid sequence diagram arrow without sender: "${line}"`)
    }

    // Check for proper participant format
    if (line.startsWith("participant") && !line.match(/participant\s+\w+/)) {
      errors.push(`Invalid participant declaration: "${line}"`)
    }
  }
}

function validateFlowchart(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for missing arrows in connections
    if (line.includes("-->") || line.includes("->")) {
      // Valid connection
      continue
    } else if (line.match(/^\s*\w+.*\w+\s*$/) && !line.includes("[") && !line.includes("{") && !line.includes("(")) {
      // Might be missing arrows
      errors.push(`Possible missing arrow in connection: "${line}"`)
    }
  }
}

function validateClassDiagram(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for proper class syntax
    if (line.includes("class ") && !line.match(/class\s+\w+/)) {
      errors.push(`Invalid class declaration: "${line}"`)
    }
  }
}

function validateERDiagram(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for proper entity relationship syntax
    if (line.includes("||") || line.includes("}|") || line.includes("|{")) {
      if (!line.match(/\w+\s+[|}{]+[-|]+[|}{]+\s+\w+/)) {
        errors.push(`Invalid ER relationship syntax: "${line}"`)
      }
    }
  }
}

export function sanitizeMermaidCode(code: string): string {
  if (!code || typeof code !== "string") {
    return ""
  }

  let cleanedCode = code.trim()

  // Remove any markdown code block markers
  cleanedCode = cleanedCode.replace(/^```(?:mermaid)?\n?/gm, "")
  cleanedCode = cleanedCode.replace(/\n?```$/gm, "")

  // Remove any explanatory text before the diagram
  const lines = cleanedCode.split("\n")
  let diagramStartIndex = -1

  // Find where the actual diagram starts
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
      line.startsWith("pie") ||
      line.startsWith("gitgraph") ||
      line.startsWith("mindmap") ||
      line.startsWith("timeline") ||
      line.startsWith("sankey") ||
      line.startsWith("requirement") ||
      line.startsWith("c4context") ||
      line.startsWith("c4container") ||
      line.startsWith("c4component") ||
      line.startsWith("c4dynamic")
    ) {
      diagramStartIndex = i
      break
    }
  }

  if (diagramStartIndex > 0) {
    cleanedCode = lines.slice(diagramStartIndex).join("\n")
  }

  // Check if this is old flowchart syntax and convert it
  if (isOldFlowchartSyntax(cleanedCode)) {
    cleanedCode = convertOldFlowchartToMermaid(cleanedCode)
  }

  // Enhanced syntax cleaning and validation
  cleanedCode = cleanInvalidSyntax(cleanedCode)

  // Fix common sequence diagram issues
  if (cleanedCode.toLowerCase().includes("sequencediagram")) {
    cleanedCode = fixSequenceDiagramSyntax(cleanedCode)
  }

  // Fix common flowchart issues
  if (cleanedCode.toLowerCase().includes("graph") || cleanedCode.toLowerCase().includes("flowchart")) {
    cleanedCode = fixFlowchartSyntax(cleanedCode)
  }

  // Fix ER diagram issues
  if (cleanedCode.toLowerCase().includes("erdiagram")) {
    cleanedCode = fixERDiagramSyntax(cleanedCode)
  }

  // Fix class diagram issues
  if (cleanedCode.toLowerCase().includes("classdiagram")) {
    cleanedCode = fixClassDiagramSyntax(cleanedCode)
  }

  // Remove empty lines and normalize whitespace
  cleanedCode = cleanedCode
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")

  // Final validation - if still invalid, return a simple fallback
  if (!cleanedCode || cleanedCode.length < 5) {
    return `graph TD
    A[Start] --> B[Process]
    B --> C[End]`
  }

  return cleanedCode
}

function cleanInvalidSyntax(code: string): string {
  let cleaned = code

  // Remove common error patterns
  cleaned = cleaned.replace(/ERROR\s*--\s*ERROR_TYPE\s*:\s*[^\n]*/gi, "")
  cleaned = cleaned.replace(/\bERROR\b/gi, "")
  cleaned = cleaned.replace(/\bIDENTIFYING\b(?!\s*:)/gi, "")
  cleaned = cleaned.replace(/\bBelo\b/gi, "")
  cleaned = cleaned.replace(/\bSyntax error\b/gi, "")
  cleaned = cleaned.replace(/\bmermaid version\b/gi, "")

  // Fix malformed entity relationships
  cleaned = cleaned.replace(/\|\|--\|\|/g, "||--||")
  cleaned = cleaned.replace(/\}\|--\|\{/g, "}|--|{")

  // Remove invalid characters but preserve essential ones
  cleaned = cleaned.replace(/[^\w\s\-><|{}[\]()$$$$:;.,"'`~!@#$%^&*+=/\\?\n]/g, "")

  // Fix broken lines and excessive whitespace
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, "\n\n")
  cleaned = cleaned.replace(/\s+/g, " ")
  cleaned = cleaned.replace(/\n\s+/g, "\n")

  // Ensure proper line endings
  cleaned = cleaned.replace(/\r\n/g, "\n")
  cleaned = cleaned.replace(/\r/g, "\n")

  return cleaned
}

function fixERDiagramSyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []

  for (const line of lines) {
    let fixedLine = line.trim()

    // Skip empty lines and diagram declaration
    if (!fixedLine || fixedLine === "erDiagram") {
      fixedLines.push(fixedLine)
      continue
    }

    // Fix entity definitions
    if (fixedLine.includes("{") && !fixedLine.includes("}")) {
      // Multi-line entity definition
      fixedLines.push(fixedLine)
      continue
    }

    // Fix relationship syntax
    if (fixedLine.includes("||") || fixedLine.includes("}|") || fixedLine.includes("|{")) {
      // Ensure proper relationship format: ENTITY ||--|| ENTITY : LABEL
      const relationshipMatch = fixedLine.match(/(\w+)\s*([|}{]+[-|]+[|}{]+)\s*(\w+)\s*:\s*(.+)/)
      if (relationshipMatch) {
        const [, entity1, relationship, entity2, label] = relationshipMatch
        fixedLine = `${entity1} ${relationship} ${entity2} : ${label}`
      }
    }

    // Fix entity attribute syntax
    if (fixedLine.includes("{") && fixedLine.includes("}")) {
      // Single-line entity definition
      const entityMatch = fixedLine.match(/(\w+)\s*\{([^}]+)\}/)
      if (entityMatch) {
        const [, entityName, attributes] = entityMatch
        const cleanAttributes = attributes
          .split(/[,\n]/)
          .map((attr) => attr.trim())
          .filter((attr) => attr.length > 0)
          .map((attr) => {
            // Clean attribute format
            return attr.replace(/\s+/g, " ").replace(/[^\w\s$$$$]/g, "")
          })
          .join("\n        ")

        fixedLine = `${entityName} {\n        ${cleanAttributes}\n    }`
      }
    }

    fixedLines.push(fixedLine)
  }

  return fixedLines.join("\n")
}

function fixClassDiagramSyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []

  for (const line of lines) {
    let fixedLine = line.trim()

    // Skip empty lines and diagram declaration
    if (!fixedLine || fixedLine === "classDiagram") {
      fixedLines.push(fixedLine)
      continue
    }

    // Fix class definitions
    if (fixedLine.includes("class ")) {
      // Ensure proper class syntax
      fixedLine = fixedLine.replace(/class\s+(\w+)\s*\{/, "class $1 {")
    }

    // Fix method and property syntax
    if (fixedLine.includes("(") && fixedLine.includes(")")) {
      // Method definition
      fixedLine = fixedLine.replace(/\s+/g, " ")
    }

    // Fix inheritance syntax
    if (fixedLine.includes("<|--") || fixedLine.includes("--|>")) {
      const inheritanceMatch = fixedLine.match(/(\w+)\s*(<\|--|--\|>)\s*(\w+)/)
      if (inheritanceMatch) {
        const [, class1, arrow, class2] = inheritanceMatch
        fixedLine = `${class1} ${arrow} ${class2}`
      }
    }

    fixedLines.push(fixedLine)
  }

  return fixedLines.join("\n")
}

function isOldFlowchartSyntax(code: string): boolean {
  return (
    code.includes("=>") &&
    (code.includes("start:") || code.includes("operation:") || code.includes("condition:") || code.includes("end:"))
  )
}

function convertOldFlowchartToMermaid(code: string): string {
  const lines = code.split("\n").map((line) => line.trim())
  const nodes: { [key: string]: { type: string; label: string } } = {}
  const connections: string[] = []

  // Parse node definitions
  for (const line of lines) {
    if (line.includes("=>")) {
      const [id, definition] = line.split("=>")
      const [type, label] = definition.split(":")
      nodes[id.trim()] = {
        type: type.trim(),
        label: label ? label.trim() : "",
      }
    }
  }

  // Parse connections
  for (const line of lines) {
    if (line.includes("->") && !line.includes("=>")) {
      const parts = line.split("->")
      for (let i = 0; i < parts.length - 1; i++) {
        const from = parts[i].trim()
        const to = parts[i + 1].trim()

        // Handle conditional connections
        if (from.includes("(") && from.includes(")")) {
          const nodeId = from.split("(")[0]
          const condition = from.match(/$$([^)]+)$$/)?.[1] || ""
          connections.push(`${nodeId} -->|${condition}| ${to}`)
        } else {
          connections.push(`${from} --> ${to}`)
        }
      }
    }
  }

  // Generate Mermaid syntax
  let mermaidCode = "graph TD\n"

  // Add node definitions
  for (const [id, node] of Object.entries(nodes)) {
    let nodeDefinition = ""
    switch (node.type) {
      case "start":
      case "end":
        nodeDefinition = `${id}((${node.label}))`
        break
      case "operation":
        nodeDefinition = `${id}[${node.label}]`
        break
      case "condition":
        nodeDefinition = `${id}{${node.label}}`
        break
      default:
        nodeDefinition = `${id}[${node.label}]`
    }
    mermaidCode += `    ${nodeDefinition}\n`
  }

  // Add connections
  for (const connection of connections) {
    mermaidCode += `    ${connection}\n`
  }

  return mermaidCode
}

function fixSequenceDiagramSyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []
  let lastParticipant = ""
  const participants = new Set<string>()

  for (const line of lines) {
    let fixedLine = line.trim()

    // Skip empty lines and diagram declaration
    if (!fixedLine || fixedLine === "sequenceDiagram") {
      fixedLines.push(fixedLine)
      continue
    }

    // Handle participant declarations
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

    // Fix arrows that start without a sender
    if (fixedLine.match(/^(--?>>?|--?\+\+|-x)/)) {
      if (lastParticipant) {
        fixedLine = `${lastParticipant} ${fixedLine}`
      } else {
        // Add a default participant if none exists
        if (participants.size === 0) {
          fixedLines.splice(-1, 0, "participant System")
          participants.add("System")
        }
        const defaultParticipant = Array.from(participants)[0]
        fixedLine = `${defaultParticipant} ${fixedLine}`
      }
    }

    // Extract participant from valid arrow syntax and add to participants set
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

    // Skip empty lines and graph declaration
    if (!fixedLine || fixedLine.startsWith("graph") || fixedLine.startsWith("flowchart")) {
      fixedLines.push(fixedLine)
      continue
    }

    // Ensure connections have proper arrow syntax
    if (fixedLine.includes("-->") || fixedLine.includes("->")) {
      // Line already has arrows, keep as is
      fixedLines.push(fixedLine)
    } else if (fixedLine.match(/^\s*\w+.*\w+\s*$/)) {
      // Line might be missing arrows between nodes
      const parts = fixedLine.split(/\s+/)
      if (parts.length >= 2) {
        // Add arrows between parts
        fixedLine = parts.join(" --> ")
      }
      fixedLines.push(fixedLine)
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
  } else if (firstLine.startsWith("graph") || firstLine.startsWith("flowchart")) {
    return `graph TD
    A[Start] --> B[Process]
    B --> C{Decision}
    C -->|Yes| D[Success]
    C -->|No| E[Error]
    D --> F[End]
    E --> F`
  } else if (firstLine.startsWith("journey")) {
    return `journey
    title User Journey
    section Task
      Step 1: 3: User
      Step 2: 4: User
      Step 3: 5: User`
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
  } else if (firstLine.startsWith("erdiagram")) {
    return `erDiagram
    USER {
        int id PK
        string name
    }
    ORDER {
        int id PK
        int user_id FK
    }
    USER ||--o{ ORDER : places`
  } else if (firstLine.startsWith("gantt")) {
    return `gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Task 1 :2024-01-01, 30d
    Task 2 :2024-02-01, 20d`
  } else {
    return `graph TD
    A[Original diagram had syntax errors] --> B[Showing simplified version]
    B --> C[Please check your syntax]
    style A fill:#ffcccc
    style B fill:#ffffcc
    style C fill:#ccffcc`
  }
}

export async function OpenAIStream(messages: Message[], model: OpenAIModel, apiKey: string): Promise<ReadableStream> {
  const systemMessage: Message = {
    role: "system",
    content: `You are an expert in creating Mermaid diagrams. Generate only valid Mermaid syntax based on the user's description. 
    
Available diagram types:
- Flowchart: graph TD or graph LR
- Sequence diagram: sequenceDiagram
- Class diagram: classDiagram
- User journey: journey
- Gantt chart: gantt
- C4 diagram: C4Context, C4Container, C4Component

Always respond with valid Mermaid syntax wrapped in a code block. Do not include explanations outside the code block.`,
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [systemMessage, ...messages],
      stream: true,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  return new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader()
      if (!reader) {
        controller.close()
        return
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") {
                controller.close()
                return
              }

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content
                if (content) {
                  controller.enqueue(encoder.encode(content))
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } catch (error) {
        controller.error(error)
      } finally {
        reader.releaseLock()
      }
    },
  })
}
