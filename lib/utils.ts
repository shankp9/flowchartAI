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

// Enhanced validation function with detailed error reporting for Mermaid 10.9.3
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

  // Check if it starts with a valid diagram type for v10.9.3
  const validStarts = [
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
  ]

  const hasValidStart = validStarts.some((start) => firstLine.startsWith(start))
  if (!hasValidStart) {
    errors.push(`Invalid diagram type for Mermaid v10.9.3. Must start with one of: ${validStarts.join(", ")}`)
  }

  // Version 10.9.3 specific validation
  validateMermaidV10Compatibility(code, errors)

  // Diagram-specific validation with v10.9.3 focus
  if (firstLine.startsWith("sequencediagram")) {
    validateSequenceDiagramV10(lines.slice(1), errors)
  } else if (firstLine.startsWith("graph") || firstLine.startsWith("flowchart")) {
    validateFlowchartV10(lines.slice(1), errors)
  } else if (firstLine.startsWith("classdiagram")) {
    validateClassDiagramV10(lines.slice(1), errors)
  } else if (firstLine.startsWith("erdiagram")) {
    validateERDiagramV10(lines.slice(1), errors)
  }

  // Check for common error patterns and incompatible features
  const codeText = code.toLowerCase()
  if (codeText.includes("error") || codeText.includes("identifying") || codeText.includes("parse error")) {
    errors.push("Contains error keywords that will cause parsing failures")
  }

  // Check for v10.9.3 incompatible features
  if (codeText.includes("%%{") || codeText.includes("config:")) {
    errors.push("Configuration syntax not compatible with v10.9.3")
  }

  if (codeText.includes("click ") && !codeText.includes("sequencediagram")) {
    errors.push("Click events may not be compatible with v10.9.3")
  }

  return { isValid: errors.length === 0, errors }
}

function validateMermaidV10Compatibility(code: string, errors: string[]) {
  // Check for potentially incompatible syntax patterns for v10.9.3
  const incompatiblePatterns = [
    { pattern: /%%\{.*?\}%%/g, message: "Configuration blocks not supported in v10.9.3" },
    { pattern: /classDef\s+\w+\s+.*?;/g, message: "classDef styling may cause issues in v10.9.3" },
    { pattern: /linkStyle\s+\d+/g, message: "linkStyle may not be compatible with v10.9.3" },
    { pattern: /subgraph\s+\w+\s*\[.*?\]/g, message: "Complex subgraph syntax may cause issues" },
    { pattern: /direction\s+(TB|TD|BT|RL|LR)/gi, message: "Direction command may not be supported in v10.9.3" },
    { pattern: /flowchart-v2/gi, message: "Flowchart-v2 syntax not compatible with v10.9.3" },
    { pattern: /requirementDiagram/gi, message: "requirementDiagram not available in v10.9.3" },
    { pattern: /c4Context|c4Container|c4Component/gi, message: "C4 diagrams not available in v10.9.3" },
    {
      pattern: /mindmap|timeline|quadrantChart|sankey|block|xy/gi,
      message: "Advanced diagram types not available in v10.9.3",
    },
  ]

  incompatiblePatterns.forEach(({ pattern, message }) => {
    if (pattern.test(code)) {
      errors.push(message)
    }
  })

  // Check for overly complex syntax that might cause issues
  const lines = code.split("\n")
  lines.forEach((line, index) => {
    const trimmedLine = line.trim()

    // Check for lines that are too complex
    if (trimmedLine.length > 200) {
      errors.push(`Line ${index + 1} is too complex and may cause parsing issues`)
    }

    // Check for too many special characters
    const specialCharCount = (trimmedLine.match(/[{}[\]()'"`;:]/g) || []).length
    if (specialCharCount > 10) {
      errors.push(`Line ${index + 1} has too many special characters and may cause parsing issues`)
    }
  })
}

function validateSequenceDiagramV10(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for arrows without senders (common v10.9.3 issue)
    if (line.match(/^\s*(--?>>?|--?\+\+|-x)/)) {
      errors.push(`Invalid sequence diagram arrow without sender (v10.9.3 incompatible): "${line}"`)
    }

    // Check for proper participant format for v10.9.3
    if (line.startsWith("participant") && !line.match(/participant\s+[A-Za-z0-9_]+(\s+as\s+.+)?$/)) {
      errors.push(`Invalid participant declaration for v10.9.3: "${line}"`)
    }

    // Check for v10.9.3 incompatible sequence features
    if (line.includes("rect ") || line.includes("opt ") || line.includes("alt ")) {
      errors.push(`Advanced sequence features may not be compatible with v10.9.3: "${line}"`)
    }
  }
}

function validateFlowchartV10(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for v10.9.3 compatible arrow syntax only
    const hasValidArrows =
      line.includes("-->") ||
      line.includes("---") ||
      line.includes("-.-") ||
      line.includes("==>") ||
      line.includes("-.->") ||
      line.includes("=.=>")

    if (line.includes("->") && !hasValidArrows) {
      errors.push(`Use proper v10.9.3 arrow syntax (-->, ---, -.-): "${line}"`)
    }

    // Check for overly complex node definitions
    if (line.match(/\[.*?\].*?\[.*?\]/)) {
      errors.push(`Complex node definitions may cause v10.9.3 issues: "${line}"`)
    }
  }
}

function validateClassDiagramV10(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for proper class syntax for v10.9.3
    if (line.includes("class ") && !line.match(/^class\s+[A-Za-z0-9_]+(\s*\{.*?\})?$/)) {
      errors.push(`Invalid class declaration for v10.9.3: "${line}"`)
    }

    // Check for v10.9.3 incompatible class features
    if (line.includes("<<") && line.includes(">>")) {
      errors.push(`Stereotype syntax may not be compatible with v10.9.3: "${line}"`)
    }

    // Ensure class definitions and relationships are separate
    if (line.includes("class ") && (line.includes("-->") || line.includes("--|>"))) {
      errors.push(`Separate class definitions from relationships for v10.9.3 compatibility: "${line}"`)
    }
  }
}

function validateERDiagramV10(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for proper entity relationship syntax for v10.9.3
    if (line.includes("||") || line.includes("}|") || line.includes("|{")) {
      if (!line.match(/^[A-Za-z0-9_]+\s+[|}{]+[-|]+[|}{]+\s+[A-Za-z0-9_]+(\s*:\s*.+)?$/)) {
        errors.push(`Invalid ER relationship syntax for v10.9.3: "${line}"`)
      }
    }

    // Check for entity definitions
    if (line.includes("{") && !line.match(/^[A-Za-z0-9_]+\s*\{[\s\S]*?\}$/)) {
      errors.push(`Invalid entity definition for v10.9.3: "${line}"`)
    }
  }
}

// Add this new function after the existing validation functions

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

  // Find where the actual diagram starts - only v10.9.3 compatible types
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
      line.startsWith("gitgraph")
    ) {
      diagramStartIndex = i
      break
    }
  }

  if (diagramStartIndex > 0) {
    cleanedCode = lines.slice(diagramStartIndex).join("\n")
  }

  // Remove v10.9.3 incompatible features
  cleanedCode = removeIncompatibleFeaturesV10(cleanedCode)

  // Check if this is old flowchart syntax and convert it
  if (isOldFlowchartSyntax(cleanedCode)) {
    cleanedCode = convertOldFlowchartToMermaid(cleanedCode)
  }

  // Enhanced syntax cleaning and validation for v10.9.3
  cleanedCode = cleanInvalidSyntaxV10(cleanedCode)

  // Fix common sequence diagram issues - CRITICAL FIX
  if (cleanedCode.includes("sequenceDiagram")) {
    cleanedCode = fixSequenceDiagramSyntaxV10(cleanedCode)
  }

  // Fix common flowchart issues
  if (cleanedCode.includes("graph") || cleanedCode.includes("flowchart")) {
    cleanedCode = fixFlowchartSyntaxV10(cleanedCode)
  }

  // Fix ER diagram issues
  if (cleanedCode.includes("erDiagram")) {
    cleanedCode = fixERDiagramSyntaxV10(cleanedCode)
  }

  // Fix class diagram issues - ENHANCED for v10.9.3
  if (cleanedCode.includes("classDiagram")) {
    cleanedCode = fixClassDiagramSyntaxV10(cleanedCode)
  }

  // Final v10.9.3 compatibility check and cleanup
  cleanedCode = ensureV10Compatibility(cleanedCode)

  // Enhanced line processing to fix arrow syntax issues - CRITICAL FIX
  cleanedCode = fixArrowSyntaxIssuesV10(cleanedCode)

  // CRITICAL: Fix sequence diagram specific newline issues
  cleanedCode = fixSequenceDiagramNewlineIssues(cleanedCode)

  // Remove empty lines and normalize whitespace
  cleanedCode = cleanedCode
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")

  return cleanedCode
}

// NEW FUNCTION: Fix sequence diagram newline issues that cause parse errors
function fixSequenceDiagramNewlineIssues(code: string): string {
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

    // CRITICAL FIX: Handle sequence arrows with messages
    if (line.match(/^[A-Za-z0-9_]+\s*(->>|-->>|-x)\s*[A-Za-z0-9_]+/)) {
      // Check if the line has a message part
      const arrowMatch = line.match(/^([A-Za-z0-9_]+)\s*(->>|-->>|-x)\s*([A-Za-z0-9_]+)(.*)/)
      if (arrowMatch) {
        const [, sender, arrow, receiver, messagePart] = arrowMatch

        // Clean up the message part
        let message = messagePart.trim()

        // Remove leading colon and whitespace
        message = message.replace(/^:\s*/, "")

        // If message is empty or contains problematic characters, provide a default
        if (!message || message.includes("\n") || message.includes("|") || message.length === 0) {
          message = "Message"
        }

        // Ensure message doesn't contain characters that cause parsing issues
        message = message.replace(/[|{}[\]]/g, "").trim()

        // Limit message length to prevent parsing issues
        if (message.length > 50) {
          message = message.substring(0, 47) + "..."
        }

        // Reconstruct the line with proper format
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

    // Handle other sequence diagram elements
    if (line.includes("Note") || line.includes("activate") || line.includes("deactivate")) {
      fixedLines.push(line)
      continue
    }

    // Default: add the line as-is if it doesn't match sequence patterns
    fixedLines.push(line)
  }

  return fixedLines.join("\n")
}

function fixArrowSyntaxIssuesV10(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()

    // Skip empty lines and diagram declarations
    if (
      !line ||
      line.match(/^(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|journey|gantt|pie|gitGraph|stateDiagram)/i)
    ) {
      fixedLines.push(line)
      continue
    }

    // CRITICAL FIX: Handle sequence diagram arrows specifically
    if (code.includes("sequenceDiagram") && line.match(/^[A-Za-z0-9_]+\s*(->>|-->>|-x)/)) {
      // This is handled by fixSequenceDiagramNewlineIssues, so just pass through
      fixedLines.push(line)
      continue
    }

    // Fix flowchart arrow syntax issues for v10.9.3
    if (line.includes("-->") || line.includes("->")) {
      // Fix incomplete arrow labels that might cause parse errors
      line = line.replace(/-->\s*\|\s*([^|]*?)\s*\|\s*$/g, (match, label) => {
        // If label is empty or just whitespace, remove the label syntax
        if (!label || label.trim() === "") {
          return "-->"
        }
        // Ensure proper label format for v10.9.3
        return `-->|${label.trim()}|`
      })

      // Fix malformed arrow connections
      line = line.replace(/-->\s*\|\s*([^|]*?)\s*\|\s*([A-Za-z0-9_]+)/g, "-->|$1| $2")

      // Fix arrows without proper spacing
      line = line.replace(/([A-Za-z0-9_\])}]+)-->/g, "$1 -->")
      line = line.replace(/-->([A-Za-z0-9_[({]+)/g, "--> $1")

      // Fix single arrows to double arrows for better v10.9.3 compatibility
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
      // If next line exists and looks like a continuation, merge them
      if (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].trim().match(/^[A-Za-z0-9_]/)) {
        const nextLine = lines[i + 1].trim()
        line = `${line} ${nextLine}`
        i++ // Skip the next line since we merged it
      } else {
        // Add a default target if arrow is incomplete
        line = `${line} End`
      }
    }

    fixedLines.push(line)
  }

  return fixedLines.join("\n")
}

function removeIncompatibleFeaturesV10(code: string): string {
  let cleaned = code

  // Remove configuration blocks
  cleaned = cleaned.replace(/%%\{[\s\S]*?\}%%/g, "")

  // Remove styling commands that may cause issues in v10.9.3
  cleaned = cleaned.replace(/classDef\s+\w+\s+[^;]*;/g, "")
  cleaned = cleaned.replace(/linkStyle\s+\d+[^;]*;/g, "")

  // Remove click events that may cause issues in v10.9.3
  cleaned = cleaned.replace(/click\s+\w+\s+[^;]*;/g, "")

  // Remove direction commands that may not be supported in v10.9.3
  cleaned = cleaned.replace(/direction\s+(TB|TD|BT|RL|LR)/gi, "")

  // Remove subgraph complex syntax
  cleaned = cleaned.replace(/subgraph\s+\w+\s*\[.*?\]/g, "subgraph")

  // Remove features not available in v10.9.3
  cleaned = cleaned.replace(/requirementDiagram/gi, "graph TD")
  cleaned = cleaned.replace(/c4Context|c4Container|c4Component|c4Dynamic|c4Deployment/gi, "graph TD")
  cleaned = cleaned.replace(/mindmap|timeline|quadrantChart|sankey|block|xy/gi, "graph TD")

  return cleaned
}

function cleanInvalidSyntaxV10(code: string): string {
  let cleaned = code

  // Remove common error patterns
  cleaned = cleaned.replace(/ERROR\s*--\s*ERROR_TYPE\s*:\s*[^\n]*/gi, "")
  cleaned = cleaned.replace(/\bERROR\b/gi, "")
  cleaned = cleaned.replace(/\bIDENTIFYING\b(?!\s*:)/gi, "")
  cleaned = cleaned.replace(/\bBelo\b/gi, "")

  // Fix malformed entity relationships
  cleaned = cleaned.replace(/\|\|--\|\|/g, "||--||")
  cleaned = cleaned.replace(/\}\|--\|\{/g, "}|--|{")

  // Fix class diagram specific issues for v10.9.3
  cleaned = cleaned.replace(/\}\s*class\s+/g, "}\n    class ")
  cleaned = cleaned.replace(/\}\s*(\w+)\s*-->/g, "}\n    $1 -->")

  // Fix arrow label syntax issues for v10.9.3
  cleaned = cleaned.replace(/-->\s*\|\s*\|\s*/g, "--> ")
  cleaned = cleaned.replace(/-->\s*\|\s*([^|]*?)\s*\|\s*\n/g, "-->|$1|\n")

  // Remove incomplete arrow labels
  cleaned = cleaned.replace(/-->\s*\|\s*$/gm, "-->")
  cleaned = cleaned.replace(/-->\s*\|([^|]*?)\s*$/gm, "-->|$1|")

  // CRITICAL: Fix sequence diagram message syntax issues
  cleaned = cleaned.replace(/(->>|-->>|-x)\s*:\s*\n/g, "$1: Message\n")
  cleaned = cleaned.replace(/(->>|-->>|-x)\s*:\s*$/gm, "$1: Message")

  // Remove any remaining problematic characters for v10.9.3
  cleaned = cleaned.replace(/[^\w\s\-><|{}[\]$$$$:;.,"'`~!@#$%^&*+=/\\?()\n]/g, "")

  // Fix broken lines and normalize spacing
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, "\n\n")
  cleaned = cleaned.replace(/\s+\n/g, "\n")
  cleaned = cleaned.replace(/\n\s+/g, "\n")

  return cleaned
}

function ensureV10Compatibility(code: string): string {
  const compatible = code

  // Ensure basic diagram structure
  const lines = compatible.split("\n")
  const processedLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()

    // Skip empty lines
    if (!line) continue

    // Ensure first line is a valid diagram type for v10.9.3
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
      ]
      const startsWithValid = validFirstLines.some(
        (valid) =>
          line.toLowerCase().startsWith(valid.toLowerCase()) || line.toLowerCase().includes(valid.toLowerCase()),
      )

      if (!startsWithValid) {
        // Default to flowchart if no valid start
        if (line.trim().length > 0) {
          processedLines.push(line)
        } else {
          processedLines.push("graph TD")
        }
      } else {
        processedLines.push(line)
      }
      continue
    }

    // Ensure lines don't exceed complexity limits
    if (line.length > 150) {
      line = line.substring(0, 147) + "..."
    }

    // Remove any remaining problematic syntax
    line = line.replace(/[^\w\s\-><|{}[\]().:;,"'`~!@#$%^&*+=/?\\]/g, "")

    processedLines.push(line)
  }

  return processedLines.join("\n")
}

function fixSequenceDiagramSyntaxV10(code: string): string {
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

    // Handle participant declarations - ensure v10.9.3 compatibility
    if (fixedLine.startsWith("participant")) {
      // Ensure simple participant syntax
      const participantMatch = fixedLine.match(/participant\s+([A-Za-z0-9_]+)(?:\s+as\s+(.+))?/)
      if (participantMatch) {
        const [, id, alias] = participantMatch
        participants.add(id)
        lastParticipant = id
        fixedLine = alias ? `participant ${id} as ${alias}` : `participant ${id}`
      } else {
        // Fix malformed participant
        const simpleMatch = fixedLine.match(/participant\s+(\w+)/)
        if (simpleMatch) {
          const id = simpleMatch[1]
          participants.add(id)
          lastParticipant = id
          fixedLine = `participant ${id}`
        }
      }
      fixedLines.push(fixedLine)
      continue
    }

    // Fix arrows that start without a sender (critical for v10.9.3)
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

    // CRITICAL: Ensure arrow syntax is v10.9.3 compatible and handles messages properly
    const arrowMatch = fixedLine.match(/^(\w+)\s*(--?>>?|--?\+\+|-x)\s*(\w+)(.*)/)
    if (arrowMatch) {
      const [, sender, arrow, receiver, messagePart] = arrowMatch
      participants.add(sender)
      participants.add(receiver)
      lastParticipant = sender

      // Clean up the message part for v10.9.3 compatibility
      let message = messagePart.trim()

      // Remove leading colon and whitespace
      message = message.replace(/^:\s*/, "")

      // Ensure message doesn't contain problematic characters
      message = message.replace(/[|{}[\]\n]/g, "").trim()

      // If message is empty, don't include the colon
      if (message && message.length > 0) {
        // Limit message length to prevent parsing issues
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

function fixFlowchartSyntaxV10(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []

  for (const line of lines) {
    let fixedLine = line.trim()

    // Skip empty lines and graph declaration
    if (!fixedLine || fixedLine.startsWith("graph") || fixedLine.startsWith("flowchart")) {
      fixedLines.push(fixedLine)
      continue
    }

    // Ensure v10.9.3 compatible arrow syntax
    if (fixedLine.includes("-->") || fixedLine.includes("---") || fixedLine.includes("-.-")) {
      // Fix arrow label syntax for v10.9.3
      fixedLine = fixedLine.replace(/-->\s*\|\s*([^|]*?)\s*\|\s*([A-Za-z0-9_[({]+)/g, "-->|$1| $2")
      fixedLine = fixedLine.replace(/-->\s*\|\s*\|\s*/g, "--> ")

      // Ensure proper spacing
      fixedLine = fixedLine.replace(/([A-Za-z0-9_\])}]+)-->/g, "$1 -->")
      fixedLine = fixedLine.replace(/-->([A-Za-z0-9_[({]+)/g, "--> $1")

      fixedLines.push(fixedLine)
    } else if (fixedLine.includes("->") && !fixedLine.includes("-->")) {
      // Convert single arrow to double arrow for v10.9.3
      fixedLine = fixedLine.replace(/->/g, "-->")
      fixedLine = fixedLine.replace(/([A-Za-z0-9_\])}]+)-->/g, "$1 -->")
      fixedLine = fixedLine.replace(/-->([A-Za-z0-9_[({]+)/g, "--> $1")
      fixedLines.push(fixedLine)
    } else if (
      fixedLine.match(/^\s*\w+.*\w+\s*$/) &&
      !fixedLine.includes("-->") &&
      !fixedLine.includes("[") &&
      !fixedLine.includes("{") &&
      !fixedLine.includes("(")
    ) {
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

function fixClassDiagramSyntaxV10(code: string): string {
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

    // Handle class definitions with v10.9.3 compatibility
    if (fixedLine.includes("class ")) {
      // Extract class name and ensure v10.9.3 compatibility
      const classMatch = fixedLine.match(/class\s+([A-Za-z0-9_]+)/)
      if (classMatch) {
        const className = classMatch[1]

        // Check for malformed class block that causes issues in v10.9.3
        const malformedMatch = fixedLine.match(/class\s+([A-Za-z0-9_]+)\s*\{\s*\}(.+)/)
        if (malformedMatch) {
          const [, name, remainder] = malformedMatch
          // Split into proper v10.9.3 class definition and separate line
          fixedLines.push(`class ${name} {`)
          fixedLines.push("}")

          // Handle the remainder properly for v10.9.3
          const remainderTrimmed = remainder.trim()
          if (remainderTrimmed) {
            if (remainderTrimmed.includes("-->") || remainderTrimmed.includes("<|--")) {
              fixedLines.push(`    ${remainderTrimmed}`)
            } else if (remainderTrimmed.startsWith("class ")) {
              fixedLines.push(`    ${remainderTrimmed}`)
            } else {
              // Treat as another class
              fixedLines.push(`    class ${remainderTrimmed}`)
            }
          }
          continue
        }

        // Normal class definition for v10.9.3
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

      // Handle content after closing brace for v10.9.3
      const afterBrace = fixedLine.substring(fixedLine.indexOf("}") + 1).trim()
      if (afterBrace) {
        if (afterBrace.includes("-->") || afterBrace.includes("<|--")) {
          fixedLines.push(`    ${afterBrace}`)
        } else if (afterBrace.startsWith("class ")) {
          fixedLines.push(`    ${afterBrace}`)
        } else {
          fixedLines.push(`    class ${afterBrace}`)
        }
      }
      continue
    }

    // Handle content inside class blocks with v10.9.3 compatibility
    if (inClassBlock) {
      // Ensure simple member syntax for v10.9.3
      if (fixedLine.includes("(") && fixedLine.includes(")")) {
        // Method definition - keep simple for v10.9.3
        fixedLine = fixedLine.replace(/\s+/g, " ")
      }
      fixedLines.push(`    ${fixedLine}`)
      continue
    }

    // Handle relationships with v10.9.3 compatibility
    if (fixedLine.includes("-->") || fixedLine.includes("<|--") || fixedLine.includes("--|>")) {
      // Ensure simple relationship syntax for v10.9.3
      const relationshipMatch = fixedLine.match(/([A-Za-z0-9_]+)\s*(<\|--|--\|>|-->|<--)\s*([A-Za-z0-9_]+)(.*)/)
      if (relationshipMatch) {
        const [, class1, arrow, class2, label] = relationshipMatch
        const cleanLabel = label ? ` : ${label.trim().replace(/^:\s*/, "")}` : ""
        fixedLine = `${class1} ${arrow} ${class2}${cleanLabel}`
      }
      fixedLines.push(fixedLine)
      continue
    }

    // Handle standalone class names
    if (fixedLine.match(/^[A-Za-z0-9_]+$/) && !fixedLine.includes("-->")) {
      fixedLines.push(`class ${fixedLine}`)
      continue
    }

    // Default: add the line as-is
    fixedLines.push(fixedLine)
  }

  // Ensure any unclosed class blocks are closed for v10.9.3
  if (inClassBlock) {
    fixedLines.push("}")
  }

  return fixedLines.join("\n")
}

function fixERDiagramSyntaxV10(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []

  for (const line of lines) {
    let fixedLine = line.trim()

    // Skip empty lines and diagram declaration
    if (!fixedLine || fixedLine === "erDiagram") {
      fixedLines.push(fixedLine)
      continue
    }

    // Fix entity definitions for v10.9.3
    if (fixedLine.includes("{") && !fixedLine.includes("}")) {
      // Multi-line entity definition
      fixedLines.push(fixedLine)
      continue
    }

    // Fix relationship syntax for v10.9.3
    if (fixedLine.includes("||") || fixedLine.includes("}|") || fixedLine.includes("|{")) {
      // Ensure proper v10.9.3 relationship format
      const relationshipMatch = fixedLine.match(/([A-Za-z0-9_]+)\s*([|}{]+[-|]+[|}{]+)\s*([A-Za-z0-9_]+)\s*:\s*(.+)/)
      if (relationshipMatch) {
        const [, entity1, relationship, entity2, label] = relationshipMatch
        fixedLine = `${entity1} ${relationship} ${entity2} : ${label}`
      }
    }

    // Fix entity attribute syntax for v10.9.3
    if (fixedLine.includes("{") && fixedLine.includes("}")) {
      const entityMatch = fixedLine.match(/([A-Za-z0-9_]+)\s*\{([^}]+)\}/)
      if (entityMatch) {
        const [, entityName, attributes] = entityMatch
        const cleanAttributes = attributes
          .split(/[,\n]/)
          .map((attr) => attr.trim())
          .filter((attr) => attr.length > 0)
          .map((attr) => {
            // Simple attribute format for v10.9.3
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

export async function OpenAIStream(messages: Message[], model: OpenAIModel, apiKey: string): Promise<ReadableStream> {
  const systemMessage: Message = {
    role: "system",
    content: `You are an expert in creating Mermaid diagrams. Generate only valid Mermaid syntax based on the user's description that is compatible with Mermaid version 10.9.3 EXACTLY.
    
Available diagram types in Mermaid 10.9.3:
- Flowchart: graph TD or graph LR
- Sequence diagram: sequenceDiagram
- Class diagram: classDiagram
- User journey: journey
- Gantt chart: gantt
- State diagram: stateDiagram
- ER diagram: erDiagram
- Pie chart: pie
- Git graph: gitGraph

Always respond with valid Mermaid 10.9.3 syntax wrapped in a code block. Do not include explanations outside the code block.`,
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
