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

    // First pass: collect all participants and clean participant names
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith("sequenceDiagram")) continue

      // Extract participants from arrows with better regex
      const arrowPatterns = [
        /^([A-Za-z0-9_-]+)\s*(->>?\+?|-->>?\+?|-x|--x)\s*([A-Za-z0-9_-]+)\s*:\s*(.+)$/, // Complete arrow syntax
        /^([A-Za-z0-9_-]+)\s+(--?)\s+([A-Za-z0-9_-]+)\s*:\s*(.+)$/, // Incomplete arrows like "A -- B: message"
        /^([A-Za-z0-9_-]+)\s+([A-Za-z0-9_-]+)\s*:\s*(.+)$/, // Missing arrows entirely "A B: message"
      ]

      for (const pattern of arrowPatterns) {
        const match = trimmedLine.match(pattern)
        if (match) {
          // Clean participant names (remove special characters, spaces)
          const participant1 = match[1].replace(/[^A-Za-z0-9_-]/g, "")
          const participant2 = match[3]
            ? match[3].replace(/[^A-Za-z0-9_-]/g, "")
            : match[2].replace(/[^A-Za-z0-9_-]/g, "")

          if (participant1) participants.add(participant1)
          if (participant2) participants.add(participant2)
        }
      }

      // Extract from participant declarations
      const participantMatch = trimmedLine.match(/^participant\s+([A-Za-z0-9_-]+)/)
      if (participantMatch) {
        participants.add(participantMatch[1].replace(/[^A-Za-z0-9_-]/g, ""))
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
      if (line.match(/^(--?>>?\+?|--?x|--?)\s*([A-Za-z0-9_-]+)\s*:\s*(.+)$/)) {
        const match = line.match(/^(--?>>?\+?|--?x|--?)\s*([A-Za-z0-9_-]+)\s*:\s*(.+)$/)
        if (match) {
          const arrow = match[1] === "--" ? "-->>" : match[1].includes(">>") ? match[1] : match[1] + ">>"
          const receiver = match[2].replace(/[^A-Za-z0-9_-]/g, "")
          const message = match[3]

          if (lastParticipant) {
            processedLines.push(`${lastParticipant} ${arrow} ${receiver}: ${message}`)
            lastParticipant = receiver
          } else {
            const firstParticipant = Array.from(participants)[0]
            if (firstParticipant) {
              processedLines.push(`${firstParticipant} ${arrow} ${receiver}: ${message}`)
              lastParticipant = receiver
            }
          }
        }
        continue
      }

      // Fix complete arrow lines with proper validation
      const completeArrowMatch = line.match(
        /^([A-Za-z0-9_-]+)\s*(->>?\+?|-->>?\+?|-x|--x)\s*([A-Za-z0-9_-]+)\s*:\s*(.+)$/,
      )
      if (completeArrowMatch) {
        const [, sender, arrow, receiver, message] = completeArrowMatch
        const cleanSender = sender.replace(/[^A-Za-z0-9_-]/g, "")
        const cleanReceiver = receiver.replace(/[^A-Za-z0-9_-]/g, "")

        if (cleanSender && cleanReceiver && message.trim()) {
          processedLines.push(`${cleanSender} ${arrow} ${cleanReceiver}: ${message.trim()}`)
          lastParticipant = cleanReceiver
        }
        continue
      }

      // Fix incomplete arrows like "A -- B: message" or "A - B: message"
      const incompleteArrowMatch = line.match(/^([A-Za-z0-9_-]+)\s+(--?)\s+([A-Za-z0-9_-]+)\s*:\s*(.+)$/)
      if (incompleteArrowMatch) {
        const [, sender, arrow, receiver, message] = incompleteArrowMatch
        const cleanSender = sender.replace(/[^A-Za-z0-9_-]/g, "")
        const cleanReceiver = receiver.replace(/[^A-Za-z0-9_-]/g, "")
        const fixedArrow = arrow === "--" ? "-->>" : "->"

        if (cleanSender && cleanReceiver && message.trim()) {
          processedLines.push(`${cleanSender} ${fixedArrow} ${cleanReceiver}: ${message.trim()}`)
          lastParticipant = cleanReceiver
        }
        continue
      }

      // Fix missing arrows entirely like "A B: message"
      const missingArrowMatch = line.match(/^([A-Za-z0-9_-]+)\s+([A-Za-z0-9_-]+)\s*:\s*(.+)$/)
      if (missingArrowMatch) {
        const [, sender, receiver, message] = missingArrowMatch
        const cleanSender = sender.replace(/[^A-Za-z0-9_-]/g, "")
        const cleanReceiver = receiver.replace(/[^A-Za-z0-9_-]/g, "")

        // Only process if both are valid participant names
        if (
          cleanSender &&
          cleanReceiver &&
          message.trim() &&
          (participants.has(cleanSender) || participants.has(cleanReceiver))
        ) {
          processedLines.push(`${cleanSender} ->> ${cleanReceiver}: ${message.trim()}`)
          lastParticipant = cleanReceiver
        }
        continue
      }

      // If no pattern matched and it contains a colon, try to salvage it
      if (line.includes(":") && !line.startsWith("note") && !line.startsWith("title")) {
        const parts = line.split(":")
        if (parts.length >= 2) {
          const beforeColon = parts[0].trim()
          const afterColon = parts.slice(1).join(":").trim()

          // Try to extract two participant names from before colon
          const words = beforeColon.split(/\s+/).filter((w) => w.length > 0)
          if (words.length >= 2) {
            const sender = words[0].replace(/[^A-Za-z0-9_-]/g, "")
            const receiver = words[words.length - 1].replace(/[^A-Za-z0-9_-]/g, "")

            if (sender && receiver && afterColon) {
              processedLines.push(`${sender} ->> ${receiver}: ${afterColon}`)
              lastParticipant = receiver
            }
          } else if (words.length === 1 && lastParticipant) {
            const receiver = words[0].replace(/[^A-Za-z0-9_-]/g, "")
            if (receiver && afterColon) {
              processedLines.push(`${lastParticipant} ->> ${receiver}: ${afterColon}`)
              lastParticipant = receiver
            }
          }
        }
      }
    }

    sanitized = processedLines.join("\n")
  }

  // Enhanced flowchart syntax fixing
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
        // Ensure proper graph declaration
        if (!line.match(/^(graph|flowchart)\s+(TD|TB|BT|RL|LR)$/i)) {
          processedLines.push("graph TD")
        } else {
          processedLines.push(line)
        }
        continue
      }

      // Validate and fix node definitions
      const nodeDefRegex = /^([A-Za-z0-9_-]+)(\[.+\]|$$.+$$|{.+}|>(.+)<|{{.+}}|\[\[.+\]\]|\[\/(.+)\/\])$/
      const nodeMatch = line.match(nodeDefRegex)

      if (nodeMatch) {
        const nodeId = nodeMatch[1]
        const nodeShape = nodeMatch[2]

        // Validate node shape syntax
        if (nodeShape && nodeShape.length > 2) {
          processedLines.push(line)
          if (!nodeConnections.has(nodeId)) {
            nodeConnections.set(nodeId, [])
          }
        }
      }
      // Check for connection lines and validate arrow syntax
      else if (line.includes("-->") || line.includes("---") || line.includes("==>") || line.includes("-.->")) {
        // Validate connection syntax
        const connectionMatch = line.match(/([A-Za-z0-9_-]+)\s*(-->|---|==>|-.->|\|.+\|)\s*([A-Za-z0-9_-]+)/)
        if (connectionMatch) {
          processedLines.push(line)
          const [, from, , to] = connectionMatch
          if (!nodeConnections.has(from)) nodeConnections.set(from, [])
          if (!nodeConnections.has(to)) nodeConnections.set(to, [])
          nodeConnections.get(from)?.push(to)
        } else {
          // Try to fix malformed connections
          const parts = line.split(/\s+/)
          if (parts.length >= 3) {
            const from = parts[0]
            const to = parts[parts.length - 1]
            if (from && to && from !== to) {
              processedLines.push(`${from} --> ${to}`)
            }
          }
        }
      }
      // Try to fix lines with missing arrows
      else if (line.includes("[") && !line.includes("-->")) {
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
        // Keep other valid lines (styling, etc.)
        if (line.startsWith("style") || line.startsWith("class") || line.startsWith("click")) {
          processedLines.push(line)
        }
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

      // Validate and fix task format
      if (line.includes(":")) {
        const parts = line.split(":")
        if (parts.length >= 3) {
          // Proper format: task: score: actor
          const task = parts[0].trim()
          const score = parts[1].trim()
          const actor = parts.slice(2).join(":").trim()

          // Validate score is a number between 1-5
          const scoreNum = Number.parseInt(score)
          const validScore = isNaN(scoreNum) ? 3 : Math.max(1, Math.min(5, scoreNum))

          processedLines.push(`  ${task}: ${validScore}: ${actor || "User"}`)
        } else if (parts.length === 2) {
          // Missing actor, add default
          const task = parts[0].trim()
          const score = parts[1].trim()
          const scoreNum = Number.parseInt(score)
          const validScore = isNaN(scoreNum) ? 3 : Math.max(1, Math.min(5, scoreNum))

          processedLines.push(`  ${task}: ${validScore}: User`)
        } else {
          // Only task name, add defaults
          const taskName = parts[0].trim()
          if (taskName) {
            processedLines.push(`  ${taskName}: 3: User`)
          }
        }
      } else {
        // No colon, treat as task name with defaults
        const taskName = line.trim()
        if (
          taskName &&
          !taskName.startsWith("journey") &&
          !taskName.startsWith("title") &&
          !taskName.startsWith("section")
        ) {
          processedLines.push(`  ${taskName}: 3: User`)
        }
      }
    }

    sanitized = processedLines.join("\n")
  }

  // Final validation - if the sanitized code is empty or too short, return an error diagram
  if (!sanitized || sanitized.length < 10) {
    return `graph TD
      A[Error: Empty or Invalid Diagram] --> B[Please provide a valid diagram description]
      style A fill:#ffcccc
      style B fill:#ffffcc`
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
