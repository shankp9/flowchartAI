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

export function sanitizeMermaidCode(code: string): string {
  if (!code || typeof code !== "string") {
    return ""
  }

  let cleanedCode = code.trim()

  // Remove any markdown code block markers
  cleanedCode = cleanedCode.replace(/^```(?:mermaid)?\n?/gm, "")
  cleanedCode = cleanedCode.replace(/\n?```$/gm, "")

  // Check if this is old flowchart syntax and convert it
  if (isOldFlowchartSyntax(cleanedCode)) {
    cleanedCode = convertOldFlowchartToMermaid(cleanedCode)
  }

  // Fix common sequence diagram issues
  if (cleanedCode.includes("sequenceDiagram")) {
    cleanedCode = fixSequenceDiagramSyntax(cleanedCode)
  }

  // Fix common flowchart issues
  if (cleanedCode.includes("graph") || cleanedCode.includes("flowchart")) {
    cleanedCode = fixFlowchartSyntax(cleanedCode)
  }

  // Remove empty lines and normalize whitespace
  cleanedCode = cleanedCode
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")

  return cleanedCode
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
        lastParticipant = participantMatch[1]
      }
      continue
    }

    // Fix arrows that start without a sender
    if (fixedLine.match(/^(--?>>?|--?\+\+|-x)/)) {
      if (lastParticipant) {
        fixedLine = `${lastParticipant} ${fixedLine}`
      } else {
        // If no last participant, skip this line or add a default
        fixedLine = `System ${fixedLine}`
      }
    }

    // Extract participant from valid arrow syntax
    const arrowMatch = fixedLine.match(/^(\w+)\s*(--?>>?|--?\+\+|-x)/)
    if (arrowMatch) {
      lastParticipant = arrowMatch[1]
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
    if (fixedLine.includes("-->") || fixedLine.includes("->")) {
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
