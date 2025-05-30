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
    errors.push("No content found after trimming")
    return { isValid: false, errors }
  }

  const firstLine = lines[0].toLowerCase()
  const validStarts = [
    "graph",
    "flowchart",
    "sequencediagram",
    "classdiagram",
    "journey",
    "gantt",
    "statediagram",
    "statediagram-v2",
    "erdiagram",
    "pie",
    "mindmap",
    "timeline",
    "c4context",
    "c4container",
    "c4component",
    "c4dynamic",
    "c4deployment",
  ]

  if (!validStarts.some((start) => firstLine.startsWith(start))) {
    errors.push(
      `Invalid diagram type. Must start with a known keyword (e.g., 'graph TD', 'sequenceDiagram'). Found: "${firstLine.substring(0, 30)}..."`,
    )
  }

  if (firstLine.startsWith("sequencediagram")) {
    validateSequenceDiagram(lines, errors) // Pass all lines for context
  }
  // Add other diagram-specific validations if needed

  if (code.match(/Error:/i) || code.match(/Syntax error/i) || code.match(/ParseException/i)) {
    errors.push("Code contains explicit error messages from generation.")
  }

  return { isValid: errors.length === 0, errors }
}

function validateSequenceDiagram(lines: string[], errors: string[]) {
  // Skip the first line (sequenceDiagram declaration)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    // Regex for valid message: ActorArrowActor: Message
    // Allows for various arrow types and optional "as" alias for actors
    const validMessageRegex =
      /^\s*([\w\s"]+|[\w\s"]+\s+as\s+[\w\s"]+)\s*(--?>?>?|--?x>?>?|--?\+\+>?>?)\s*([\w\s"]+|[\w\s"]+\s+as\s+[\w\s"]+)\s*:\s*.+$/
    const participantDeclarationRegex = /^\s*(participant|actor)\s+([\w\s"]+|[\w\s"]+\s+as\s+[\w\s"]+)\s*$/
    const noteRegex = /^\s*Note\s+(right of|left of|over)\s+([\w\s"]+)\s*:\s*.+$/
    const activateDeactivateRegex = /^\s*(activate|deactivate)\s+([\w\s"]+)\s*$/
    const loopAltOptRegex = /^\s*(loop|alt|opt|par|critical|break|rect rgb$$\d+,\s*\d+,\s*\d+$$)\s*.*?$/
    const endRegex = /^\s*end\s*$/

    if (
      !validMessageRegex.test(line) &&
      !participantDeclarationRegex.test(line) &&
      !noteRegex.test(line) &&
      !activateDeactivateRegex.test(line) &&
      !loopAltOptRegex.test(line) &&
      !endRegex.test(line) &&
      line.trim() !== "" // Ignore empty lines
    ) {
      errors.push(
        `Invalid sequence diagram line: "${line.substring(0, 50)}${line.length > 50 ? "..." : ""}". Expected format like 'Sender->>Receiver: Message' or 'participant Name'.`,
      )
    }
    if (
      line.includes(":") &&
      !line.match(/:\s*.+$/) &&
      !noteRegex.test(line) &&
      !loopAltOptRegex.test(line) &&
      !participantDeclarationRegex.test(line) &&
      !line.includes("{")
    ) {
      // A colon exists but not followed by space and message text (common error)
      // And it's not a note, loop, or participant alias with a colon
      errors.push(
        `Potentially malformed message on line: "${line.substring(0, 50)}...". Ensure colon is followed by message text.`,
      )
    }
  }
}

function validateFlowchart(lines: string[], errors: string[]) {
  // Basic flowchart validation (can be expanded)
  for (const line of lines) {
    if (line.includes("->") && !line.includes("-->") && !line.includes("-- text -->")) {
      // Potentially using single dash arrow which is less common / might be typo
      // errors.push(`Consider using '-->' or '-- text -->' for flowchart connections: "${line}"`);
    }
  }
}

function validateClassDiagram(lines: string[], errors: string[]) {
  /* Basic validation */
}
function validateERDiagram(lines: string[], errors: string[]) {
  /* Basic validation */
}

export function sanitizeMermaidCode(code: string): string {
  if (!code || typeof code !== "string") {
    return ""
  }

  let cleanedCode = code.trim()
  cleanedCode = cleanedCode.replace(/^```(?:mermaid)?\n?/gm, "").replace(/\n?```$/gm, "")
  cleanedCode = cleanedCode.trim()

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
    "statediagram-v2",
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
  }

  if (diagramStartIndex > 0) {
    cleanedCode = lines.slice(diagramStartIndex).join("\n").trim()
  } else if (
    diagramStartIndex === -1 &&
    lines.length > 0 &&
    !diagramKeywords.some((kw) => lines[0].trim().toLowerCase().startsWith(kw))
  ) {
    // If no keyword found and the first line doesn't start with one, it's likely missing.
    // The validation will catch this. We avoid prepending a default here.
  }

  if (isOldFlowchartSyntax(cleanedCode)) {
    cleanedCode = convertOldFlowchartToMermaid(cleanedCode)
  }

  cleanedCode = cleanGenericInvalidSyntax(cleanedCode)

  const firstLineLower = cleanedCode.split("\n")[0]?.trim().toLowerCase() || ""

  if (firstLineLower.startsWith("sequencediagram")) {
    cleanedCode = fixSequenceDiagramSyntax(cleanedCode)
  } else if (firstLineLower.startsWith("graph") || firstLineLower.startsWith("flowchart")) {
    cleanedCode = fixFlowchartSyntax(cleanedCode)
  } else if (firstLineLower.startsWith("erdiagram")) {
    cleanedCode = fixERDiagramSyntax(cleanedCode)
  } else if (firstLineLower.startsWith("classdiagram")) {
    cleanedCode = fixClassDiagramSyntax(cleanedCode)
  }

  return cleanedCode
    .split("\n")
    .map((line) => line.trim()) // Trim each line again after specific fixes
    .filter((line) => line.length > 0 || line === "") // Keep intentional empty lines if any, but filter out lines that became empty due to trimming
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // Consolidate multiple blank lines
}

function cleanGenericInvalidSyntax(code: string): string {
  let cleaned = code
  // Remove lines that are just "ERROR" or "IDENTIFYING" or "Below" as these are often AI artifacts
  cleaned = cleaned
    .split("\n")
    .filter((line) => {
      const upperLine = line.trim().toUpperCase()
      return upperLine !== "ERROR" && upperLine !== "IDENTIFYING" && upperLine !== "BELOW"
    })
    .join("\n")

  // Remove common error patterns like "ERROR -- ERROR_TYPE : ..."
  cleaned = cleaned.replace(/ERROR\s*--\s*ERROR_TYPE\s*:\s*[^\n]*/gi, "")

  // Attempt to fix common malformed arrows or connections if they are obviously wrong
  // Example: "User  API: Request" might become "User->>API: Request" if context suggests sequence
  // This is tricky and needs to be conservative to avoid breaking valid syntax.
  // For now, focusing on removing obvious AI error injections.

  return cleaned
}

function fixSequenceDiagramSyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []
  const declaredParticipants = new Set<string>()

  // First pass: identify declared participants
  lines.forEach((line) => {
    const participantMatch = line.trim().match(/^(participant|actor)\s+([\w\s"]+|[\w\s"]+\s+as\s+[\w\s"]+)/)
    if (participantMatch) {
      declaredParticipants.add(
        participantMatch[2].includes(" as ") ? participantMatch[2].split(" as ")[0].trim() : participantMatch[2].trim(),
      )
    }
  })

  for (const line of lines) {
    let currentLine = line.trim()

    if (currentLine.toLowerCase() === "sequencediagram" || currentLine === "") {
      fixedLines.push(currentLine)
      continue
    }

    // Regex for participant declaration
    const participantDeclarationRegex = /^(participant|actor)\s+([\w\s"]+|[\w\s"]+\s+as\s+[\w\s"]+)/
    if (participantDeclarationRegex.test(currentLine)) {
      fixedLines.push(currentLine)
      const match = currentLine.match(participantDeclarationRegex)
      if (match)
        declaredParticipants.add(match[2].includes(" as ") ? match[2].split(" as ")[0].trim() : match[2].trim())
      continue
    }

    // Attempt to fix lines like "Sender Receiver: Message" or "Sender:Receiver: Message"
    // This is a common AI mistake.
    const malformedMessageMatch = currentLine.match(/^([\w\s"]+)\s+([\w\s"]+)\s*:\s*(.+)$/)
    if (
      malformedMessageMatch &&
      !currentLine.includes("->") &&
      !currentLine.includes("Note ") &&
      !currentLine.includes("loop") &&
      !currentLine.includes("alt") &&
      !currentLine.includes("opt")
    ) {
      const [, sender, receiver, message] = malformedMessageMatch
      if (declaredParticipants.has(sender.trim()) && declaredParticipants.has(receiver.trim())) {
        currentLine = `${sender.trim()}->>${receiver.trim()}: ${message.trim()}`
      }
    }

    // Attempt to fix lines like "Sender: ->> Receiver: Message"
    const colonInSenderMatch = currentLine.match(
      /^([\w\s"]+)\s*:\s*(--?>?>?|--?x>?>?|--?\+\+>?>?)\s*([\w\s"]+)\s*:\s*(.+)$/,
    )
    if (colonInSenderMatch) {
      const [, sender, arrow, receiver, message] = colonInSenderMatch
      currentLine = `${sender.trim()}${arrow}${receiver.trim()}: ${message.trim()}`
    }

    // Ensure a colon exists before message text if an arrow is present
    const arrowPresentMatch = currentLine.match(
      /^([\w\s"]+\s*(?:as\s+[\w\s"]+)?\s*(?:--?>?>?|--?x>?>?|--?\+\+>?>?)\s*[\w\s"]+\s*(?:as\s+[\w\s"]+)?)(.*)$/,
    )
    if (arrowPresentMatch) {
      let [, interaction, messagePart] = arrowPresentMatch
      messagePart = messagePart.trim()
      if (messagePart.length > 0 && !messagePart.startsWith(":")) {
        currentLine = `${interaction}: ${messagePart}`
      } else if (messagePart.length === 0 && interaction.split(/(--?>?>?|--?x>?>?|--?\+\+>?>?)/)[2].trim() !== "") {
        // Arrow is present, receiver is present, but no message part and no colon
        // This is likely an error, but hard to fix without context.
        // For now, we'll let validation catch it if it's truly invalid.
      }
    }

    fixedLines.push(currentLine)
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

  for (const line of lines) {
    if (line.includes("=>")) {
      const [idPart, defPart] = line.split("=>")
      const id = idPart.trim()
      if (defPart) {
        const [typePart, ...labelParts] = defPart.split(":")
        const type = typePart.trim()
        const label = labelParts.join(":").trim()
        nodes[id] = { type, label }
      }
    }
  }

  for (const line of lines) {
    if (line.includes("->") && !line.includes("=>")) {
      const parts = line.split("->")
      for (let i = 0; i < parts.length - 1; i++) {
        const fromFull = parts[i].trim()
        const to = parts[i + 1].trim()

        const conditionMatch = fromFull.match(/^(\w+)\s*$$(.+)$$$/)
        if (conditionMatch) {
          const [, nodeId, conditionText] = conditionMatch
          connections.push(`${nodeId} -- ${conditionText} --> ${to}`)
        } else {
          connections.push(`${fromFull} --> ${to}`)
        }
      }
    }
  }

  let mermaidCode = "graph TD\n"
  for (const [id, node] of Object.entries(nodes)) {
    let nodeShape = `[${node.label || id}]` // Default rectangle
    if (node.type === "start" || node.type === "end")
      nodeShape = `((${node.label || id}))` // Circle
    else if (node.type === "condition")
      nodeShape = `{${node.label || id}}` // Diamond
    else if (node.type === "inputoutput") nodeShape = `[/${node.label || id}/]` // Parallelogram

    mermaidCode += `    ${id}${nodeShape}\n`
  }

  for (const conn of connections) {
    mermaidCode += `    ${conn}\n`
  }
  return mermaidCode
}

function fixFlowchartSyntax(code: string): string {
  return code
    .split("\n")
    .map((line) => {
      // Ensure space around arrows
      return line.replace(/(\S)-->(S)/g, "$1 --> $2").replace(/(\S)---(S)/g, "$1 --- $2")
    })
    .join("\n")
}

function fixERDiagramSyntax(code: string): string {
  /* Basic placeholder */ return code
}
function fixClassDiagramSyntax(code: string): string {
  /* Basic placeholder */ return code
}

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
      temperature: 0.7, // Slightly higher for direct stream if needed
      max_tokens: 1500,
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
                /* Skip invalid JSON */
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
