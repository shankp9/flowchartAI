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

// Enhanced validation function with Mermaid v11.6.0 specific checks
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
    "statediagram-v2",
    "erdiagram",
    "pie",
  ]

  const hasValidStart = validStarts.some((start) => firstLine.startsWith(start))
  if (!hasValidStart) {
    errors.push(`Invalid diagram type. Must start with one of: ${validStarts.join(", ")}`)
  }

  // Check for forbidden elements that cause v11.6.0 errors
  const forbiddenPatterns = [
    /%%\{.*\}%%/, // Theme/config blocks
    /@\w+/, // @ symbols in names
    /[#$%^&*+=|\\/?<>]/, // Special characters
    /\u[0-9a-fA-F]{4}/, // Unicode escapes
    /class\s+\w+\s*\{[^}]*\}\s*\w+\s*-->/, // Combined class def and relationship
    /subgraph\s+\w+\s*\[.*\]/, // Complex subgraph syntax
  ]

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(code)) {
      errors.push(`Contains forbidden syntax pattern that may cause v11.6.0 errors: ${pattern.source}`)
    }
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
  } else if (firstLine.startsWith("journey")) {
    validateJourney(lines, errors)
  } else if (firstLine.startsWith("gantt")) {
    validateGantt(lines, errors)
  } else if (firstLine.startsWith("pie")) {
    validatePie(lines, errors)
  }

  // Check for common error patterns
  const codeText = code.toLowerCase()
  if (codeText.includes("error") || codeText.includes("identifying") || codeText.includes("parse error")) {
    errors.push("Contains error keywords that will cause parsing failures")
  }

  return { isValid: errors.length === 0, errors }
}

function validateSequenceDiagram(lines: string[], errors: string[]) {
  const participants = new Set<string>()

  for (const line of lines) {
    // Check for arrows without senders
    if (line.match(/^\s*(--?>>?|--?\+\+|-x|--x)/)) {
      errors.push(`Invalid sequence diagram arrow without sender: "${line}"`)
    }

    // Check for proper participant format
    if (line.startsWith("participant")) {
      const participantMatch = line.match(/participant\s+(\w+)/)
      if (participantMatch) {
        participants.add(participantMatch[1])
      } else {
        errors.push(`Invalid participant declaration: "${line}"`)
      }
    }

    // Validate arrow syntax
    const arrowMatch = line.match(/^(\w+)\s*(--?>>?|--?\+\+|-x|--x)\s*(\w+)/)
    if (arrowMatch) {
      const [, sender, , receiver] = arrowMatch
      if (!participants.has(sender) && !sender.match(/^\w+$/)) {
        errors.push(`Invalid sender in sequence: "${sender}"`)
      }
      if (!participants.has(receiver) && !receiver.match(/^\w+$/)) {
        errors.push(`Invalid receiver in sequence: "${receiver}"`)
      }
    }
  }
}

function validateFlowchart(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for proper node syntax
    if (line.includes("[") && !line.includes("]")) {
      errors.push(`Unclosed bracket in flowchart: "${line}"`)
    }
    if (line.includes("{") && !line.includes("}")) {
      errors.push(`Unclosed brace in flowchart: "${line}"`)
    }
    if (line.includes("(") && !line.includes(")")) {
      errors.push(`Unclosed parenthesis in flowchart: "${line}"`)
    }

    // Check for missing arrows in connections
    if (line.includes("-->") || line.includes("->") || line.includes("-.->")) {
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
    if (line.includes("class ") && !line.match(/class\s+\w+(\s*\{[\s\S]*?\})?/)) {
      errors.push(`Invalid class declaration: "${line}"`)
    }

    // Check for malformed class blocks
    if (line.includes("{}") && line.includes("-->")) {
      errors.push(`Invalid class syntax - class definition and relationship on same line: "${line}"`)
    }

    // Check for proper relationship syntax
    if (line.includes("-->") || line.includes("<|--") || line.includes("--|>")) {
      const relationshipMatch = line.match(/(\w+)\s*(<\|--|--\|>|-->|<--)\s*(\w+)/)
      if (!relationshipMatch) {
        errors.push(`Invalid relationship syntax: "${line}"`)
      }
    }
  }
}

function validateERDiagram(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for proper entity relationship syntax
    if (
      line.includes("||") ||
      line.includes("}|") ||
      line.includes("|{") ||
      line.includes("}o") ||
      line.includes("o{")
    ) {
      if (!line.match(/\w+\s+[|}{o]+[-|]+[|}{o]+\s+\w+(\s*:\s*.+)?/)) {
        errors.push(`Invalid ER relationship syntax: "${line}"`)
      }
    }

    // Check for proper entity definition
    if (line.includes("{") && !line.includes("}")) {
      errors.push(`Unclosed entity definition: "${line}"`)
    }
  }
}

function validateJourney(lines: string[], errors: string[]) {
  let hasTitle = false
  let hasSection = false

  for (const line of lines) {
    if (line.startsWith("title")) {
      hasTitle = true
    }
    if (line.startsWith("section")) {
      hasSection = true
    }

    // Check for proper task format
    if (line.includes(":") && !line.startsWith("title") && !line.startsWith("section")) {
      if (!line.match(/\w+.*:\s*\d+\s*:\s*\w+/)) {
        errors.push(`Invalid journey task format: "${line}"`)
      }
    }
  }

  if (!hasTitle) {
    errors.push("Journey diagram must have a title")
  }
  if (!hasSection) {
    errors.push("Journey diagram must have at least one section")
  }
}

function validateGantt(lines: string[], errors: string[]) {
  let hasTitle = false
  let hasDateFormat = false

  for (const line of lines) {
    if (line.startsWith("title")) {
      hasTitle = true
    }
    if (line.startsWith("dateFormat")) {
      hasDateFormat = true
    }
  }

  if (!hasTitle) {
    errors.push("Gantt chart must have a title")
  }
  if (!hasDateFormat) {
    errors.push("Gantt chart must have dateFormat specified")
  }
}

function validatePie(lines: string[], errors: string[]) {
  let hasTitle = false

  for (const line of lines) {
    if (line.startsWith("title")) {
      hasTitle = true
    }

    // Check for proper data format
    if (line.includes(":") && !line.startsWith("title")) {
      if (!line.match(/"[^"]*"\s*:\s*\d+(\.\d+)?/)) {
        errors.push(`Invalid pie chart data format: "${line}"`)
      }
    }
  }

  if (!hasTitle) {
    errors.push("Pie chart must have a title")
  }
}

// Enhanced sanitization with v11.6.0 compatibility focus
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
      line.startsWith("pie")
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

  // Enhanced syntax cleaning for v11.6.0 compatibility
  cleanedCode = cleanInvalidSyntax(cleanedCode)

  // Apply diagram-specific fixes
  if (cleanedCode.includes("sequenceDiagram")) {
    cleanedCode = fixSequenceDiagramSyntax(cleanedCode)
  }

  if (cleanedCode.includes("graph") || cleanedCode.includes("flowchart")) {
    cleanedCode = fixFlowchartSyntax(cleanedCode)
  }

  if (cleanedCode.includes("erDiagram")) {
    cleanedCode = fixERDiagramSyntax(cleanedCode)
  }

  if (cleanedCode.includes("classDiagram")) {
    cleanedCode = fixClassDiagramSyntax(cleanedCode)
  }

  if (cleanedCode.includes("journey")) {
    cleanedCode = fixJourneySyntax(cleanedCode)
  }

  if (cleanedCode.includes("gantt")) {
    cleanedCode = fixGanttSyntax(cleanedCode)
  }

  if (cleanedCode.includes("pie")) {
    cleanedCode = fixPieSyntax(cleanedCode)
  }

  // Final cleanup
  cleanedCode = cleanedCode
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")

  // If still invalid, return a safe fallback
  const validation = validateMermaidCode(cleanedCode)
  if (!validation.isValid) {
    console.warn("Generated invalid code, using fallback:", validation.errors)
    return createSafeFallbackDiagram(cleanedCode)
  }

  return cleanedCode
}

function cleanInvalidSyntax(code: string): string {
  let cleaned = code

  // Remove theme/config blocks that cause v11.6.0 errors
  cleaned = cleaned.replace(/%%\{[^}]*\}%%/g, "")

  // Remove common error patterns
  cleaned = cleaned.replace(/ERROR\s*--\s*ERROR_TYPE\s*:\s*[^\n]*/gi, "")
  cleaned = cleaned.replace(/\bERROR\b/gi, "")
  cleaned = cleaned.replace(/\bIDENTIFYING\b(?!\s*:)/gi, "")
  cleaned = cleaned.replace(/\bBelo\b/gi, "")

  // Remove special characters that cause issues
  cleaned = cleaned.replace(/[@#$%^&*+=|\\/?<>]/g, "")

  // Fix malformed entity relationships
  cleaned = cleaned.replace(/\|\|--\|\|/g, "||--||")
  cleaned = cleaned.replace(/\}\|--\|\{/g, "}|--|{")

  // Fix class diagram specific issues
  cleaned = cleaned.replace(/\}\s*class\s+/g, "}\n    class ")
  cleaned = cleaned.replace(/\}\s*(\w+)\s*-->/g, "}\n    $1 -->")

  // Remove Unicode escapes
  cleaned = cleaned.replace(/\\u[0-9a-fA-F]{4}/g, "")

  // Fix broken lines
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, "\n\n")

  return cleaned
}

function fixJourneySyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []
  let hasTitle = false

  for (const line of lines) {
    let fixedLine = line.trim()

    if (fixedLine === "journey") {
      fixedLines.push(fixedLine)
      continue
    }

    if (fixedLine.startsWith("title")) {
      hasTitle = true
      fixedLines.push(fixedLine)
      continue
    }

    if (fixedLine.startsWith("section")) {
      fixedLines.push(fixedLine)
      continue
    }

    // Fix task format
    if (fixedLine.includes(":") && !fixedLine.startsWith("title") && !fixedLine.startsWith("section")) {
      const parts = fixedLine.split(":")
      if (parts.length >= 3) {
        const task = parts[0].trim()
        const score = parts[1].trim()
        const actor = parts.slice(2).join(":").trim()
        fixedLine = `      ${task}: ${score}: ${actor}`
      }
    }

    fixedLines.push(fixedLine)
  }

  if (!hasTitle) {
    fixedLines.splice(1, 0, "    title User Journey")
  }

  return fixedLines.join("\n")
}

function fixGanttSyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []
  let hasTitle = false
  let hasDateFormat = false

  for (const line of lines) {
    const fixedLine = line.trim()

    if (fixedLine === "gantt") {
      fixedLines.push(fixedLine)
      continue
    }

    if (fixedLine.startsWith("title")) {
      hasTitle = true
      fixedLines.push(fixedLine)
      continue
    }

    if (fixedLine.startsWith("dateFormat")) {
      hasDateFormat = true
      fixedLines.push(fixedLine)
      continue
    }

    fixedLines.push(fixedLine)
  }

  if (!hasTitle) {
    fixedLines.splice(1, 0, "    title Project Timeline")
  }

  if (!hasDateFormat) {
    fixedLines.splice(hasTitle ? 2 : 1, 0, "    dateFormat YYYY-MM-DD")
  }

  return fixedLines.join("\n")
}

function fixPieSyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []
  let hasTitle = false

  for (const line of lines) {
    let fixedLine = line.trim()

    if (fixedLine === "pie") {
      fixedLines.push(fixedLine)
      continue
    }

    if (fixedLine.startsWith("title")) {
      hasTitle = true
      fixedLines.push(fixedLine)
      continue
    }

    // Fix data format
    if (fixedLine.includes(":") && !fixedLine.startsWith("title")) {
      const parts = fixedLine.split(":")
      if (parts.length >= 2) {
        const label = parts[0].trim().replace(/^["']|["']$/g, "")
        const value = parts[1].trim()
        fixedLine = `    "${label}" : ${value}`
      }
    }

    fixedLines.push(fixedLine)
  }

  if (!hasTitle) {
    fixedLines.splice(1, 0, "    title Chart")
  }

  return fixedLines.join("\n")
}

function createSafeFallbackDiagram(originalCode: string): string {
  const firstLine = originalCode.split("\n")[0].toLowerCase()

  if (firstLine.includes("sequence")) {
    return `sequenceDiagram
    participant A as User
    participant B as System
    A->>B: Request
    B-->>A: Response`
  } else if (firstLine.includes("class")) {
    return `classDiagram
    class User {
        +name: string
        +login()
    }
    class System {
        +process()
    }
    User --> System`
  } else if (firstLine.includes("er")) {
    return `erDiagram
    USER ||--o{ ORDER : places
    USER {
        int id PK
        string name
    }
    ORDER {
        int id PK
        int user_id FK
    }`
  } else if (firstLine.includes("journey")) {
    return `journey
    title User Journey
    section Login
      Enter credentials: 3: User
      Validate: 2: System
      Success: 5: User`
  } else if (firstLine.includes("gantt")) {
    return `gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    Task1 :2024-01-01, 30d
    Task2 :after Task1, 20d`
  } else if (firstLine.includes("pie")) {
    return `pie title Distribution
    "Category A" : 42.96
    "Category B" : 50.05
    "Category C" : 6.99`
  } else {
    return `graph TD
    A[Start] --> B[Process]
    B --> C[Decision]
    C -->|Yes| D[Success]
    C -->|No| E[Retry]
    E --> B
    D --> F[End]`
  }
}

// Keep existing functions but enhance them
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
    if (
      fixedLine.includes("||") ||
      fixedLine.includes("}|") ||
      fixedLine.includes("|{") ||
      fixedLine.includes("}o") ||
      fixedLine.includes("o{")
    ) {
      // Ensure proper relationship format: ENTITY ||--|| ENTITY : LABEL
      const relationshipMatch = fixedLine.match(/(\w+)\s*([|}{o]+[-|]+[|}{o]+)\s*(\w+)(\s*:\s*(.+))?/)
      if (relationshipMatch) {
        const [, entity1, relationship, entity2, , label] = relationshipMatch
        fixedLine = `${entity1} ${relationship} ${entity2}${label ? ` : ${label}` : ""}`
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
            return attr.replace(/\s+/g, " ").replace(/[^\w\s]/g, "")
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
  let inClassBlock = false
  let currentClass = ""

  for (let i = 0; i < lines.length; i++) {
    let fixedLine = lines[i].trim()

    // Skip empty lines and diagram declaration
    if (!fixedLine || fixedLine === "classDiagram") {
      fixedLines.push(fixedLine)
      continue
    }

    // Handle class definitions with potential syntax issues
    if (fixedLine.includes("class ")) {
      // Extract class name and check for malformed syntax
      const classMatch = fixedLine.match(/class\s+(\w+)/)
      if (classMatch) {
        const className = classMatch[1]

        // Check if there's a malformed class block (class Name {}OtherStuff)
        const malformedMatch = fixedLine.match(/class\s+(\w+)\s*\{\s*\}(.+)/)
        if (malformedMatch) {
          const [, name, remainder] = malformedMatch
          // Split into proper class definition and separate line
          fixedLines.push(`class ${name} {`)
          fixedLines.push("}")

          // Handle the remainder (could be relationships)
          const remainderTrimmed = remainder.trim()
          if (remainderTrimmed) {
            // If it looks like a relationship, add it as a separate line
            if (remainderTrimmed.includes("-->") || remainderTrimmed.includes("<|--")) {
              fixedLines.push(`    ${remainderTrimmed}`)
            } else {
              // If it's another class, process it
              fixedLines.push(`    class ${remainderTrimmed}`)
            }
          }
          continue
        }

        // Normal class definition
        if (fixedLine.includes("{")) {
          inClassBlock = true
          currentClass = className
          fixedLines.push(`class ${className} {`)
        } else {
          fixedLines.push(`class ${className}`)
        }
        continue
      }
    }

    // Handle class block closing
    if (inClassBlock && fixedLine.includes("}")) {
      inClassBlock = false
      currentClass = ""
      fixedLines.push("}")

      // Check if there's content after the closing brace
      const afterBrace = fixedLine.substring(fixedLine.indexOf("}") + 1).trim()
      if (afterBrace) {
        // Process content after the brace
        if (afterBrace.includes("-->") || afterBrace.includes("<|--")) {
          fixedLines.push(`    ${afterBrace}`)
        } else if (afterBrace.startsWith("class ")) {
          fixedLines.push(`    ${afterBrace}`)
        } else {
          // Might be another class name, add class keyword
          fixedLines.push(`    class ${afterBrace}`)
        }
      }
      continue
    }

    // Handle content inside class blocks
    if (inClassBlock) {
      // Clean up method and property syntax
      if (fixedLine.includes("(") && fixedLine.includes(")")) {
        // Method definition - ensure proper spacing
        fixedLine = fixedLine.replace(/\s+/g, " ")
      }
      fixedLines.push(`    ${fixedLine}`)
      continue
    }

    // Handle relationships
    if (fixedLine.includes("-->") || fixedLine.includes("<|--") || fixedLine.includes("--|>")) {
      // Clean up relationship syntax
      const relationshipMatch = fixedLine.match(/(\w+)\s*(<\|--|--\|>|-->|<--)\s*(\w+)(.*)/)
      if (relationshipMatch) {
        const [, class1, arrow, class2, label] = relationshipMatch
        const cleanLabel = label ? ` : ${label.trim().replace(/^:\s*/, "")}` : ""
        fixedLine = `${class1} ${arrow} ${class2}${cleanLabel}`
      }
      fixedLines.push(fixedLine)
      continue
    }

    // Handle standalone class names (convert to class declarations)
    if (fixedLine.match(/^\w+$/) && !fixedLine.includes("-->")) {
      fixedLines.push(`class ${fixedLine}`)
      continue
    }

    // Default: add the line as-is
    fixedLines.push(fixedLine)
  }

  // Ensure any unclosed class blocks are closed
  if (inClassBlock) {
    fixedLines.push("}")
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
    if (fixedLine.match(/^(--?>>?|--?\+\+|-x|--x)/)) {
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
    const arrowMatch = fixedLine.match(/^(\w+)\s*(--?>>?|--?\+\+|-x|--x)\s*(\w+)/)
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
    if (fixedLine.includes("-->") || fixedLine.includes("->") || fixedLine.includes("-.->")) {
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

// Keep existing functions for context-aware suggestions and other utilities
export function generateContextAwareSuggestions(diagramCode: string, diagramType: string): string[] {
  const suggestions: string[] = []

  // Analyze current diagram structure
  const lines = diagramCode.split("\n").filter((line) => line.trim().length > 0)
  const hasStartEnd = diagramCode.includes("Start") || diagramCode.includes("End")
  const hasDecisions = diagramCode.includes("{") || diagramCode.includes("?")
  const hasParallel = diagramCode.includes("&")
  const nodeCount = lines.filter((line) => line.includes("-->")).length

  if (diagramType === "flowchart" || diagramCode.includes("graph")) {
    if (!hasStartEnd) {
      suggestions.push("Add clear start and end nodes to define the process boundaries")
    }
    if (!hasDecisions && nodeCount > 2) {
      suggestions.push("Include decision points with yes/no branches for better flow control")
    }
    if (nodeCount < 5) {
      suggestions.push("Add more detailed process steps between the main actions")
    }
    if (!hasParallel && nodeCount > 3) {
      suggestions.push("Consider adding parallel processing paths for concurrent operations")
    }
    suggestions.push("Add error handling and exception paths to make the flow more robust")
    suggestions.push("Include validation or approval steps in the critical process points")
  } else if (diagramType === "sequence" || diagramCode.includes("sequenceDiagram")) {
    const participants = (diagramCode.match(/participant\s+\w+/g) || []).length
    const interactions = (diagramCode.match(/->>|-->>|-x/g) || []).length

    if (participants < 3) {
      suggestions.push("Add more participants to show complete system interactions")
    }
    if (interactions < 4) {
      suggestions.push("Include additional message exchanges to show the full workflow")
    }
    suggestions.push("Add error response messages and timeout handling")
    suggestions.push("Include authentication or authorization steps in the sequence")
    suggestions.push("Add database or external service interactions")
    suggestions.push("Show return values and confirmation messages")
  } else if (diagramType === "class" || diagramCode.includes("classDiagram")) {
    const classes = (diagramCode.match(/class\s+\w+/g) || []).length
    const relationships = (diagramCode.match(/--|>|<\|--|-->/g) || []).length

    if (classes < 3) {
      suggestions.push("Add more classes to represent the complete system architecture")
    }
    if (relationships < 2) {
      suggestions.push("Include inheritance and composition relationships between classes")
    }
    suggestions.push("Add interface classes to define contracts")
    suggestions.push("Include abstract base classes for common functionality")
    suggestions.push("Add utility or helper classes to support main entities")
    suggestions.push("Show aggregation relationships between related classes")
  } else if (diagramType === "er" || diagramCode.includes("erDiagram")) {
    const entities = (diagramCode.match(/\w+\s*\{/g) || []).length
    const relationships = (diagramCode.match(/\|\|--|\}o--|\|\{/g) || []).length

    if (entities < 3) {
      suggestions.push("Add more entities to represent the complete data model")
    }
    if (relationships < 2) {
      suggestions.push("Include foreign key relationships between related entities")
    }
    suggestions.push("Add lookup tables for enumerated values")
    suggestions.push("Include audit fields like created_date and updated_date")
    suggestions.push("Add junction tables for many-to-many relationships")
    suggestions.push("Include user and role entities for access control")
  } else if (diagramType === "journey" || diagramCode.includes("journey")) {
    suggestions.push("Add more detailed steps in the user journey")
    suggestions.push("Include pain points and satisfaction scores")
    suggestions.push("Add alternative paths for different user types")
    suggestions.push("Include touchpoints with different departments")
    suggestions.push("Add decision points where users might drop off")
    suggestions.push("Include recovery paths for failed interactions")
  } else if (diagramType === "gantt" || diagramCode.includes("gantt")) {
    suggestions.push("Add task dependencies to show project flow")
    suggestions.push("Include milestone markers for key deliverables")
    suggestions.push("Add resource allocation and team assignments")
    suggestions.push("Include buffer time for risk management")
    suggestions.push("Add parallel tasks to optimize timeline")
    suggestions.push("Include testing and review phases")
  }

  // Generic suggestions for any diagram type
  else {
    suggestions.push("Add more detailed labels and descriptions")
    suggestions.push("Include additional nodes to show complete workflow")
    suggestions.push("Add branching paths for different scenarios")
    suggestions.push("Include error handling and edge cases")
    suggestions.push("Add more connections to show relationships")
    suggestions.push("Include validation or checkpoint steps")
  }

  // Return only the first 3 most relevant suggestions
  return suggestions.slice(0, 3)
}

// Add this function to detect diagram type from user input or code
export function detectDiagramTypeFromCode(code: string): string {
  const lowerCode = code.toLowerCase()

  if (lowerCode.includes("sequencediagram")) return "sequence"
  if (lowerCode.includes("classdiagram")) return "class"
  if (lowerCode.includes("erdiagram")) return "er"
  if (lowerCode.includes("journey")) return "journey"
  if (lowerCode.includes("gantt")) return "gantt"
  if (lowerCode.includes("statediagram")) return "state"
  if (lowerCode.includes("pie")) return "pie"
  if (lowerCode.includes("graph") || lowerCode.includes("flowchart")) return "flowchart"

  return "flowchart" // default
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
