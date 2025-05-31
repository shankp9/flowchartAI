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

// Enhanced validation function for Mermaid 11.6.0
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

  // Check if it starts with a valid diagram type for v11.6.0
  const validStarts = [
    "graph",
    "flowchart",
    "sequencediagram",
    "classdiagram",
    "statediagram",
    "erdiagram",
    "journey",
    "gantt",
    "pie",
    "gitgraph",
    "mindmap",
    "timeline",
    "sankey",
    "requirementdiagram",
    "c4context",
    "c4container",
    "c4component",
    "c4dynamic",
    "c4deployment",
  ]

  const hasValidStart = validStarts.some((start) => firstLine.startsWith(start))
  if (!hasValidStart) {
    errors.push(`Invalid diagram type for Mermaid v11.6.0. Must start with one of: ${validStarts.join(", ")}`)
  }

  // Version 11.6.0 specific validation
  validateMermaidV11Compatibility(code, errors)

  // Diagram-specific validation with v11.6.0 focus
  if (firstLine.startsWith("sequencediagram")) {
    validateSequenceDiagramV11(lines.slice(1), errors)
  } else if (firstLine.startsWith("graph") || firstLine.startsWith("flowchart")) {
    validateFlowchartV11(lines.slice(1), errors)
  } else if (firstLine.startsWith("classdiagram")) {
    validateClassDiagramV11(lines.slice(1), errors)
  } else if (firstLine.startsWith("erdiagram")) {
    validateERDiagramV11(lines.slice(1), errors)
  }

  // Check for common error patterns
  const codeText = code.toLowerCase()
  if (codeText.includes("error") || codeText.includes("identifying") || codeText.includes("parse error")) {
    errors.push("Contains error keywords that will cause parsing failures")
  }

  return { isValid: errors.length === 0, errors }
}

function validateMermaidV11Compatibility(code: string, errors: string[]) {
  // Check for syntax patterns that might cause issues in v11.6.0
  const lines = code.split("\n")
  lines.forEach((line, index) => {
    const trimmedLine = line.trim()

    // Check for lines that are too complex
    if (trimmedLine.length > 300) {
      errors.push(`Line ${index + 1} is too complex and may cause parsing issues`)
    }

    // Check for unescaped special characters in labels
    if (trimmedLine.includes('"') && !trimmedLine.match(/^[^"]*"[^"]*"[^"]*$/)) {
      errors.push(`Line ${index + 1} has unmatched quotes that may cause parsing issues`)
    }

    // Check for proper bracket matching
    const openBrackets = (trimmedLine.match(/[[({]/g) || []).length
    const closeBrackets = (trimmedLine.match(/[\])}]/g) || []).length
    if (openBrackets !== closeBrackets) {
      errors.push(`Line ${index + 1} has unmatched brackets`)
    }
  })
}

function validateSequenceDiagramV11(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for arrows without senders
    if (line.match(/^\s*(--?>>?|--?\+\+|-x)/)) {
      errors.push(`Invalid sequence diagram arrow without sender: "${line}"`)
    }

    // Check for proper participant format
    if (line.startsWith("participant") && !line.match(/participant\s+[A-Za-z0-9_]+(\s+as\s+.+)?$/)) {
      errors.push(`Invalid participant declaration: "${line}"`)
    }

    // Validate message format
    if (line.includes("->>") || line.includes("-->>") || line.includes("-x")) {
      if (!line.match(/^[A-Za-z0-9_]+\s*(--?>>?|--?\+\+|-x)\s*[A-Za-z0-9_]+(\s*:\s*.+)?$/)) {
        errors.push(`Invalid sequence message format: "${line}"`)
      }
    }
  }
}

function validateFlowchartV11(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for proper arrow syntax
    if (line.includes("->") && !line.includes("-->")) {
      errors.push(`Use proper arrow syntax (-->): "${line}"`)
    }

    // Check for node definition format
    if (line.includes("[") || line.includes("{") || line.includes("(")) {
      const nodePattern = /^[A-Za-z0-9_]+[[{(].*?[\]})](\s*-->.*)?$/
      if (!nodePattern.test(line) && line.includes("-->")) {
        errors.push(`Invalid node definition format: "${line}"`)
      }
    }
  }
}

function validateClassDiagramV11(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for proper class syntax
    if (line.includes("class ") && !line.match(/^class\s+[A-Za-z0-9_]+(\s*\{.*?\})?$/)) {
      errors.push(`Invalid class declaration: "${line}"`)
    }

    // Check for relationship syntax
    if (line.includes("-->") || line.includes("<|--") || line.includes("--|>")) {
      if (!line.match(/^[A-Za-z0-9_]+\s*(<\|--|--\|>|-->|<--)\s*[A-Za-z0-9_]+(\s*:\s*.+)?$/)) {
        errors.push(`Invalid class relationship: "${line}"`)
      }
    }
  }
}

function validateERDiagramV11(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for proper entity relationship syntax
    if (line.includes("||") || line.includes("}|") || line.includes("|{")) {
      if (!line.match(/^[A-Za-z0-9_]+\s+[|}{]+[-|]+[|}{]+\s+[A-Za-z0-9_]+(\s*:\s*.+)?$/)) {
        errors.push(`Invalid ER relationship syntax: "${line}"`)
      }
    }
  }
}

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
  } else {
    suggestions.push("Add more detailed labels and descriptions")
    suggestions.push("Include additional nodes to show complete workflow")
    suggestions.push("Add branching paths for different scenarios")
    suggestions.push("Include error handling and edge cases")
    suggestions.push("Add more connections to show relationships")
    suggestions.push("Include validation or checkpoint steps")
  }

  return suggestions.slice(0, 3)
}

export function detectDiagramTypeFromCode(code: string): string {
  const lowerCode = code.toLowerCase()

  if (lowerCode.includes("sequencediagram")) return "sequence"
  if (lowerCode.includes("classdiagram")) return "class"
  if (lowerCode.includes("erdiagram")) return "er"
  if (lowerCode.includes("journey")) return "journey"
  if (lowerCode.includes("gantt")) return "gantt"
  if (lowerCode.includes("statediagram")) return "state"
  if (lowerCode.includes("pie")) return "pie"
  if (lowerCode.includes("mindmap")) return "mindmap"
  if (lowerCode.includes("timeline")) return "timeline"
  if (lowerCode.includes("sankey")) return "sankey"
  if (lowerCode.includes("requirementdiagram")) return "requirement"
  if (lowerCode.includes("c4context") || lowerCode.includes("c4container")) return "c4"
  if (lowerCode.includes("graph") || lowerCode.includes("flowchart")) return "flowchart"

  return "flowchart" // default
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

  // Find where the actual diagram starts - v11.6.0 compatible types
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
      line.startsWith("requirementdiagram") ||
      line.startsWith("c4context") ||
      line.startsWith("c4container") ||
      line.startsWith("c4component")
    ) {
      diagramStartIndex = i
      break
    }
  }

  if (diagramStartIndex > 0) {
    cleanedCode = lines.slice(diagramStartIndex).join("\n")
  }

  // Enhanced syntax cleaning for v11.6.0
  cleanedCode = cleanInvalidSyntaxV11(cleanedCode)

  // Check if this is old flowchart syntax and convert it
  if (isOldFlowchartSyntax(cleanedCode)) {
    cleanedCode = convertOldFlowchartToMermaid(cleanedCode)
  }

  // Fix common sequence diagram issues for v11.6.0
  if (cleanedCode.includes("sequenceDiagram")) {
    cleanedCode = fixSequenceDiagramSyntaxV11(cleanedCode)
  }

  // Fix common flowchart issues for v11.6.0
  if (cleanedCode.includes("graph") || cleanedCode.includes("flowchart")) {
    cleanedCode = fixFlowchartSyntaxV11(cleanedCode)
  }

  // Fix ER diagram issues for v11.6.0
  if (cleanedCode.includes("erDiagram")) {
    cleanedCode = fixERDiagramSyntaxV11(cleanedCode)
  }

  // Fix class diagram issues for v11.6.0
  if (cleanedCode.includes("classDiagram")) {
    cleanedCode = fixClassDiagramSyntaxV11(cleanedCode)
  }

  // Final v11.6.0 compatibility check and cleanup
  cleanedCode = ensureV11Compatibility(cleanedCode)

  // Enhanced line processing to fix arrow syntax issues
  cleanedCode = fixArrowSyntaxIssuesV11(cleanedCode)

  // Fix sequence diagram specific issues
  cleanedCode = fixSequenceDiagramIssuesV11(cleanedCode)

  // Remove empty lines and normalize whitespace
  cleanedCode = cleanedCode
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")

  return cleanedCode
}

function cleanInvalidSyntaxV11(code: string): string {
  let cleaned = code

  // Remove common error patterns
  cleaned = cleaned.replace(/ERROR\s*--\s*ERROR_TYPE\s*:\s*[^\n]*/gi, "")
  cleaned = cleaned.replace(/\bERROR\b/gi, "")
  cleaned = cleaned.replace(/\bIDENTIFYING\b(?!\s*:)/gi, "")

  // Fix malformed entity relationships
  cleaned = cleaned.replace(/\|\|--\|\|/g, "||--||")
  cleaned = cleaned.replace(/\}\|--\|\{/g, "}|--|{")

  // Fix arrow label syntax issues for v11.6.0
  cleaned = cleaned.replace(/-->\s*\|\s*\|\s*/g, "--> ")
  cleaned = cleaned.replace(/-->\s*\|\s*([^|]*?)\s*\|\s*\n/g, "-->|$1|\n")

  // Remove incomplete arrow labels
  cleaned = cleaned.replace(/-->\s*\|\s*$/gm, "-->")
  cleaned = cleaned.replace(/-->\s*\|([^|]*?)\s*$/gm, "-->|$1|")

  // Fix sequence diagram message syntax issues for v11.6.0
  cleaned = cleaned.replace(/(->>|-->>|-x)\s*:\s*\n/g, "$1: Message\n")
  cleaned = cleaned.replace(/(->>|-->>|-x)\s*:\s*$/gm, "$1: Message")

  // Escape special characters in labels for v11.6.0
  cleaned = cleaned.replace(/"([^"]*[<>&].*?)"/g, (match, content) => {
    return `"${content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;")}"`
  })

  // Fix broken lines and normalize spacing
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, "\n\n")
  cleaned = cleaned.replace(/\s+\n/g, "\n")
  cleaned = cleaned.replace(/\n\s+/g, "\n")

  return cleaned
}

function fixSequenceDiagramIssuesV11(code: string): string {
  if (!code.includes("sequenceDiagram")) {
    return code
  }

  const lines = code.split("\n")
  const fixedLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Skip empty lines and diagram declaration
    if (!line || line === "sequenceDiagram") {
      fixedLines.push(line)
      continue
    }

    // Handle participant declarations
    if (line.startsWith("participant")) {
      fixedLines.push(line)
      continue
    }

    // Handle sequence arrows with messages - v11.6.0 compatible
    if (line.match(/^[A-Za-z0-9_]+\s*(->>|-->>|-x)\s*[A-Za-z0-9_]+/)) {
      const arrowMatch = line.match(/^([A-Za-z0-9_]+)\s*(->>|-->>|-x)\s*([A-Za-z0-9_]+)(.*)/)
      if (arrowMatch) {
        const [, sender, arrow, receiver, messagePart] = arrowMatch

        let message = messagePart.trim()
        message = message.replace(/^:\s*/, "")

        // Ensure message is v11.6.0 compatible
        if (!message || message.includes("\n") || message.includes("|") || message.length === 0) {
          message = "Message"
        }

        // Escape special characters for v11.6.0
        message = message.replace(/[<>&]/g, (char) => {
          switch (char) {
            case "<":
              return "&lt;"
            case ">":
              return "&gt;"
            case "&":
              return "&amp;"
            default:
              return char
          }
        })

        // Limit message length
        if (message.length > 50) {
          message = message.substring(0, 47) + "..."
        }

        if (message && message !== "") {
          fixedLines.push(`${sender} ${arrow} ${receiver}: ${message}`)
        } else {
          fixedLines.push(`${sender} ${arrow} ${receiver}`)
        }
      } else {
        fixedLines.push(line)
      }
      continue
    }

    fixedLines.push(line)
  }

  return fixedLines.join("\n")
}

function fixArrowSyntaxIssuesV11(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()

    // Skip empty lines and diagram declarations
    if (
      !line ||
      line.match(
        /^(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|journey|gantt|pie|gitGraph|stateDiagram|mindmap|timeline|sankey|requirementDiagram|c4Context|c4Container|c4Component)/i,
      )
    ) {
      fixedLines.push(line)
      continue
    }

    // Fix flowchart arrow syntax issues for v11.6.0
    if (line.includes("-->") || line.includes("->")) {
      // Fix incomplete arrow labels
      line = line.replace(/-->\s*\|\s*([^|]*?)\s*\|\s*$/g, (match, label) => {
        if (!label || label.trim() === "") {
          return "-->"
        }
        // Escape special characters for v11.6.0
        const escapedLabel = label.trim().replace(/[<>&]/g, (char) => {
          switch (char) {
            case "<":
              return "&lt;"
            case ">":
              return "&gt;"
            case "&":
              return "&amp;"
            default:
              return char
          }
        })
        return `-->|${escapedLabel}|`
      })

      // Fix malformed arrow connections
      line = line.replace(/-->\s*\|\s*([^|]*?)\s*\|\s*([A-Za-z0-9_]+)/g, "-->|$1| $2")

      // Fix arrows without proper spacing
      line = line.replace(/([A-Za-z0-9_\])}]+)-->/g, "$1 -->")
      line = line.replace(/-->([A-Za-z0-9_[({]+)/g, "--> $1")

      // Fix single arrows to double arrows for v11.6.0 compatibility
      line = line.replace(/([A-Za-z0-9_\])}]+)\s*->\s*([A-Za-z0-9_[({]+)/g, "$1 --> $2")
    }

    // Remove trailing characters that might cause issues
    line = line.replace(/[,;]\s*$/, "")

    // Ensure line doesn't end with incomplete syntax
    if (
      line.endsWith("-->") ||
      line.endsWith("->") ||
      line.endsWith("->>") ||
      line.endsWith("-->>") ||
      line.endsWith("-x")
    ) {
      if (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].trim().match(/^[A-Za-z0-9_]/)) {
        const nextLine = lines[i + 1].trim()
        line = `${line} ${nextLine}`
        i++
      } else {
        line = `${line} End`
      }
    }

    fixedLines.push(line)
  }

  return fixedLines.join("\n")
}

function ensureV11Compatibility(code: string): string {
  const lines = code.split("\n")
  const processedLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()

    if (!line) continue

    // Ensure first line is a valid diagram type for v11.6.0
    if (i === 0) {
      const validFirstLines = [
        "graph",
        "flowchart",
        "sequenceDiagram",
        "classDiagram",
        "stateDiagram",
        "erDiagram",
        "journey",
        "gantt",
        "pie",
        "gitGraph",
        "mindmap",
        "timeline",
        "sankey",
        "requirementDiagram",
        "c4Context",
        "c4Container",
        "c4Component",
      ]

      const startsWithValid = validFirstLines.some((valid) => line.toLowerCase().startsWith(valid.toLowerCase()))

      if (!startsWithValid) {
        processedLines.push("graph TD")
      } else {
        processedLines.push(line)
      }
      continue
    }

    // Ensure lines don't exceed complexity limits for v11.6.0
    if (line.length > 200) {
      line = line.substring(0, 197) + "..."
    }

    // Escape special characters in node labels for v11.6.0
    line = line.replace(/\[([^\]]*[<>&].*?)\]/g, (match, content) => {
      const escaped = content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;")
      return `[${escaped}]`
    })

    processedLines.push(line)
  }

  return processedLines.join("\n")
}

function fixSequenceDiagramSyntaxV11(code: string): string {
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

    // Handle participant declarations for v11.6.0
    if (fixedLine.startsWith("participant")) {
      const participantMatch = fixedLine.match(/participant\s+([A-Za-z0-9_]+)(?:\s+as\s+(.+))?/)
      if (participantMatch) {
        const [, id, alias] = participantMatch
        participants.add(id)
        lastParticipant = id
        // Escape alias for v11.6.0 if it contains special characters
        if (alias && alias.match(/[<>&]/)) {
          const escapedAlias = alias.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;")
          fixedLine = `participant ${id} as ${escapedAlias}`
        } else {
          fixedLine = alias ? `participant ${id} as ${alias}` : `participant ${id}`
        }
      }
      fixedLines.push(fixedLine)
      continue
    }

    // Fix arrows that start without a sender
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

    // Ensure arrow syntax is v11.6.0 compatible
    const arrowMatch = fixedLine.match(/^(\w+)\s*(--?>>?|--?\+\+|-x)\s*(\w+)(.*)/)
    if (arrowMatch) {
      const [, sender, arrow, receiver, messagePart] = arrowMatch
      participants.add(sender)
      participants.add(receiver)
      lastParticipant = sender

      let message = messagePart.trim().replace(/^:\s*/, "")

      // Escape special characters for v11.6.0
      if (message && message.match(/[<>&]/)) {
        message = message.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;")
      }

      if (message && message.length > 0) {
        if (message.length > 50) {
          message = message.substring(0, 47) + "..."
        }
        fixedLine = `${sender} ${arrow} ${receiver}: ${message}`
      } else {
        fixedLine = `${sender} ${arrow} ${receiver}`
      }
    }

    fixedLines.push(fixedLine)
  }

  return fixedLines.join("\n")
}

function fixFlowchartSyntaxV11(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []

  for (const line of lines) {
    let fixedLine = line.trim()

    if (!fixedLine || fixedLine.startsWith("graph") || fixedLine.startsWith("flowchart")) {
      fixedLines.push(fixedLine)
      continue
    }

    // Ensure v11.6.0 compatible arrow syntax
    if (fixedLine.includes("-->") || fixedLine.includes("---") || fixedLine.includes("-.-")) {
      // Fix arrow label syntax for v11.6.0
      fixedLine = fixedLine.replace(/-->\s*\|\s*([^|]*?)\s*\|\s*([A-Za-z0-9_[({]+)/g, (match, label, target) => {
        // Escape special characters in labels for v11.6.0
        const escapedLabel = label.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;")
        return `-->|${escapedLabel}| ${target}`
      })

      fixedLine = fixedLine.replace(/-->\s*\|\s*\|\s*/g, "--> ")
      fixedLine = fixedLine.replace(/([A-Za-z0-9_\])}]+)-->/g, "$1 -->")
      fixedLine = fixedLine.replace(/-->([A-Za-z0-9_[({]+)/g, "--> $1")

      fixedLines.push(fixedLine)
    } else if (fixedLine.includes("->") && !fixedLine.includes("-->")) {
      // Convert single arrow to double arrow for v11.6.0
      fixedLine = fixedLine.replace(/->/g, "-->")
      fixedLine = fixedLine.replace(/([A-Za-z0-9_\])}]+)-->/g, "$1 -->")
      fixedLine = fixedLine.replace(/-->([A-Za-z0-9_[({]+)/g, "--> $1")
      fixedLines.push(fixedLine)
    } else {
      fixedLines.push(fixedLine)
    }
  }

  return fixedLines.join("\n")
}

function fixClassDiagramSyntaxV11(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []
  let inClassBlock = false

  for (let i = 0; i < lines.length; i++) {
    let fixedLine = lines[i].trim()

    if (!fixedLine || fixedLine === "classDiagram") {
      fixedLines.push(fixedLine)
      continue
    }

    // Handle class definitions for v11.6.0
    if (fixedLine.includes("class ")) {
      const classMatch = fixedLine.match(/class\s+([A-Za-z0-9_]+)/)
      if (classMatch) {
        const className = classMatch[1]

        if (fixedLine.includes("{")) {
          inClassBlock = true
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
      fixedLines.push("}")
      continue
    }

    // Handle content inside class blocks for v11.6.0
    if (inClassBlock) {
      // Escape special characters in method/attribute names
      if (fixedLine.match(/[<>&]/)) {
        fixedLine = fixedLine.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;")
      }
      fixedLines.push(`    ${fixedLine}`)
      continue
    }

    // Handle relationships for v11.6.0
    if (fixedLine.includes("-->") || fixedLine.includes("<|--") || fixedLine.includes("--|>")) {
      const relationshipMatch = fixedLine.match(/([A-Za-z0-9_]+)\s*(<\|--|--\|>|-->|<--)\s*([A-Za-z0-9_]+)(.*)/)
      if (relationshipMatch) {
        const [, class1, arrow, class2, label] = relationshipMatch
        let cleanLabel = label ? label.trim().replace(/^:\s*/, "") : ""

        // Escape special characters in relationship labels for v11.6.0
        if (cleanLabel && cleanLabel.match(/[<>&]/)) {
          cleanLabel = cleanLabel.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;")
        }

        fixedLine = cleanLabel ? `${class1} ${arrow} ${class2} : ${cleanLabel}` : `${class1} ${arrow} ${class2}`
      }
      fixedLines.push(fixedLine)
      continue
    }

    fixedLines.push(fixedLine)
  }

  if (inClassBlock) {
    fixedLines.push("}")
  }

  return fixedLines.join("\n")
}

function fixERDiagramSyntaxV11(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []

  for (const line of lines) {
    let fixedLine = line.trim()

    if (!fixedLine || fixedLine === "erDiagram") {
      fixedLines.push(fixedLine)
      continue
    }

    // Fix relationship syntax for v11.6.0
    if (fixedLine.includes("||") || fixedLine.includes("}|") || fixedLine.includes("|{")) {
      const relationshipMatch = fixedLine.match(/([A-Za-z0-9_]+)\s*([|}{]+[-|]+[|}{]+)\s*([A-Za-z0-9_]+)\s*:\s*(.+)/)
      if (relationshipMatch) {
        const [, entity1, relationship, entity2, label] = relationshipMatch
        // Escape special characters in relationship labels for v11.6.0
        const escapedLabel = label.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;")
        fixedLine = `${entity1} ${relationship} ${entity2} : ${escapedLabel}`
      }
    }

    // Fix entity attribute syntax for v11.6.0
    if (fixedLine.includes("{") && fixedLine.includes("}")) {
      const entityMatch = fixedLine.match(/([A-Za-z0-9_]+)\s*\{([^}]+)\}/)
      if (entityMatch) {
        const [, entityName, attributes] = entityMatch
        const cleanAttributes = attributes
          .split(/[,\n]/)
          .map((attr) => attr.trim())
          .filter((attr) => attr.length > 0)
          .map((attr) => {
            // Escape special characters for v11.6.0
            return attr.replace(/[<>&]/g, (char) => {
              switch (char) {
                case "<":
                  return "&lt;"
                case ">":
                  return "&gt;"
                case "&":
                  return "&amp;"
                default:
                  return char
              }
            })
          })
          .join("\n        ")

        fixedLine = `${entityName} {\n        ${cleanAttributes}\n    }`
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
    const escapedLabel = node.label.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;")

    switch (node.type) {
      case "start":
      case "end":
        nodeDefinition = `${id}((${escapedLabel}))`
        break
      case "operation":
        nodeDefinition = `${id}[${escapedLabel}]`
        break
      case "condition":
        nodeDefinition = `${id}{${escapedLabel}}`
        break
      default:
        nodeDefinition = `${id}[${escapedLabel}]`
    }
    mermaidCode += `    ${nodeDefinition}\n`
  }

  // Add connections
  for (const connection of connections) {
    mermaidCode += `    ${connection}\n`
  }

  return mermaidCode
}

export async function OpenAIStream(messages: Message[], model: OpenAIModel, apiKey: string): Promise<ReadableStream> {
  const systemMessage: Message = {
    role: "system",
    content: `You are an expert in creating Mermaid diagrams. Generate only valid Mermaid syntax based on the user's description that is compatible with Mermaid version 11.6.0 EXACTLY.
    
Available diagram types in Mermaid 11.6.0:
- Flowchart: graph TD or graph LR
- Sequence diagram: sequenceDiagram
- Class diagram: classDiagram
- User journey: journey
- Gantt chart: gantt
- State diagram: stateDiagram
- ER diagram: erDiagram
- Pie chart: pie
- Git graph: gitGraph
- Mindmap: mindmap
- Timeline: timeline
- Sankey: sankey
- Requirement diagram: requirementDiagram
- C4 diagrams: c4Context, c4Container, c4Component

CRITICAL RULES FOR MERMAID 11.6.0:
1. Always escape special characters (<, >, &) in labels using HTML entities (&lt;, &gt;, &amp;)
2. Use proper spacing around arrows and operators
3. Ensure all brackets, braces, and quotes are properly matched
4. Keep node IDs simple (alphanumeric and underscore only)
5. Limit line length to prevent parsing issues
6. Use double quotes for labels containing special characters

Always respond with valid Mermaid 11.6.0 syntax wrapped in a code block. Do not include explanations outside the code block.`,
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
      temperature: 0.2,
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
