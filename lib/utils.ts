import { type ClassValue, clsx } from "clsx"
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

// Function to sanitize and fix common Mermaid syntax errors
export function sanitizeMermaidCode(code: string): string {
  if (!code) return ""

  // Trim whitespace
  let sanitized = code.trim()

  // Remove markdown code block markers if present
  sanitized = sanitized.replace(/^```mermaid\s*/i, "").replace(/```\s*$/i, "")

  // Check if it's a flowchart and fix common syntax errors
  if (sanitized.startsWith("graph") || sanitized.startsWith("flowchart")) {
    // Split into lines for processing
    const lines = sanitized.split("\n")
    const processedLines = []

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Skip empty lines
      if (!line) continue

      // First line is the graph declaration
      if (i === 0) {
        processedLines.push(line)
        continue
      }

      // Check if this line defines a node without connections
      const nodeDefRegex = /^([A-Za-z0-9_-]+)(\[.+\]|$$.+$$|{.+}|>(.+)<|{{.+}}|\[$$.+$$\]|\[\/(.+)\/\])$/
      const nodeMatch = line.match(nodeDefRegex)

      // If it's just a node definition without connections, skip it or connect it
      if (nodeMatch && i > 1) {
        // Look for previous node to connect to
        let prevNodeId = null
        for (let j = processedLines.length - 1; j >= 0; j--) {
          const prevLine = processedLines[j]
          const prevNodeMatch = prevLine.match(
            /^([A-Za-z0-9_-]+)(\[.+\]|$$.+$$|{.+}|>(.+)<|{{.+}}|\[$$.+$$\]|\[\/(.+)\/\])$/,
          )
          if (prevNodeMatch) {
            prevNodeId = prevNodeMatch[1]
            break
          }
        }

        // If we found a previous node, connect this node to it
        if (prevNodeId) {
          processedLines.push(`${prevNodeId} --> ${nodeMatch[1]}`)
          processedLines.push(line)
        } else {
          processedLines.push(line)
        }
      }
      // Check if this line is missing arrow syntax
      else if (line.includes("[") && !line.includes("-->") && !line.includes("---") && !line.includes("==>")) {
        // Try to extract node IDs and create a connection
        const parts = line.split(/\s+/)
        if (parts.length >= 2) {
          const firstNodeId = parts[0]
          const secondNodeId = parts[1].split("[")[0]
          if (firstNodeId && secondNodeId) {
            processedLines.push(`${firstNodeId} --> ${parts.slice(1).join(" ")}`)
          } else {
            processedLines.push(line)
          }
        } else {
          processedLines.push(line)
        }
      } else {
        processedLines.push(line)
      }
    }

    sanitized = processedLines.join("\n")
  }

  // Fix journey diagram syntax
  if (sanitized.startsWith("journey")) {
    const lines = sanitized.split("\n")
    const processedLines = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Skip empty lines
      if (!line) continue

      // First line is the journey declaration
      if (i === 0 || line.startsWith("journey") || line.startsWith("title") || line.startsWith("section")) {
        processedLines.push(line)
        continue
      }

      // Check if this line is a task without proper format
      if (!line.includes(":")) {
        // Try to convert it to proper task format
        processedLines.push(`  ${line}: 3: Me`)
      } else {
        processedLines.push(line)
      }
    }

    sanitized = processedLines.join("\n")
  }

  return sanitized
}

export function parseCodeFromMessage(message: string): string {
  // Remove any leading/trailing whitespace
  const trimmed = message.trim()

  // Try to extract code from markdown code blocks first
  const codeBlockRegex = /```(?:mermaid)?\s*\n?([\s\S]*?)\n?```/g
  const codeMatch = codeBlockRegex.exec(trimmed)

  if (codeMatch && codeMatch[1]) {
    return sanitizeMermaidCode(codeMatch[1].trim())
  }

  // If no code block found, check if the entire message is valid Mermaid syntax
  const validMermaidStarters = [
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
    "C4Context",
    "C4Container",
    "C4Component",
  ]

  const firstLine = trimmed.split("\n")[0].toLowerCase()
  const isValidMermaid = validMermaidStarters.some((starter) => firstLine.startsWith(starter.toLowerCase()))

  if (isValidMermaid) {
    return sanitizeMermaidCode(trimmed)
  }

  // If we get here, the response doesn't contain valid Mermaid code
  // Return a default error diagram
  return `graph TD
    A[Error: Invalid Response] --> B[Please try again with a more specific request]
    B --> C[Example: Create a flowchart for user login process]
    style A fill:#ffcccc
    style B fill:#ffffcc
    style C fill:#ccffcc`
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
