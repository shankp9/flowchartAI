import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Message, OpenAIModel } from "@/types/type"
import { DIAGRAM_TYPES } from "./constants"

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
  // If no markdown block, assume the whole message is the code, but trim it.
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
    .filter(Boolean) // Remove empty lines

  if (lines.length === 0) {
    errors.push("Code contains no content after trimming empty lines.")
    return { isValid: false, errors }
  }

  const firstLine = lines[0].toLowerCase()
  // More robust check for diagram starters, allowing for common variations like "stateDiagram-v2"
  const validDiagramStarters = Object.values(DIAGRAM_TYPES)
    .map((type) => type.toLowerCase())
    .concat([
      "graph td",
      "graph lr",
      "graph bt",
      "graph rl",
      "statediagram-v2",
      "c4context",
      "c4container",
      "c4component",
      "c4dynamic",
      "c4deployment",
    ])

  if (!validDiagramStarters.some((start) => firstLine.startsWith(start))) {
    errors.push(
      `Invalid diagram type. Must start with a known Mermaid diagram type (e.g., 'graph TD', 'sequenceDiagram'). Found: "${firstLine.substring(0, 30)}..."`,
    )
  }

  // Basic structural checks (can be expanded)
  if ((code.match(/{/g) || []).length !== (code.match(/}/g) || []).length) {
    errors.push("Mismatched curly braces {}")
  }
  if ((code.match(/\[/g) || []).length !== (code.match(/]/g) || []).length) {
    errors.push("Mismatched square brackets []")
  }
  if ((code.match(/$$/g) || []).length !== (code.match(/$$/g) || []).length) {
    errors.push("Mismatched parentheses ()")
  }

  // Check for lines that are just "ERROR" or similar, which Mermaid might output if it fails internally
  if (lines.some((line) => line.toUpperCase() === "ERROR" || line.includes("Syntax error"))) {
    errors.push("Diagram code contains 'ERROR' or 'Syntax error', indicating a problem.")
  }

  return { isValid: errors.length === 0, errors }
}

export function sanitizeMermaidCode(code: string): string {
  if (!code || typeof code !== "string") {
    console.warn("sanitizeMermaidCode: Received empty or invalid code.")
    return ""
  }

  let cleanedCode = code.trim()

  // Remove markdown code block markers first
  cleanedCode = cleanedCode.replace(/^```(?:mermaid)?\n?/gm, "").replace(/\n?```$/gm, "")
  cleanedCode = cleanedCode.trim() // Trim again after removing markdown

  // Split into lines and find the actual start of the diagram
  const lines = cleanedCode.split("\n")
  let diagramStartIndex = -1

  const diagramKeywords = [
    "graph",
    "flowchart",
    "sequencediagram",
    "classdiagram",
    "journey",
    "gantt",
    "statediagram",
    "erdiagram",
    "pie",
    "mindmap",
    "timeline",
    "c4context",
    "c4container",
    "c4component",
    "c4dynamic",
    "c4deployment",
  ].map((kw) => kw.toLowerCase())

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase()
    if (diagramKeywords.some((kw) => line.startsWith(kw))) {
      diagramStartIndex = i
      break
    }
    // If we are past a few lines and haven't found a keyword, assume it's not there or malformed.
    if (i > 5 && diagramStartIndex === -1) break
  }

  if (diagramStartIndex > 0) {
    cleanedCode = lines.slice(diagramStartIndex).join("\n").trim()
  } else if (diagramStartIndex === -1 && lines.length > 0) {
    // If no keyword found, but there's content, we might have a problem.
    // For now, we'll assume the AI *should* have provided it.
    // The validation will catch this.
    // We could potentially prepend a default like 'graph TD' here if validation fails later,
    // but it's better to get the AI to produce it.
  }

  // Normalize line endings and remove excessive blank lines
  cleanedCode = cleanedCode.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n")

  // Basic structural fixes (examples, can be expanded)
  cleanedCode = cleanedCode.replace(
    /^(graph\s*(?:TD|LR|RL|BT)|sequenceDiagram|classDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|mindmap|timeline)([^\s\n])/gm,
    "$1 $2",
  )

  if (cleanedCode.toLowerCase().startsWith("graph") || cleanedCode.toLowerCase().startsWith("flowchart")) {
    cleanedCode = cleanedCode.replace(/([a-zA-Z0-9\])}>])\s*--?>\s*([a-zA-Z0-9[({<])/g, "$1 --> $2")
  }

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

// OpenAIStream function (ensure it's robust if used directly)
export async function OpenAIStream(messages: Message[], model: OpenAIModel, apiKey: string): Promise<ReadableStream> {
  const systemMessage: Message = {
    role: "system",
    content: `You are an expert in creating Mermaid diagrams. Generate only valid Mermaid syntax based on the user's description. 
    CRITICAL: Your response MUST start *directly* with a valid Mermaid diagram type keyword (e.g., graph TD, sequenceDiagram). NO other text before it.
    
Available diagram types:
- Flowchart: graph TD or graph LR
- Sequence diagram: sequenceDiagram
- Class diagram: classDiagram
- User journey: journey
- Gantt chart: gantt

Always respond with valid Mermaid syntax wrapped in a code block. Do not include explanations outside the code block.`,
    id: `system-${Date.now()}`,
    timestamp: Date.now(),
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
        controller.error(new Error("Failed to get ReadableStream reader."))
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
        controller.close()
      }
    },
  })
}
