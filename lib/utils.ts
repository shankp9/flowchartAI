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

// Enhanced validation function with more lenient error checking
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

  // More lenient error pattern checking - only flag obvious error messages
  const codeText = code.toLowerCase()
  const problematicPatterns = [
    /syntax\s+error/i,
    /parse\s+error/i,
    /mermaid\s+error/i,
    /error\s*:\s*error/i,
    /^error$/im, // Only flag standalone "error" words
    /identifying\s+error/i,
  ]

  for (const pattern of problematicPatterns) {
    if (pattern.test(codeText)) {
      errors.push("Contains error keywords that will cause parsing failures")
      break
    }
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
    return createFallbackDiagram(code, "Empty or invalid code")
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
      line.startsWith("pie")
    ) {
      diagramStartIndex = i
      break
    }
  }

  if (diagramStartIndex > 0) {
    cleanedCode = lines.slice(diagramStartIndex).join("\n")
  }

  // CRITICAL: Fix spacing and formatting issues
  cleanedCode = fixMermaidFormatting(cleanedCode)

  // Apply diagram-specific fixes
  try {
    if (cleanedCode.toLowerCase().includes("sequencediagram")) {
      cleanedCode = fixSequenceDiagramSyntax(cleanedCode)
    } else if (cleanedCode.toLowerCase().includes("graph") || cleanedCode.toLowerCase().includes("flowchart")) {
      cleanedCode = fixFlowchartSyntax(cleanedCode)
    } else if (cleanedCode.toLowerCase().includes("erdiagram")) {
      cleanedCode = fixERDiagramSyntax(cleanedCode)
    } else if (cleanedCode.toLowerCase().includes("classdiagram")) {
      cleanedCode = fixClassDiagramSyntax(cleanedCode)
    }
  } catch (e) {
    console.warn("Failed to apply diagram-specific fixes:", e)
    return createFallbackDiagram(code, "Failed to apply diagram-specific fixes")
  }

  // Final validation and cleanup
  if (!cleanedCode || cleanedCode.length < 5) {
    return createFallbackDiagram(code, "Invalid code length")
  }

  return cleanedCode
}

// New function to fix critical formatting issues
function fixMermaidFormatting(code: string): string {
  let formatted = code

  // Fix missing spaces after diagram type declarations
  formatted = formatted.replace(
    /^(graph|flowchart|sequenceDiagram|classDiagram|journey|gantt|stateDiagram|erDiagram|pie)([A-Z])/gm,
    "$1 $2",
  )

  // Fix missing spaces in class diagrams
  formatted = formatted.replace(/classDiagram(\w)/g, "classDiagram\n    $1")
  formatted = formatted.replace(/class(\w)/g, "class $1")

  // Fix missing spaces in sequence diagrams
  formatted = formatted.replace(/sequenceDiagram(\w)/g, "sequenceDiagram\n    $1")
  formatted = formatted.replace(/participant(\w)/g, "participant $1")

  // Fix missing spaces in flowcharts
  formatted = formatted.replace(/(graph|flowchart)\s*(TD|LR|TB|RL|BT)(\w)/g, "$1 $2\n    $3")

  // Fix missing line breaks after diagram declarations
  formatted = formatted.replace(
    /^(graph\s+(?:TD|LR|TB|RL|BT)|flowchart\s+(?:TD|LR|TB|RL|BT)|sequenceDiagram|classDiagram|journey|gantt|stateDiagram|erDiagram|pie)([^\n])/gm,
    "$1\n    $2",
  )

  // Fix concatenated words in class definitions
  formatted = formatted.replace(/\{([+\-#~])(\w)/g, "{\n        $1$2")
  formatted = formatted.replace(/(\w)\}/g, "$1\n    }")

  // Fix missing spaces around arrows
  formatted = formatted.replace(/([a-zA-Z0-9\]})])-->/g, "$1 -->")
  formatted = formatted.replace(/-->([a-zA-Z0-9[{(])/g, "--> $1")
  formatted = formatted.replace(/([a-zA-Z0-9\]})])->/g, "$1 ->")
  formatted = formatted.replace(/->([a-zA-Z0-9[{(])/g, "-> $1")

  // Fix sequence diagram arrows
  formatted = formatted.replace(/([a-zA-Z0-9])->>([a-zA-Z0-9])/g, "$1->>$2")
  formatted = formatted.replace(/([a-zA-Z0-9])-->>([a-zA-Z0-9])/g, "$1-->>$2")

  // Ensure proper indentation
  const lines = formatted.split("\n")
  const formattedLines: string[] = []
  let inDiagramBody = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (!line) {
      continue // Skip empty lines
    }

    // Check if this is a diagram declaration
    const isDiagramDeclaration =
      /^(graph\s+(?:TD|LR|TB|RL|BT)|flowchart\s+(?:TD|LR|TB|RL|BT)|sequenceDiagram|classDiagram|journey|gantt|stateDiagram|erDiagram|pie)$/i.test(
        line,
      )

    if (isDiagramDeclaration) {
      formattedLines.push(line)
      inDiagramBody = true
    } else if (inDiagramBody) {
      // Add proper indentation for diagram content
      if (!line.startsWith("    ")) {
        formattedLines.push("    " + line)
      } else {
        formattedLines.push(line)
      }
    } else {
      formattedLines.push(line)
    }
  }

  return formattedLines.join("\n")
}

function fixClassDiagramSyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()

    // Skip empty lines
    if (!line) {
      continue
    }

    // Handle diagram declaration
    if (line.toLowerCase() === "classdiagram" || line.toLowerCase().startsWith("classdiagram")) {
      fixedLines.push("classDiagram")
      continue
    }

    // Fix class definitions with proper spacing and formatting
    if (line.includes("class ") || line.match(/^class\w/)) {
      // Ensure proper class syntax: class ClassName {
      line = line.replace(/^class\s*(\w+)\s*\{?/, "class $1 {")

      // If the class definition continues on the same line, split it
      if (line.includes("{") && line.length > line.indexOf("{") + 1) {
        const classDeclaration = line.substring(0, line.indexOf("{") + 1)
        const classContent = line.substring(line.indexOf("{") + 1)

        fixedLines.push("    " + classDeclaration)

        // Process class content
        if (classContent.trim() && !classContent.trim().startsWith("}")) {
          const methods = classContent.split(/[,\n]/).filter((m) => m.trim())
          methods.forEach((method) => {
            const cleanMethod = method.trim().replace(/\}$/, "")
            if (cleanMethod) {
              fixedLines.push("        " + cleanMethod)
            }
          })
          fixedLines.push("    }")
        } else if (classContent.trim() === "}") {
          fixedLines.push("    }")
        }
      } else {
        fixedLines.push("    " + line)
      }
      continue
    }

    // Handle class methods and properties
    if (line.match(/^[+\-#~]/)) {
      fixedLines.push("        " + line)
      continue
    }

    // Handle closing braces
    if (line === "}") {
      fixedLines.push("    }")
      continue
    }

    // Handle relationships
    if (
      line.includes("-->") ||
      line.includes("<|--") ||
      line.includes("--|>") ||
      line.includes("..>") ||
      line.includes("<..")
    ) {
      fixedLines.push("    " + line)
      continue
    }

    // Handle other content with proper indentation
    if (line && !line.startsWith("    ")) {
      fixedLines.push("    " + line)
    } else {
      fixedLines.push(line)
    }
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

    // Fix node definitions and connections
    if (fixedLine.includes("-->") || fixedLine.includes("->")) {
      // Ensure proper spacing around arrows
      fixedLine = fixedLine.replace(/([a-zA-Z0-9\]})])-->/g, "$1 -->")
      fixedLine = fixedLine.replace(/-->([a-zA-Z0-9[{(])/g, "--> $1")
      fixedLine = fixedLine.replace(/([a-zA-Z0-9\]})])->/g, "$1 ->")
      fixedLine = fixedLine.replace(/->([a-zA-Z0-9[{(])/g, "-> $1")

      // Ensure each connection is on its own line
      if (fixedLine.includes(" --> ") && fixedLine.split(" --> ").length > 2) {
        const parts = fixedLine.split(" --> ")
        for (let i = 0; i < parts.length - 1; i++) {
          fixedLines.push(`    ${parts[i]} --> ${parts[i + 1]}`)
        }
        continue
      }

      fixedLines.push(`    ${fixedLine}`)
    } else if (fixedLine.match(/^\s*[a-zA-Z0-9]+\s*\[.*\]\s*$/)) {
      // Node definition
      fixedLines.push(`    ${fixedLine}`)
    } else if (fixedLine.match(/^\s*[a-zA-Z0-9]+\s*\{.*\}\s*$/)) {
      // Decision node
      fixedLines.push(`    ${fixedLine}`)
    } else if (fixedLine.match(/^\s*[a-zA-Z0-9]+\s*$$$.*$$$\s*$/)) {
      // Round node
      fixedLines.push(`    ${fixedLine}`)
    } else if (fixedLine.match(/^\s*style\s+/)) {
      // Style definition
      fixedLines.push(`    ${fixedLine}`)
    } else if (fixedLine.match(/^\s*class\s+/)) {
      // Class definition
      fixedLines.push(`    ${fixedLine}`)
    } else if (fixedLine.match(/^\s*subgraph\s+/)) {
      // Subgraph definition
      fixedLines.push(`    ${fixedLine}`)
    } else if (fixedLine === "end") {
      // End subgraph
      fixedLines.push(`    ${fixedLine}`)
    } else {
      // Try to fix missing arrows between nodes
      const parts = fixedLine.split(/\s+/)
      if (parts.length >= 2) {
        // Add arrows between parts
        const connected = parts.join(" --> ")
        fixedLines.push(`    ${connected}`)
      } else {
        fixedLines.push(`    ${fixedLine}`)
      }
    }
  }

  return fixedLines.join("\n")
}

function fixERDiagramSyntax(code: string): string {
  // Placeholder for ER diagram specific fixes
  return code
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
    C -->|No| E[Retry]
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
    A[Original diagram had syntax issues] --> B[Showing simplified version]
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

// Helper functions
function cleanInvalidSyntax(code: string): string {
  let cleaned = code

  // Remove common error patterns more aggressively but preserve legitimate content
  cleaned = cleaned.replace(/ERROR\s*--\s*ERROR_TYPE\s*:\s*[^\n]*/gi, "")
  cleaned = cleaned.replace(/\bERROR\b(?!\s*[:-])/gi, "") // Only remove standalone ERROR words
  cleaned = cleaned.replace(/\bIDENTIFYING\b(?!\s*:)/gi, "")
  cleaned = cleaned.replace(/\bSyntax error\b/gi, "")
  cleaned = cleaned.replace(/\bmermaid version\b/gi, "")
  cleaned = cleaned.replace(/\bparse error\b/gi, "")
  cleaned = cleaned.replace(/\bunexpected token\b/gi, "")
  cleaned = cleaned.replace(/\binvalid syntax\b/gi, "")

  // Remove lines that contain only error keywords
  cleaned = cleaned
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim().toLowerCase()
      return !(
        trimmed === "error" ||
        trimmed === "syntax error" ||
        trimmed === "parse error" ||
        trimmed.startsWith("error:") ||
        trimmed.includes("mermaid version") ||
        trimmed.includes("unexpected token")
      )
    })
    .join("\n")

  // Fix malformed entity relationships
  cleaned = cleaned.replace(/\|\|--\|\|/g, "||--||")
  cleaned = cleaned.replace(/\}\|--\|\{/g, "}|--|{")

  // Remove invalid characters but preserve essential ones
  cleaned = cleaned.replace(/[^\w\s\-><|{}[\]():;.,"'`~!@#$%^&*+=/\\?\n]/g, "")

  // Fix broken lines and excessive whitespace
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, "\n\n")
  cleaned = cleaned.replace(/\s+/g, " ")
  cleaned = cleaned.replace(/\n\s+/g, "\n")

  // Ensure proper line endings
  cleaned = cleaned.replace(/\r\n/g, "\n")
  cleaned = cleaned.replace(/\r/g, "\n")

  return cleaned
}

function isValidMermaidStart(code: string): boolean {
  const firstLine = code.split("\n")[0].trim().toLowerCase()
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
    "gitgraph",
    "mindmap",
    "timeline",
    "sankey",
    "requirement",
    "c4context",
    "c4container",
    "c4component",
    "c4dynamic",
  ]
  return validStarts.some((start) => firstLine.startsWith(start))
}

function containsErrorPatterns(code: string): boolean {
  // More specific error patterns that are actually problematic
  const errorPatterns = [
    /syntax\s+error/i,
    /mermaid\s+version/i,
    /parse\s+error/i,
    /unexpected\s+token/i,
    /invalid\s+syntax/i,
    /error\s*:\s*error/i,
    /^error$/im, // Only standalone error words
    /identifying\s+error/i,
  ]

  return errorPatterns.some((pattern) => pattern.test(code))
}
