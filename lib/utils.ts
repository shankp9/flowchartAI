import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Message, OpenAIModel } from "@/types/type" // Assuming types/type.ts exists
import { DIAGRAM_TYPES } from "./constants" // Assuming lib/constants.ts exists

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function serializeCode(code: string): string {
  try {
    return btoa(unescape(encodeURIComponent(code)))
  } catch (error) {
    console.error("Error serializing code:", error)
    return "" // Return empty string or throw custom error
  }
}

export function parseCodeFromMessage(message: string): string {
  const codeBlockRegex = /```(?:mermaid)?\n([\s\S]*?)\n```/g
  const match = codeBlockRegex.exec(message)
  return match ? match[1].trim() : message.trim()
}

export function validateMermaidCode(code: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!code || typeof code !== "string") {
    errors.push("Code is empty or not a string.")
    return { isValid: false, errors }
  }

  const lines = code
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    errors.push("Code contains no content after trimming.")
    return { isValid: false, errors }
  }

  const firstLine = lines[0].toLowerCase()
  const validDiagramStarters = Object.values(DIAGRAM_TYPES).map((type) => type.toLowerCase())
  // Add common graph types
  validDiagramStarters.push("graph td", "graph lr", "graph bt", "graph rl")

  if (!validDiagramStarters.some((start) => firstLine.startsWith(start))) {
    errors.push(
      `Invalid diagram type. Must start with a known Mermaid diagram type (e.g., 'graph TD', 'sequenceDiagram'). Found: "${firstLine.substring(0, 20)}..."`,
    )
  }

  // Basic structural checks (can be expanded)
  if (code.includes("<<<") || code.includes(">>>")) {
    errors.push("Potentially invalid arrow or token usage ('<<<' or '>>>').")
  }
  if ((code.match(/{/g) || []).length !== (code.match(/}/g) || []).length) {
    errors.push("Mismatched curly braces.")
  }
  if ((code.match(/\[/g) || []).length !== (code.match(/]/g) || []).length) {
    errors.push("Mismatched square brackets.")
  }
  if ((code.match(/$$/g) || []).length !== (code.match(/$$/g) || []).length) {
    errors.push("Mismatched parentheses.")
  }

  // Check for common error-indicating keywords (if AI includes them)
  const errorKeywords = ["error", "invalid", "syntax", "parse", "unexpected token"]
  if (errorKeywords.some((keyword) => code.toLowerCase().includes(keyword))) {
    // This is a soft warning as "error" can be a valid node name.
    // errors.push("Code contains keywords often associated with errors. Please review.");
  }

  return { isValid: errors.length === 0, errors }
}

export function sanitizeMermaidCode(code: string): string {
  if (!code || typeof code !== "string") {
    console.warn("sanitizeMermaidCode: Received empty or invalid code.")
    return "" // Or throw an error
  }

  let cleanedCode = code.trim()

  // Remove markdown code block markers
  cleanedCode = cleanedCode.replace(/^```(?:mermaid)?\n?/gm, "").replace(/\n?```$/gm, "")

  // Remove explanatory text before the diagram (heuristic)
  const lines = cleanedCode.split("\n")
  let diagramStartIndex = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase()
    const isDiagramKeyword = [
      "graph",
      "flowchart",
      "sequenceDiagram",
      "classDiagram",
      "journey",
      "gantt",
      "stateDiagram",
      "erDiagram",
      "pie",
      "mindmap",
      "timeline",
    ].some((kw) => line.startsWith(kw))
    if (isDiagramKeyword) {
      diagramStartIndex = i
      break
    }
    // If we find a line that looks like a node or connection before a keyword, it might be the start
    if (i < 5 && (line.includes("-->") || line.includes("->") || (line.includes("[") && line.includes("]")))) {
      diagramStartIndex = i
      break
    }
  }
  cleanedCode = lines.slice(diagramStartIndex).join("\n").trim()

  // Normalize line endings and remove excessive blank lines
  cleanedCode = cleanedCode.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n")

  // Basic structural fixes (examples, can be expanded)
  // Ensure space after diagram type if followed by content
  cleanedCode = cleanedCode.replace(
    /^(graph\s*(?:TD|LR|RL|BT)|sequenceDiagram|classDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|mindmap|timeline)([^\s\n])/gm,
    "$1 $2",
  )

  // Attempt to fix common issues like missing spaces around arrows for flowcharts
  if (cleanedCode.toLowerCase().startsWith("graph") || cleanedCode.toLowerCase().startsWith("flowchart")) {
    cleanedCode = cleanedCode.replace(/([a-zA-Z0-9\])}>])-->([a-zA-Z0-9[({<])/g, "$1 --> $2") // node-->node
    cleanedCode = cleanedCode.replace(/([a-zA-Z0-9\])}>])-->([a-zA-Z0-9[({<])/g, "$1 --> $2") // node--> node
    cleanedCode = cleanedCode.replace(/([a-zA-Z0-9\])}>])--> ([a-zA-Z0-9[({<])/g, "$1 --> $2") // node -->node
  }

  // For sequence diagrams, ensure no leading/trailing spaces on arrow lines for messages
  if (cleanedCode.toLowerCase().startsWith("sequencediagram")) {
    cleanedCode = lines
      .map((line) => {
        if (line.match(/^\s*\w+\s*(--?>?>?|--?x>?>?)\s*\w+\s*:.*/)) {
          // Matches A->B: Message
          return line.trim() // Trim the line
        }
        return line
      })
      .join("\n")
  }

  // Final trim
  cleanedCode = cleanedCode.trim()

  if (!cleanedCode) {
    console.warn("sanitizeMermaidCode: Code became empty after sanitization.")
  }

  return cleanedCode
}

export function createFallbackDiagram(originalCode?: string, errorReason?: string): string {
  const reason = errorReason ? ` (${errorReason.substring(0, 50)}${errorReason.length > 50 ? "..." : ""})` : ""
  return `
graph TD
    A["Diagram Error"] --o B["Unable to render${reason}"]
    B --> C["Please check your Mermaid syntax or try a simpler diagram."]
    C --> D["Example: A --> B"]
    
    style A fill:#ffadad,stroke:#f00,stroke-width:2px
    style B fill:#ffd6a5,stroke:#f57c00,stroke-width:1px
    style C fill:#fdffb6,stroke:#888,stroke-width:1px
    style D fill:#caffbf,stroke:#388e3c,stroke-width:1px
  `
}

// (OpenAIStream function can remain as is, assuming it's for a different purpose or legacy)
// If OpenAIStream is used for the main chat, it should also be updated for robustness.
// For now, assuming the main chat uses the /api/openai route directly.
export async function OpenAIStream(messages: Message[], model: OpenAIModel, apiKey: string): Promise<ReadableStream> {
  // This function seems to be a direct OpenAI call, not using the app's backend.
  // If it's used, ensure it has robust error handling and aligns with the backend's system prompt.
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
    // Add more specific error handling based on status code
    const errorBody = await response.text()
    console.error("OpenAI API direct stream error:", response.status, errorBody)
    throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`)
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
                // Skip invalid JSON, log if necessary in development
                console.warn("Skipping invalid JSON in OpenAI stream:", e)
              }
            }
          }
        }
      } catch (error) {
        console.error("OpenAI stream processing error:", error)
        controller.error(error)
      } finally {
        reader.releaseLock()
      }
    },
  })
}
