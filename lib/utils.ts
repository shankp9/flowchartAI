import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Sanitize and fix Mermaid code
export function sanitizeMermaidCode(code: string): string {
  try {
    // Remove any markdown code block syntax
    let cleanCode = code
      .replace(/```mermaid\s*\n?/g, "")
      .replace(/```\s*$/g, "")
      .trim()

    // Remove any extra whitespace and normalize line endings
    cleanCode = cleanCode.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

    // Fix common syntax issues
    cleanCode = fixCommonSyntaxIssues(cleanCode)

    // Detect diagram type and apply specific fixes
    const diagramType = detectDiagramType(cleanCode)

    switch (diagramType) {
      case "flowchart":
      case "graph":
        cleanCode = fixFlowchartSyntax(cleanCode)
        break
      case "sequenceDiagram":
        cleanCode = fixSequenceDiagramSyntax(cleanCode)
        break
      case "classDiagram":
        cleanCode = fixClassDiagramSyntax(cleanCode)
        break
      case "stateDiagram":
        cleanCode = fixStateDiagramSyntax(cleanCode)
        break
      case "erDiagram":
        cleanCode = fixERDiagramSyntax(cleanCode)
        break
      case "journey":
        cleanCode = fixJourneySyntax(cleanCode)
        break
      case "gantt":
        cleanCode = fixGanttSyntax(cleanCode)
        break
      case "pie":
        cleanCode = fixPieSyntax(cleanCode)
        break
      case "gitgraph":
        cleanCode = fixGitGraphSyntax(cleanCode)
        break
      default:
        // Try to convert old flowchart.js syntax to Mermaid
        cleanCode = convertOldFlowchartToMermaid(cleanCode)
        break
    }

    return cleanCode
  } catch (error) {
    console.error("Error sanitizing Mermaid code:", error)
    return code // Return original code if sanitization fails
  }
}

// Detect the type of Mermaid diagram
function detectDiagramType(code: string): string {
  const firstLine = code.split("\n")[0].trim().toLowerCase()

  if (firstLine.startsWith("graph") || firstLine.startsWith("flowchart")) {
    return "flowchart"
  } else if (firstLine.startsWith("sequencediagram")) {
    return "sequenceDiagram"
  } else if (firstLine.startsWith("classdiagram")) {
    return "classDiagram"
  } else if (firstLine.startsWith("statediagram")) {
    return "stateDiagram"
  } else if (firstLine.startsWith("erdiagram")) {
    return "erDiagram"
  } else if (firstLine.startsWith("journey")) {
    return "journey"
  } else if (firstLine.startsWith("gantt")) {
    return "gantt"
  } else if (firstLine.startsWith("pie")) {
    return "pie"
  } else if (firstLine.startsWith("gitgraph")) {
    return "gitgraph"
  }

  return "unknown"
}

// Fix common syntax issues across all diagram types
function fixCommonSyntaxIssues(code: string): string {
  // Fix quotes around node labels
  code = code.replace(/([A-Za-z0-9_]+)\s*\[\s*([^[\]]+)\s*\]/g, '$1["$2"]')

  // Fix arrow syntax
  code = code.replace(/-->/g, " --> ")
  code = code.replace(/--->/g, " ---> ")
  code = code.replace(/-\.->/g, " -.-> ")
  code = code.replace(/==>/g, " ==> ")

  // Fix node connections
  code = code.replace(/\s+--\s+/g, " -- ")
  code = code.replace(/\s+---\s+/g, " --- ")

  // Remove extra spaces
  code = code.replace(/\s+/g, " ").replace(/\n\s+/g, "\n")

  return code
}

// Fix flowchart-specific syntax
function fixFlowchartSyntax(code: string): string {
  // Ensure proper flowchart declaration
  if (!code.trim().startsWith("flowchart") && !code.trim().startsWith("graph")) {
    code = "flowchart TD\n" + code
  }

  // Fix node shapes
  code = code.replace(/\[([^\]]+)\]/g, '["$1"]')
  code = code.replace(/$$([^)]+)$$/g, '("$1")')
  code = code.replace(/\{([^}]+)\}/g, '{"$1"}')
  code = code.replace(/>\[([^\]]+)\]/g, '>["$1"]')

  return code
}

// Fix sequence diagram syntax
function fixSequenceDiagramSyntax(code: string): string {
  if (!code.trim().startsWith("sequenceDiagram")) {
    code = "sequenceDiagram\n" + code
  }

  // Fix participant declarations
  code = code.replace(/participant\s+([^\n]+)/g, (match, participant) => {
    if (!participant.includes(" as ")) {
      return `participant ${participant}`
    }
    return match
  })

  return code
}

// Fix class diagram syntax
function fixClassDiagramSyntax(code: string): string {
  if (!code.trim().startsWith("classDiagram")) {
    code = "classDiagram\n" + code
  }

  return code
}

// Fix state diagram syntax
function fixStateDiagramSyntax(code: string): string {
  if (!code.trim().startsWith("stateDiagram")) {
    code = "stateDiagram-v2\n" + code
  }

  return code
}

// Fix ER diagram syntax
function fixERDiagramSyntax(code: string): string {
  if (!code.trim().startsWith("erDiagram")) {
    code = "erDiagram\n" + code
  }

  return code
}

// Fix journey syntax
function fixJourneySyntax(code: string): string {
  if (!code.trim().startsWith("journey")) {
    code = "journey\n" + code
  }

  return code
}

// Fix Gantt syntax
function fixGanttSyntax(code: string): string {
  if (!code.trim().startsWith("gantt")) {
    code = "gantt\n" + code
  }

  return code
}

// Fix pie chart syntax
function fixPieSyntax(code: string): string {
  if (!code.trim().startsWith("pie")) {
    code = "pie title Pie Chart\n" + code
  }

  return code
}

// Fix git graph syntax
function fixGitGraphSyntax(code: string): string {
  if (!code.trim().startsWith("gitgraph")) {
    code = "gitgraph\n" + code
  }

  return code
}

// Convert old flowchart.js syntax to Mermaid
export function convertOldFlowchartToMermaid(code: string): string {
  try {
    // If it's already Mermaid syntax, return as is
    if (code.includes("flowchart") || code.includes("graph") || code.includes("sequenceDiagram")) {
      return code
    }

    // Convert old flowchart.js syntax
    let mermaidCode = "flowchart TD\n"

    const lines = code.split("\n").filter((line) => line.trim())

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith("//")) {
        continue
      }

      // Convert node definitions
      if (trimmedLine.includes("=>")) {
        const [left, right] = trimmedLine.split("=>")
        const nodeId = left.trim()
        const nodeContent = right.trim()

        if (nodeContent.includes("operation")) {
          mermaidCode += `    ${nodeId}["${nodeContent.replace("operation:", "").trim()}"]\n`
        } else if (nodeContent.includes("condition")) {
          mermaidCode += `    ${nodeId}{"${nodeContent.replace("condition:", "").trim()}"}\n`
        } else if (nodeContent.includes("start") || nodeContent.includes("end")) {
          mermaidCode += `    ${nodeId}(["${nodeContent.replace(/start:|end:/, "").trim()}"])\n`
        } else {
          mermaidCode += `    ${nodeId}["${nodeContent}"]\n`
        }
      }

      // Convert connections
      if (trimmedLine.includes("->")) {
        const [from, to] = trimmedLine.split("->")
        mermaidCode += `    ${from.trim()} --> ${to.trim()}\n`
      }
    }

    return mermaidCode
  } catch (error) {
    console.error("Error converting old flowchart syntax:", error)
    return code
  }
}

// Parse code from AI message
export function parseCodeFromMessage(message: string): string {
  // Extract code from markdown code blocks
  const codeBlockRegex = /```(?:mermaid)?\s*\n?([\s\S]*?)```/g
  const match = codeBlockRegex.exec(message)

  if (match) {
    return match[1].trim()
  }

  // If no code block found, return the message as is
  return message.trim()
}

// Serialize code for external links
export function serializeCode(code: string): string {
  try {
    return encodeURIComponent(code)
  } catch (error) {
    console.error("Error serializing code:", error)
    return ""
  }
}

// Detect diagram type from existing code
export function detectDiagramTypeFromCode(code: string): string {
  const firstLine = code.split("\n")[0].trim().toLowerCase()

  if (firstLine.startsWith("graph") || firstLine.startsWith("flowchart")) {
    return "flowchart"
  } else if (firstLine.startsWith("sequencediagram")) {
    return "sequence"
  } else if (firstLine.startsWith("classdiagram")) {
    return "class"
  } else if (firstLine.startsWith("statediagram")) {
    return "state"
  } else if (firstLine.startsWith("erdiagram")) {
    return "er"
  } else if (firstLine.startsWith("journey")) {
    return "journey"
  } else if (firstLine.startsWith("gantt")) {
    return "gantt"
  } else if (firstLine.startsWith("pie")) {
    return "pie"
  } else if (firstLine.startsWith("gitgraph")) {
    return "gitgraph"
  }

  return "flowchart" // Default fallback
}

// Validate Mermaid code syntax
export function validateMermaidCode(code: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!code || typeof code !== "string") {
    errors.push("Code is empty or not a string")
    return { isValid: false, errors }
  }

  const trimmedCode = code.trim()
  if (trimmedCode.length === 0) {
    errors.push("Code is empty after trimming")
    return { isValid: false, errors }
  }

  const lines = trimmedCode.split("\n")
  const firstLine = lines[0].trim().toLowerCase()

  // Check if it starts with a valid diagram type
  const validDiagramTypes = [
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
  ]

  const hasValidStart = validDiagramTypes.some((type) => firstLine.startsWith(type))

  if (!hasValidStart) {
    errors.push("Code does not start with a valid diagram type")
  }

  // Check for basic syntax issues
  if (trimmedCode.includes("Error:") || trimmedCode.includes("Invalid")) {
    errors.push("Code contains error messages")
  }

  // Check for minimum content
  if (lines.length < 2) {
    errors.push("Diagram appears to be incomplete (too few lines)")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// Generate context-aware suggestions based on diagram type and content
export function generateContextAwareSuggestions(code: string, diagramType: string): string[] {
  const suggestions: string[] = []

  switch (diagramType) {
    case "flowchart":
      suggestions.push(
        "Add error handling paths to the flowchart",
        "Include decision points for better flow control",
        "Add more descriptive labels to the process steps",
      )
      break
    case "sequence":
      suggestions.push(
        "Add error response scenarios",
        "Include authentication steps",
        "Add timing constraints or delays",
      )
      break
    case "class":
      suggestions.push(
        "Add method parameters and return types",
        "Include inheritance relationships",
        "Add interface implementations",
      )
      break
    case "state":
      suggestions.push("Add transition conditions", "Include error states", "Add concurrent state regions")
      break
    case "er":
      suggestions.push("Add foreign key relationships", "Include cardinality constraints", "Add attribute data types")
      break
    case "journey":
      suggestions.push(
        "Add emotional ratings to journey steps",
        "Include pain points in the journey",
        "Add touchpoint details",
      )
      break
    case "gantt":
      suggestions.push("Add task dependencies", "Include milestone markers", "Add resource allocation details")
      break
    case "pie":
      suggestions.push("Add percentage values to segments", "Include more data categories", "Add a descriptive title")
      break
    default:
      suggestions.push("Add more detail to the diagram", "Include additional connections", "Add descriptive labels")
  }

  return suggestions
}
