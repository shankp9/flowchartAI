import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Helper function to combine Tailwind CSS classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Function to serialize code for mermaid.live links
export function serializeCode(code: string): string {
  try {
    // Create a JSON object with the code
    const jsonData = {
      code: code,
      mermaid: {
        theme: "default",
      },
    }

    // Convert to base64 for URL-safe encoding
    if (typeof window !== "undefined") {
      // Browser environment
      return btoa(JSON.stringify(jsonData))
    } else {
      // Node.js environment
      return Buffer.from(JSON.stringify(jsonData)).toString("base64")
    }
  } catch (error) {
    console.error("Error serializing mermaid code:", error)
    // Fallback to simple URL encoding
    return encodeURIComponent(code)
  }
}

// Function to parse mermaid code from AI-generated messages
export function parseCodeFromMessage(message: string): string {
  // Try to extract code between \`\`\`mermaid and \`\`\` tags
  const mermaidRegex = /```(?:mermaid)?\s*([\s\S]*?)```/
  const match = message.match(mermaidRegex)

  if (match && match[1]) {
    return match[1].trim()
  }

  // If no mermaid code block found, return the original message
  return message.trim()
}

// Function to sanitize mermaid code for v11.6.0 compatibility
export function sanitizeMermaidCode(code: string): string {
  if (!code) return ""

  let sanitized = code.trim()

  // Fix common syntax issues
  sanitized = fixDiagramDeclarations(sanitized)
  sanitized = fixQuotesAndEscapeCharacters(sanitized)
  sanitized = fixBracketBalancing(sanitized)
  sanitized = fixArrowSyntax(sanitized)
  sanitized = fixSequenceDiagramNewlineIssues(sanitized)

  return sanitized
}

// Function to fix diagram declarations
function fixDiagramDeclarations(code: string): string {
  const firstLine = code.split("\n")[0].toLowerCase().trim()

  // Fix flowchart/graph declarations
  if (firstLine.startsWith("flowchart") || firstLine.startsWith("graph")) {
    // Ensure proper spacing after declaration
    if (!/^(flowchart|graph)\s+(TB|TD|BT|RL|LR)/.test(firstLine)) {
      code = code.replace(/^(flowchart|graph)(\s*)/, "$1 TD")
    }
  }

  // Fix sequence diagram declarations
  if (firstLine.includes("sequence") && !firstLine.startsWith("sequencediagram")) {
    code = code.replace(/^.*sequence.*$/i, "sequenceDiagram")
  }

  // Fix class diagram declarations
  if (firstLine.includes("class") && !firstLine.startsWith("classDiagram")) {
    code = code.replace(/^.*class.*diagram.*$/i, "classDiagram")
  }

  return code
}

// Function to fix quotes and escape special characters
function fixQuotesAndEscapeCharacters(code: string): string {
  let result = code

  // Replace unescaped HTML entities
  result = result.replace(/(?<!\\)</g, "&lt;")
  result = result.replace(/(?<!\\)>/g, "&gt;")
  result = result.replace(/(?<!\\)&(?!lt;|gt;|amp;|quot;|#\d+;)/g, "&amp;")

  // Fix unclosed quotes in node labels
  const labelRegex = /\[([^\]]*)\]/g
  result = result.replace(labelRegex, (match, label) => {
    // Count quotes in the label
    const quoteCount = (label.match(/"/g) || []).length
    if (quoteCount % 2 !== 0) {
      // Odd number of quotes, add one more
      return `[${label}"]`
    }
    return match
  })

  return result
}

// Function to fix bracket balancing
function fixBracketBalancing(code: string): string {
  const brackets = {
    "[": "]",
    "(": ")",
    "{": "}",
  }

  const lines = code.split("\n")
  const fixedLines = lines.map((line) => {
    // Skip comment lines
    if (line.trim().startsWith("%%")) return line

    // Count brackets
    const stack: string[] = []
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === "[" || char === "(" || char === "{") {
        stack.push(char)
      } else if (char === "]" || char === ")" || char === "}") {
        if (stack.length === 0) {
          // Extra closing bracket, ignore
          line = line.slice(0, i) + line.slice(i + 1)
          i--
        } else {
          const last = stack.pop()
          const expected = brackets[last as keyof typeof brackets]
          if (char !== expected) {
            // Mismatched bracket, replace with correct one
            line = line.slice(0, i) + expected + line.slice(i + 1)
          }
        }
      }
    }

    // Add missing closing brackets
    while (stack.length > 0) {
      const last = stack.pop()
      const expected = brackets[last as keyof typeof brackets]
      line += expected
    }

    return line
  })

  return fixedLines.join("\n")
}

// Function to fix arrow syntax
function fixArrowSyntax(code: string): string {
  let result = code

  // Fix incorrect arrow syntax
  result = result.replace(/--(?!>|\|)/g, "-->")
  result = result.replace(/==(?!>|\|)/g, "==>")
  result = result.replace(/~~(?!>|\|)/g, "~~>")

  // Fix missing arrow heads
  result = result.replace(/(-+|=+|~+)(?!>|\|)/g, "$1>")

  return result
}

// Function to fix sequence diagram newline issues
export function fixSequenceDiagramNewlineIssues(code: string): string {
  if (!code.toLowerCase().includes("sequencediagram")) return code

  // Fix note syntax
  let result = code.replace(/Note (left|right|over) of ([^:]+)(?!:)/g, "Note $1 of $2:")

  // Fix participant declarations
  result = result.replace(/participant ([^\s]+)(?!as)/g, "participant $1 as $1")

  return result
}

// Function to validate mermaid code
export function validateMermaidCode(code: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!code || code.trim().length === 0) {
    errors.push("Empty diagram code")
    return { isValid: false, errors }
  }

  // Check for valid diagram type
  const firstLine = code.split("\n")[0].toLowerCase().trim()
  const validDiagramTypes = [
    "graph",
    "flowchart",
    "sequencediagram",
    "classDiagram",
    "stateDiagram",
    "erDiagram",
    "journey",
    "gantt",
    "pie",
    "gitGraph",
    "mindmap",
    "timeline",
  ]

  const hasDiagramType = validDiagramTypes.some((type) => firstLine.startsWith(type))
  if (!hasDiagramType) {
    errors.push("Invalid or missing diagram type declaration")
  }

  // Check for common syntax errors
  if (code.includes("Error:") || code.includes("error:")) {
    errors.push("Error message found in diagram code")
  }

  // Check for balanced brackets
  const bracketPairs = [
    ["[", "]"],
    ["(", ")"],
    ["{", "}"],
  ]

  for (const [open, close] of bracketPairs) {
    const openCount = (code.match(new RegExp(`\\${open}`, "g")) || []).length
    const closeCount = (code.match(new RegExp(`\\${close}`, "g")) || []).length

    if (openCount !== closeCount) {
      errors.push(`Unbalanced ${open}${close} brackets: ${openCount} opening vs ${closeCount} closing`)
    }
  }

  // Check for invalid arrows
  const invalidArrows = code.match(/(-{2,}|={2,}|~{2,})(?![>|])/g)
  if (invalidArrows && invalidArrows.length > 0) {
    errors.push("Invalid arrow syntax detected")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// Function to detect diagram type from code
export function detectDiagramTypeFromCode(code: string): string {
  const firstLine = code.split("\n")[0].toLowerCase().trim()

  if (firstLine.startsWith("graph") || firstLine.startsWith("flowchart")) {
    return "flowchart"
  } else if (firstLine.startsWith("sequencediagram")) {
    return "sequence"
  } else if (firstLine.startsWith("classDiagram")) {
    return "class"
  } else if (firstLine.startsWith("stateDiagram")) {
    return "state"
  } else if (firstLine.startsWith("erDiagram")) {
    return "er"
  } else if (firstLine.startsWith("journey")) {
    return "journey"
  } else if (firstLine.startsWith("gantt")) {
    return "gantt"
  } else if (firstLine.startsWith("pie")) {
    return "pie"
  } else if (firstLine.startsWith("gitGraph")) {
    return "git"
  } else if (firstLine.startsWith("mindmap")) {
    return "mindmap"
  } else if (firstLine.startsWith("timeline")) {
    return "timeline"
  }

  return "unknown"
}

// Function to generate context-aware suggestions based on diagram type
export function generateContextAwareSuggestions(code: string, diagramType: string): string[] {
  const suggestions: string[] = []

  switch (diagramType) {
    case "flowchart":
      suggestions.push("Add a decision node with multiple paths")
      suggestions.push("Add styling to highlight important nodes")
      suggestions.push("Add a subgraph to group related nodes")
      break

    case "sequence":
      suggestions.push("Add a loop or alt section to show conditional flows")
      suggestions.push("Add notes to explain important interactions")
      suggestions.push("Add more participants to show a complete interaction")
      break

    case "class":
      suggestions.push("Add relationships between classes (inheritance, composition)")
      suggestions.push("Add methods and properties to classes")
      suggestions.push("Group related classes with annotations")
      break

    case "state":
      suggestions.push("Add transition conditions between states")
      suggestions.push("Add nested states to show hierarchical behavior")
      suggestions.push("Add entry/exit actions to states")
      break

    case "journey":
      suggestions.push("Add more detailed steps to the user journey")
      suggestions.push("Add satisfaction ratings to each step")
      suggestions.push("Add another journey section for a different user path")
      break

    case "gantt":
      suggestions.push("Add dependencies between tasks")
      suggestions.push("Add milestones to mark important dates")
      suggestions.push("Group tasks into sections by team or phase")
      break

    case "er":
      suggestions.push("Add cardinality to relationships")
      suggestions.push("Add more attributes to entities")
      suggestions.push("Add additional entities to complete the data model")
      break

    case "pie":
      suggestions.push("Add percentage values to slices")
      suggestions.push("Add a title to explain the chart's purpose")
      suggestions.push("Group smaller slices into an 'Other' category")
      break

    case "mindmap":
      suggestions.push("Add more branches to expand your ideas")
      suggestions.push("Add a second level of nodes to provide more detail")
      suggestions.push("Use different node shapes to categorize ideas")
      break

    case "timeline":
      suggestions.push("Add more events to complete the timeline")
      suggestions.push("Add sections to group related events")
      suggestions.push("Add dates to provide better context")
      break

    default:
      suggestions.push("Add more nodes to expand your diagram")
      suggestions.push("Add styling to highlight important elements")
      suggestions.push("Add a title or description to explain the diagram")
  }

  return suggestions
}
