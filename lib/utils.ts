import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ValidationResult } from "@/types/type"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Parse Mermaid code from AI response
export function parseCodeFromMessage(message: string): string {
  // Look for code blocks with mermaid, graph, or other diagram types
  const codeBlockRegex =
    /```(?:mermaid|graph|flowchart|sequence|gantt|pie|class|state|er|journey|mindmap|timeline|sankey|c4)?\s*\n?([\s\S]*?)\n?```/gi
  const match = codeBlockRegex.exec(message)

  if (match && match[1]) {
    return match[1].trim()
  }

  // If no code block found, try to extract diagram syntax directly
  const lines = message.split("\n")
  const diagramStart = lines.findIndex((line) =>
    line
      .trim()
      .match(
        /^(graph|flowchart|sequenceDiagram|gantt|pie|classDiagram|stateDiagram|erDiagram|journey|mindmap|timeline|sankey|C4Context|C4Container|C4Component|C4Dynamic)/i,
      ),
  )

  if (diagramStart !== -1) {
    return lines.slice(diagramStart).join("\n").trim()
  }

  return message.trim()
}

// Sanitize Mermaid code for v11.6.0 compatibility
export function sanitizeMermaidCode(code: string): string {
  if (!code || typeof code !== "string") {
    return ""
  }

  let sanitized = code.trim()

  // Remove any markdown code block markers
  sanitized = sanitized.replace(/^```(?:mermaid|graph|flowchart)?\s*\n?/gi, "")
  sanitized = sanitized.replace(/\n?```\s*$/gi, "")

  // Fix common v11.6.0 syntax issues
  sanitized = fixMermaidV11Syntax(sanitized)

  // Escape special characters in labels
  sanitized = escapeSpecialCharacters(sanitized)

  // Fix bracket mismatches
  sanitized = fixBracketMismatches(sanitized)

  // Remove duplicate whitespace and normalize line endings
  sanitized = sanitized.replace(/\r\n/g, "\n")
  sanitized = sanitized.replace(/\n\s*\n\s*\n/g, "\n\n")
  sanitized = sanitized.replace(/[ \t]+/g, " ")

  // Ensure proper diagram declaration
  sanitized = ensureProperDiagramDeclaration(sanitized)

  return sanitized.trim()
}

// Fix Mermaid v11.6.0 specific syntax issues
function fixMermaidV11Syntax(code: string): string {
  let fixed = code

  // Fix flowchart syntax
  fixed = fixed.replace(/^graph\s+(TD|TB|BT|RL|LR)/gm, "flowchart $1")

  // Fix sequence diagram syntax
  fixed = fixed.replace(/^sequenceDiagram\s*$/gm, "sequenceDiagram")

  // Fix class diagram syntax
  fixed = fixed.replace(/^classDiagram\s*$/gm, "classDiagram")

  // Fix state diagram syntax
  fixed = fixed.replace(/^stateDiagram\s*$/gm, "stateDiagram-v2")

  // Fix ER diagram syntax
  fixed = fixed.replace(/^erDiagram\s*$/gm, "erDiagram")

  // Fix journey syntax
  fixed = fixed.replace(/^journey\s*$/gm, "journey")

  // Fix mindmap syntax
  fixed = fixed.replace(/^mindmap\s*$/gm, "mindmap")

  // Fix timeline syntax
  fixed = fixed.replace(/^timeline\s*$/gm, "timeline")

  // Fix sankey syntax
  fixed = fixed.replace(/^sankey-beta\s*$/gm, "sankey-beta")

  // Fix C4 diagram syntax
  fixed = fixed.replace(/^C4Context\s*$/gm, "C4Context")
  fixed = fixed.replace(/^C4Container\s*$/gm, "C4Container")
  fixed = fixed.replace(/^C4Component\s*$/gm, "C4Component")
  fixed = fixed.replace(/^C4Dynamic\s*$/gm, "C4Dynamic")

  return fixed
}

// Escape special characters in labels
function escapeSpecialCharacters(code: string): string {
  let escaped = code

  // Escape HTML entities in labels
  escaped = escaped.replace(/([A-Za-z0-9_]+)\[([^\]]*[<>&][^\]]*)\]/g, (match, nodeId, label) => {
    const escapedLabel = label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    return `${nodeId}[${escapedLabel}]`
  })

  // Escape quotes in labels
  escaped = escaped.replace(/([A-Za-z0-9_]+)\[([^\]]*"[^\]]*)\]/g, (match, nodeId, label) => {
    const escapedLabel = label.replace(/"/g, "&quot;")
    return `${nodeId}[${escapedLabel}]`
  })

  return escaped
}

// Fix bracket mismatches
function fixBracketMismatches(code: string): string {
  const lines = code.split("\n")
  const fixedLines = lines.map((line) => {
    // Count brackets in each line
    const openBrackets = (line.match(/\[/g) || []).length
    const closeBrackets = (line.match(/\]/g) || []).length
    const openParens = (line.match(/\(/g) || []).length
    const closeParens = (line.match(/\)/g) || []).length
    const openBraces = (line.match(/\{/g) || []).length
    const closeBraces = (line.match(/\}/g) || []).length

    let fixed = line

    // Fix missing closing brackets
    if (openBrackets > closeBrackets) {
      fixed += "]".repeat(openBrackets - closeBrackets)
    }

    // Fix missing closing parentheses
    if (openParens > closeParens) {
      fixed += ")".repeat(openParens - closeParens)
    }

    // Fix missing closing braces
    if (openBraces > closeBraces) {
      fixed += "}".repeat(openBraces - closeBraces)
    }

    return fixed
  })

  return fixedLines.join("\n")
}

// Ensure proper diagram declaration
function ensureProperDiagramDeclaration(code: string): string {
  const lines = code.split("\n").filter((line) => line.trim())
  if (lines.length === 0) return code

  const firstLine = lines[0].trim().toLowerCase()

  // Check if first line is a valid diagram declaration
  const validDeclarations = [
    "flowchart",
    "graph",
    "sequencediagram",
    "gantt",
    "pie",
    "classDiagram",
    "statediagram",
    "statediagram-v2",
    "erdiagram",
    "journey",
    "mindmap",
    "timeline",
    "sankey-beta",
    "c4context",
    "c4container",
    "c4component",
    "c4dynamic",
  ]

  const hasValidDeclaration = validDeclarations.some((decl) => firstLine.startsWith(decl))

  if (!hasValidDeclaration) {
    // Try to detect diagram type from content
    const content = code.toLowerCase()

    if (content.includes("participant") || content.includes("->") || content.includes("->>")) {
      return `sequenceDiagram\n${code}`
    } else if (content.includes("section") || content.includes("dateformat")) {
      return `gantt\n${code}`
    } else if (content.includes("pie") || content.includes("title")) {
      return `pie title Chart\n${code}`
    } else if (content.includes("class") || content.includes("inheritance")) {
      return `classDiagram\n${code}`
    } else if (content.includes("state") || content.includes("[*]")) {
      return `stateDiagram-v2\n${code}`
    } else if (content.includes("entity") || content.includes("relationship")) {
      return `erDiagram\n${code}`
    } else if (content.includes("journey") || content.includes("section")) {
      return `journey\n${code}`
    } else {
      // Default to flowchart
      return `flowchart TD\n${code}`
    }
  }

  return code
}

// Validate Mermaid code syntax
export function validateMermaidCode(code: string): ValidationResult {
  const errors: string[] = []

  if (!code || typeof code !== "string") {
    errors.push("Empty or invalid code")
    return { isValid: false, errors }
  }

  const trimmedCode = code.trim()
  if (trimmedCode.length === 0) {
    errors.push("Empty diagram code")
    return { isValid: false, errors }
  }

  // Check for valid diagram declaration
  const lines = trimmedCode.split("\n").filter((line) => line.trim())
  if (lines.length === 0) {
    errors.push("No content found")
    return { isValid: false, errors }
  }

  const firstLine = lines[0].trim().toLowerCase()
  const validDeclarations = [
    "flowchart",
    "graph",
    "sequencediagram",
    "gantt",
    "pie",
    "classDiagram",
    "statediagram",
    "statediagram-v2",
    "erdiagram",
    "journey",
    "mindmap",
    "timeline",
    "sankey-beta",
    "c4context",
    "c4container",
    "c4component",
    "c4dynamic",
  ]

  const hasValidDeclaration = validDeclarations.some((decl) => firstLine.startsWith(decl))
  if (!hasValidDeclaration) {
    errors.push("Missing or invalid diagram type declaration")
  }

  // Check for basic syntax issues
  const bracketBalance = checkBracketBalance(trimmedCode)
  if (!bracketBalance.isBalanced) {
    errors.push(`Unbalanced brackets: ${bracketBalance.error}`)
  }

  // Check for common syntax errors
  const syntaxErrors = checkCommonSyntaxErrors(trimmedCode)
  errors.push(...syntaxErrors)

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// Check bracket balance
function checkBracketBalance(code: string): { isBalanced: boolean; error?: string } {
  const brackets = { "[": "]", "(": ")", "{": "}" }
  const stack: string[] = []

  for (const char of code) {
    if (char in brackets) {
      stack.push(char)
    } else if (Object.values(brackets).includes(char)) {
      const last = stack.pop()
      if (!last || brackets[last as keyof typeof brackets] !== char) {
        return { isBalanced: false, error: `Mismatched ${char}` }
      }
    }
  }

  if (stack.length > 0) {
    return { isBalanced: false, error: `Unclosed ${stack[stack.length - 1]}` }
  }

  return { isBalanced: true }
}

// Check for common syntax errors
function checkCommonSyntaxErrors(code: string): string[] {
  const errors: string[] = []
  const lines = code.split("\n")

  lines.forEach((line, index) => {
    const trimmedLine = line.trim()
    if (!trimmedLine) return

    // Check for invalid characters in node IDs
    const nodeIdMatch = trimmedLine.match(/^([A-Za-z0-9_]+)/)
    if (nodeIdMatch && /[^A-Za-z0-9_]/.test(nodeIdMatch[1])) {
      errors.push(`Line ${index + 1}: Invalid characters in node ID "${nodeIdMatch[1]}"`)
    }

    // Check for missing arrows in connections
    if (trimmedLine.includes("-->") || trimmedLine.includes("->") || trimmedLine.includes("->>")) {
      // Valid connection syntax
    } else if (trimmedLine.includes(" - ") && !trimmedLine.includes("--")) {
      errors.push(`Line ${index + 1}: Possible missing arrow in connection`)
    }
  })

  return errors
}

// Generate context-aware suggestions
export function generateContextAwareSuggestions(code: string, diagramType: string): string[] {
  const suggestions: string[] = []

  switch (diagramType) {
    case "flowchart":
    case "graph":
      suggestions.push(
        "Add decision points with diamond shapes",
        "Include error handling paths",
        "Add styling with CSS classes",
      )
      break
    case "sequence":
      suggestions.push("Add activation boxes for lifelines", "Include error scenarios", "Add notes for clarification")
      break
    case "class":
      suggestions.push(
        "Add method parameters and return types",
        "Include inheritance relationships",
        "Add interface implementations",
      )
      break
    case "state":
      suggestions.push("Add transition conditions", "Include composite states", "Add entry/exit actions")
      break
    case "er":
      suggestions.push("Add relationship cardinalities", "Include attribute types", "Add foreign key relationships")
      break
    case "gantt":
      suggestions.push("Add task dependencies", "Include milestones", "Add resource assignments")
      break
    case "journey":
      suggestions.push("Add emotional ratings", "Include touchpoints", "Add pain points")
      break
    default:
      suggestions.push("Add more detail to the diagram", "Include additional connections", "Add descriptive labels")
  }

  return suggestions
}

// Detect diagram type from code
export function detectDiagramTypeFromCode(code: string): string {
  const firstLine = code.trim().split("\n")[0].toLowerCase()

  if (firstLine.startsWith("flowchart") || firstLine.startsWith("graph")) {
    return "flowchart"
  } else if (firstLine.startsWith("sequencediagram")) {
    return "sequence"
  } else if (firstLine.startsWith("classDiagram")) {
    return "class"
  } else if (firstLine.startsWith("statediagram")) {
    return "state"
  } else if (firstLine.startsWith("erdiagram")) {
    return "er"
  } else if (firstLine.startsWith("gantt")) {
    return "gantt"
  } else if (firstLine.startsWith("pie")) {
    return "pie"
  } else if (firstLine.startsWith("journey")) {
    return "journey"
  } else if (firstLine.startsWith("mindmap")) {
    return "mindmap"
  } else if (firstLine.startsWith("timeline")) {
    return "timeline"
  } else if (firstLine.startsWith("sankey")) {
    return "sankey"
  } else if (firstLine.startsWith("c4")) {
    return "c4"
  }

  // Try to detect from content
  const content = code.toLowerCase()
  if (content.includes("participant") || content.includes("->") || content.includes("->>")) {
    return "sequence"
  } else if (content.includes("class") || content.includes("inheritance")) {
    return "class"
  } else if (content.includes("state") || content.includes("[*]")) {
    return "state"
  } else if (content.includes("entity") || content.includes("relationship")) {
    return "er"
  } else if (content.includes("section") && content.includes("dateformat")) {
    return "gantt"
  } else if (content.includes("pie") && content.includes("title")) {
    return "pie"
  } else if (content.includes("journey") && content.includes("section")) {
    return "journey"
  }

  return "flowchart" // default
}

// Fix sequence diagram newline issues (legacy function for compatibility)
export function fixSequenceDiagramNewlineIssues(code: string): string {
  return sanitizeMermaidCode(code)
}
