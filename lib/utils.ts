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

    // Remove any non-printable characters and extra symbols
    cleanCode = cleanCode.replace(/[^\x20-\x7E\n]/g, "")

    // Remove any emoji or special characters that might cause parsing issues
    cleanCode = cleanCode.replace(/[✅❌🔄📊💡]/gu, "")

    // Remove any text that looks like status messages
    cleanCode = cleanCode.replace(/Diagram generated.*$/gm, "")
    cleanCode = cleanCode.replace(/Successfully.*$/gm, "")
    cleanCode = cleanCode.replace(/Error.*$/gm, "")

    // Clean up multiple spaces and newlines
    cleanCode = cleanCode.replace(/\s+/g, " ").replace(/\n\s+/g, "\n").trim()

    // Split into lines and clean each line
    const lines = cleanCode
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length === 0) {
      return "graph TD\n    A[Start] --> B[End]"
    }

    // Reconstruct the code with proper formatting
    cleanCode = lines.join("\n")

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

    // Ensure there's at least some content after the diagram type
    cleanCode = addMinimalContentForEmptyDiagram(cleanCode, diagramType)

    // Final cleanup
    cleanCode = cleanCode.trim()

    return cleanCode
  } catch (error) {
    console.error("Error sanitizing Mermaid code:", error)
    // Return a simple fallback diagram
    return "graph TD\n    A[Start] --> B[End]"
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

  return "flowchart" // Default to flowchart
}

// Fix common syntax issues across all diagram types
function fixCommonSyntaxIssues(code: string): string {
  // Remove any remaining special characters or emojis
  code = code.replace(/[^\x20-\x7E\n]/g, "")

  // Fix spacing around arrows
  code = code.replace(/\s*-->\s*/g, " --> ")
  code = code.replace(/\s*--->\s*/g, " ---> ")
  code = code.replace(/\s*-\.->\s*/g, " -.-> ")
  code = code.replace(/\s*==>\s*/g, " ==> ")
  code = code.replace(/\s*->>?\s*/g, " ->> ")
  code = code.replace(/\s*-->>?\s*/g, " -->> ")

  // Fix node connections
  code = code.replace(/\s+--\s+/g, " -- ")
  code = code.replace(/\s+---\s+/g, " --- ")

  // Clean up extra spaces but preserve line structure
  const lines = code.split("\n")
  const cleanedLines = lines
    .map((line) => {
      // Remove extra spaces but keep proper indentation
      return line.replace(/\s+/g, " ").trim()
    })
    .filter((line) => line.length > 0)

  return cleanedLines.join("\n")
}

// Fix flowchart-specific syntax
function fixFlowchartSyntax(code: string): string {
  const lines = code.split("\n")
  const firstLine = lines[0].trim().toLowerCase()

  // Ensure proper flowchart declaration
  if (!firstLine.startsWith("flowchart") && !firstLine.startsWith("graph")) {
    lines[0] = "graph TD"
  } else if (firstLine === "flowchart" || firstLine === "graph") {
    lines[0] = "graph TD"
  }

  // Rejoin and fix node syntax
  code = lines.join("\n")

  // Fix node shapes with proper spacing
  code = code.replace(/([A-Za-z0-9_]+)\s*\[\s*([^[\]]+)\s*\]/g, '$1["$2"]')
  code = code.replace(/([A-Za-z0-9_]+)\s*$$\s*([^()]+)\s*$$/g, '$1("$2")')
  code = code.replace(/([A-Za-z0-9_]+)\s*\{\s*([^{}]+)\s*\}/g, '$1{"$2"}')

  return code
}

// Fix sequence diagram syntax
function fixSequenceDiagramSyntax(code: string): string {
  const lines = code.split("\n")

  if (!lines[0].trim().toLowerCase().startsWith("sequencediagram")) {
    lines[0] = "sequenceDiagram"
  }

  return lines.join("\n")
}

// Fix class diagram syntax
function fixClassDiagramSyntax(code: string): string {
  const lines = code.split("\n")

  if (!lines[0].trim().toLowerCase().startsWith("classdiagram")) {
    lines[0] = "classDiagram"
  }

  return lines.join("\n")
}

// Fix state diagram syntax
function fixStateDiagramSyntax(code: string): string {
  const lines = code.split("\n")

  if (!lines[0].trim().toLowerCase().startsWith("statediagram")) {
    lines[0] = "stateDiagram-v2"
  }

  return lines.join("\n")
}

// Fix ER diagram syntax
function fixERDiagramSyntax(code: string): string {
  const lines = code.split("\n")

  if (!lines[0].trim().toLowerCase().startsWith("erdiagram")) {
    lines[0] = "erDiagram"
  }

  return lines.join("\n")
}

// Fix journey syntax
function fixJourneySyntax(code: string): string {
  const lines = code.split("\n")

  if (!lines[0].trim().toLowerCase().startsWith("journey")) {
    lines[0] = "journey"
  }

  return lines.join("\n")
}

// Fix Gantt syntax
function fixGanttSyntax(code: string): string {
  const lines = code.split("\n")

  if (!lines[0].trim().toLowerCase().startsWith("gantt")) {
    lines[0] = "gantt"
  }

  return lines.join("\n")
}

// Fix pie chart syntax
function fixPieSyntax(code: string): string {
  const lines = code.split("\n")

  if (!lines[0].trim().toLowerCase().startsWith("pie")) {
    lines[0] = "pie title Pie Chart"
  }

  return lines.join("\n")
}

// Fix git graph syntax
function fixGitGraphSyntax(code: string): string {
  const lines = code.split("\n")

  if (!lines[0].trim().toLowerCase().startsWith("gitgraph")) {
    lines[0] = "gitgraph"
  }

  return lines.join("\n")
}

// Convert old flowchart.js syntax to Mermaid
export function convertOldFlowchartToMermaid(code: string): string {
  try {
    // If it's already Mermaid syntax, return as is
    if (code.includes("flowchart") || code.includes("graph") || code.includes("sequenceDiagram")) {
      return code
    }

    // Convert old flowchart.js syntax
    let mermaidCode = "graph TD\n"

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
    return "graph TD\n    A[Start] --> B[End]"
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

  // Check for non-printable characters that might cause parsing issues
  if (/[^\x20-\x7E\n]/.test(trimmedCode)) {
    errors.push("Code contains non-printable characters")
    return { isValid: false, errors }
  }

  const lines = trimmedCode.split("\n").filter((line) => line.trim().length > 0)
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
    "mindmap",
    "timeline",
    "c4c",
    "c4context",
    "c4container",
    "c4component",
  ]

  const hasValidStart = validDiagramTypes.some((type) => firstLine.startsWith(type))

  if (!hasValidStart) {
    errors.push("Code does not start with a valid diagram type")
    return { isValid: false, errors }
  }

  // Check for basic syntax issues
  if (
    trimmedCode.includes("Error: Invalid Response") ||
    trimmedCode.includes("Failed to generate") ||
    trimmedCode.includes("Parse error") ||
    trimmedCode.includes("✅") ||
    trimmedCode.includes("❌") ||
    trimmedCode.includes("🔄")
  ) {
    errors.push("Code contains error messages or invalid characters")
    return { isValid: false, errors }
  }

  // Very lenient check - if we have at least a diagram type, consider it potentially valid
  if (lines.length >= 1) {
    return { isValid: true, errors: [] }
  }

  errors.push("Diagram is completely empty")
  return { isValid: false, errors }
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

// Add this helper function at the end of the file
function addMinimalContentForEmptyDiagram(code: string, diagramType: string): string {
  const lines = code.split("\n").filter((line) => line.trim().length > 0)

  // If there's only the diagram type declaration, add minimal content
  if (lines.length <= 1) {
    switch (diagramType.toLowerCase()) {
      case "flowchart":
      case "graph":
        return `${lines[0]}\n    A[Start] --> B[End]`
      case "sequencediagram":
        return `${lines[0]}\n    participant A as System\n    participant B as User\n    A->>B: Hello`
      case "classdiagram":
        return `${lines[0]}\n    class Example`
      case "statediagram":
        return `${lines[0]}\n    [*] --> State1`
      case "erdiagram":
        return `${lines[0]}\n    ENTITY`
      case "journey":
        return `${lines[0]}\n    title Journey\n    section Section\n      Task: 5: Me`
      case "gantt":
        return `${lines[0]}\n    title Schedule\n    section Section\n    Task: 2023-01-01, 1d`
      case "pie":
        return `${lines[0]}\n    "A" : 1\n    "B" : 2`
      default:
        return `${lines[0]}\n    A --> B`
    }
  }

  return code
}
