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

// Function to convert old flowchart syntax to Mermaid syntax
function convertOldFlowchartSyntax(code: string): string {
  const lines = code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const nodes: { [key: string]: { type: string; text: string } } = {}
  const connections: string[] = []

  // Parse node definitions
  for (const line of lines) {
    // Match old syntax: st=>start: Start
    const nodeMatch = line.match(/^(\w+)=>(start|end|operation|condition|inputoutput|subroutine):\s*(.+)$/)
    if (nodeMatch) {
      const [, id, type, text] = nodeMatch
      nodes[id] = { type, text }
      continue
    }

    // Match connections: st->op1->cond1
    const connectionMatch = line.match(/^(\w+)(?:$$(\w+)$$)?->(.+)$/)
    if (connectionMatch) {
      const [, fromNode, condition, rest] = connectionMatch

      // Parse the rest of the connection chain
      const targets = rest.split("->")
      let currentNode = fromNode

      for (const target of targets) {
        const targetNode = target.trim()
        if (targetNode && nodes[targetNode]) {
          if (condition) {
            connections.push(`${currentNode} -->|${condition}| ${targetNode}`)
          } else {
            connections.push(`${currentNode} --> ${targetNode}`)
          }
          currentNode = targetNode
        }
      }
    }
  }

  // Generate Mermaid flowchart
  const mermaidLines = ["graph TD"]

  // Add node definitions with proper Mermaid syntax
  for (const [id, node] of Object.entries(nodes)) {
    let nodeShape = ""
    switch (node.type) {
      case "start":
      case "end":
        nodeShape = `${id}((${node.text}))`
        break
      case "operation":
        nodeShape = `${id}[${node.text}]`
        break
      case "condition":
        nodeShape = `${id}{${node.text}}`
        break
      case "inputoutput":
        nodeShape = `${id}[/${node.text}/]`
        break
      case "subroutine":
        nodeShape = `${id}[[${node.text}]]`
        break
      default:
        nodeShape = `${id}[${node.text}]`
    }
    mermaidLines.push(`    ${nodeShape}`)
  }

  // Add connections
  for (const connection of connections) {
    mermaidLines.push(`    ${connection}`)
  }

  return mermaidLines.join("\n")
}

// Function to sanitize and fix common Mermaid syntax errors
export function sanitizeMermaidCode(code: string): string {
  if (!code) return ""

  // Trim whitespace
  let sanitized = code.trim()

  // Remove markdown code block markers if present
  sanitized = sanitized.replace(/^```mermaid\s*/i, "").replace(/```\s*$/i, "")

  // Check if this is old flowchart syntax and convert it
  if (
    sanitized.includes("=>") &&
    (sanitized.includes("start:") || sanitized.includes("operation:") || sanitized.includes("condition:"))
  ) {
    return convertOldFlowchartSyntax(sanitized)
  }

  // Fix sequence diagram syntax errors
  if (sanitized.startsWith("sequenceDiagram")) {
    const lines = sanitized.split("\n")
    const processedLines = []
    const participants = new Set<string>()

    // First pass: collect all participants
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith("sequenceDiagram")) continue

      // Extract participants from arrows
      const arrowPatterns = [
        /^(\w+)\s*->>?\+?\s*(\w+):/, // A->>B: or A->B:
        /^(\w+)\s*-->>?\+?\s*(\w+):/, // A-->>B: or A-->>B:
        /^(\w+)\s*-x\s*(\w+):/, // A-xB:
        /^(\w+)\s*--x\s*(\w+):/, // A--xB:
      ]

      for (const pattern of arrowPatterns) {
        const match = trimmedLine.match(pattern)
        if (match) {
          participants.add(match[1])
          participants.add(match[2])
        }
      }

      // Extract from participant declarations
      const participantMatch = trimmedLine.match(/^participant\s+(\w+)/)
      if (participantMatch) {
        participants.add(participantMatch[1])
      }
    }

    // Second pass: process lines and fix syntax errors
    let lastParticipant = ""

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Skip empty lines
      if (!line) continue

      // Keep the sequenceDiagram declaration
      if (line.startsWith("sequenceDiagram")) {
        processedLines.push(line)
        continue
      }

      // Keep participant declarations, notes, and other valid statements
      if (
        line.startsWith("participant") ||
        line.startsWith("note") ||
        line.startsWith("activate") ||
        line.startsWith("deactivate") ||
        line.startsWith("loop") ||
        line.startsWith("end") ||
        line.startsWith("alt") ||
        line.startsWith("else") ||
        line.startsWith("opt") ||
        line.startsWith("par") ||
        line.startsWith("and") ||
        line.startsWith("rect") ||
        line.startsWith("autonumber") ||
        line.startsWith("title")
      ) {
        processedLines.push(line)
        continue
      }

      // Fix arrows that start without a participant (missing sender)
      if (line.match(/^(--?>>?\+?|--?x)\s*\w+:/)) {
        // This line starts with an arrow but no sender
        // Use the last participant or try to infer from context
        if (lastParticipant) {
          const fixedLine = `${lastParticipant} ${line}`
          processedLines.push(fixedLine)

          // Extract the receiver for next iteration
          const receiverMatch = fixedLine.match(/--?>>?\+?\s*(\w+):/)
          if (receiverMatch) {
            lastParticipant = receiverMatch[1]
          }
        } else {
          // If no last participant, try to use the first available participant
          const firstParticipant = Array.from(participants)[0]
          if (firstParticipant) {
            const fixedLine = `${firstParticipant} ${line}`
            processedLines.push(fixedLine)

            // Extract the receiver for next iteration
            const receiverMatch = fixedLine.match(/--?>>?\+?\s*(\w+):/)
            if (receiverMatch) {
              lastParticipant = receiverMatch[1]
            }
          } else {
            // Skip this malformed line
            continue
          }
        }
        continue
      }

      // Process normal arrow lines
      const arrowPatterns = [
        /^(\w+)\s*(->>?\+?)\s*(\w+):\s*(.+)$/, // A->>B: message
        /^(\w+)\s*(-->>?\+?)\s*(\w+):\s*(.+)$/, // A-->>B: message
        /^(\w+)\s*(-x)\s*(\w+):\s*(.+)$/, // A-xB: message
        /^(\w+)\s*(--x)\s*(\w+):\s*(.+)$/, // A--xB: message
      ]

      let matched = false
      for (const pattern of arrowPatterns) {
        const match = line.match(pattern)
        if (match) {
          const [, sender, arrow, receiver, message] = match
          processedLines.push(`${sender} ${arrow} ${receiver}: ${message}`)
          lastParticipant = receiver
          matched = true
          break
        }
      }

      // If no pattern matched, try to fix common issues
      if (!matched) {
        // Check if it's a malformed arrow line
        if (line.includes(">>") || line.includes("->") || line.includes("-x")) {
          // Try to extract components and fix
          const parts = line.split(/\s*(->>?\+?|-->>?\+?|-x|--x)\s*/)
          if (parts.length >= 3) {
            const sender = parts[0] || lastParticipant || Array.from(participants)[0] || "Unknown"
            const arrow = parts[1]
            const rest = parts.slice(2).join("")

            if (rest.includes(":")) {
              const [receiver, ...messageParts] = rest.split(":")
              const message = messageParts.join(":").trim()
              if (receiver && message) {
                processedLines.push(`${sender} ${arrow} ${receiver.trim()}: ${message}`)
                lastParticipant = receiver.trim()
                continue
              }
            }
          }
        }

        // If we still can't fix it, skip the line or add it as-is if it looks valid
        if (line.length > 0 && !line.includes(">>") && !line.includes("->")) {
          processedLines.push(line)
        }
      }
    }

    sanitized = processedLines.join("\n")
  }

  // Fix flowchart syntax errors
  else if (sanitized.startsWith("graph") || sanitized.startsWith("flowchart")) {
    const lines = sanitized.split("\n")
    const processedLines = []
    const nodeConnections = new Map<string, string[]>()

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
      const nodeDefRegex = /^([A-Za-z0-9_-]+)(\[.+\]|$$.+$$|{.+}|>(.+)<|{{.+}}|\[$$.+$$\]|\[\/(.+)\/\]|$$\(.+$$\))$/
      const nodeMatch = line.match(nodeDefRegex)

      if (nodeMatch) {
        const nodeId = nodeMatch[1]
        processedLines.push(line)

        // Track this node for potential connections
        if (!nodeConnections.has(nodeId)) {
          nodeConnections.set(nodeId, [])
        }
      }
      // Check for connection lines
      else if (line.includes("-->") || line.includes("---") || line.includes("==>")) {
        processedLines.push(line)

        // Extract node connections for tracking
        const connectionMatch = line.match(/([A-Za-z0-9_-]+)\s*-->\s*([A-Za-z0-9_-]+)/)
        if (connectionMatch) {
          const [, from, to] = connectionMatch
          if (!nodeConnections.has(from)) nodeConnections.set(from, [])
          if (!nodeConnections.has(to)) nodeConnections.set(to, [])
          nodeConnections.get(from)?.push(to)
        }
      }
      // Check if this line is missing arrow syntax but has multiple nodes
      else if (line.includes("[") && !line.includes("-->") && !line.includes("---") && !line.includes("==>")) {
        // Try to extract node IDs and create a connection
        const parts = line.split(/\s+/)
        if (parts.length >= 2) {
          const firstNodeId = parts[0]
          const secondPart = parts[1]
          const secondNodeId = secondPart.split("[")[0]

          if (firstNodeId && secondNodeId && firstNodeId !== secondNodeId) {
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

    // Check for orphaned nodes and try to connect them
    const connectedNodes = new Set<string>()
    for (const [node, connections] of nodeConnections) {
      if (connections.length > 0) {
        connectedNodes.add(node)
        connections.forEach((conn) => connectedNodes.add(conn))
      }
    }

    // Find orphaned nodes and connect them to the flow
    const orphanedNodes = Array.from(nodeConnections.keys()).filter((node) => !connectedNodes.has(node))
    if (orphanedNodes.length > 0 && connectedNodes.size > 0) {
      const lastConnectedNode = Array.from(connectedNodes)[connectedNodes.size - 1]
      for (const orphan of orphanedNodes) {
        processedLines.push(`${lastConnectedNode} --> ${orphan}`)
      }
    }

    sanitized = processedLines.join("\n")
  }

  // Fix journey diagram syntax
  else if (sanitized.startsWith("journey")) {
    const lines = sanitized.split("\n")
    const processedLines = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Skip empty lines
      if (!line) continue

      // Keep journey declaration, title, and section headers
      if (line.startsWith("journey") || line.startsWith("title") || line.startsWith("section")) {
        processedLines.push(line)
        continue
      }

      // Check if this line is a task without proper format
      if (!line.includes(":") || (line.includes(":") && line.split(":").length < 3)) {
        // Try to convert it to proper task format
        const taskName = line.replace(/:/g, "").trim()
        if (taskName) {
          processedLines.push(`  ${taskName}: 3: Me`)
        }
      } else {
        // Check if it has the right format (task: score: actor)
        const parts = line.split(":")
        if (parts.length >= 3) {
          processedLines.push(line)
        } else if (parts.length === 2) {
          // Missing actor, add default
          processedLines.push(`${line}: Me`)
        } else {
          processedLines.push(line)
        }
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

  // Also check for old flowchart syntax
  const isOldFlowchart =
    trimmed.includes("=>") &&
    (trimmed.includes("start:") || trimmed.includes("operation:") || trimmed.includes("condition:"))

  if (isValidMermaid || isOldFlowchart) {
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
