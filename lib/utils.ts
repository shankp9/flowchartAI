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

// Enhanced validation function with detailed error reporting
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

  // Check if it starts with a valid diagram type
  const validStarts = [
    "graph",
    "flowchart",
    "sequencediagram",
    "classdiagram",
    "journey",
    "gantt",
    "statediagram", // Also allow statediagram-v2 implicitly by checking start
    "erdiagram",
    "pie",
    "mindmap", // Added mindmap
    "timeline", // Added timeline
    "c4context",
    "c4container",
    "c4component",
    "c4dynamic",
    "c4deployment", // Added C4
  ]

  const hasValidStart = validStarts.some((start) => firstLine.startsWith(start))
  if (!hasValidStart) {
    errors.push(
      `Invalid diagram type. Must start with a known Mermaid type (e.g., graph TD, sequenceDiagram). Found: "${firstLine.substring(0, 30)}..."`,
    )
  }

  // Diagram-specific validation
  if (firstLine.startsWith("sequencediagram")) {
    validateSequenceDiagram(lines.slice(1), errors)
  } else if (firstLine.startsWith("graph") || firstLine.startsWith("flowchart")) {
    validateFlowchart(lines.slice(1), errors)
  } else if (firstLine.startsWith("classdiagram")) {
    validateClassDiagram(lines.slice(1), errors)
  } else if (firstLine.startsWith("erdiagram")) {
    validateERDiagram(lines.slice(1), errors)
  }

  // Check for common error patterns
  const codeText = code.toLowerCase()
  if (codeText.includes("error:") || codeText.includes("parse error")) {
    // More specific error keywords
    errors.push("Contains 'error:' or 'parse error' keywords that may indicate parsing failures")
  }
  if (codeText.includes("identifying") && !codeText.includes("erdiagram")) {
    // 'identifying' is valid in erDiagram
    errors.push("Contains 'identifying' keyword outside of ER diagram context, may cause issues.")
  }

  return { isValid: errors.length === 0, errors }
}

function validateSequenceDiagram(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for arrows without senders more broadly
    if (line.match(/^\s*(--?(?:>>?|x>?>?|\+>?>?)|->>?|-x|-+)\s*\w+/)) {
      errors.push(`Invalid sequence diagram arrow: likely missing sender: "${line}"`)
    }

    // Check for proper participant format
    if (line.startsWith("participant ") && !line.match(/^participant\s+(?:".+?"|\w+)(?:\s+as\s+(?:".+?"|\w+))?$/i)) {
      errors.push(`Invalid participant declaration: "${line}"`)
    }
    if (line.startsWith("actor ") && !line.match(/^actor\s+(?:".+?"|\w+)(?:\s+as\s+(?:".+?"|\w+))?$/i)) {
      errors.push(`Invalid actor declaration: "${line}"`)
    }
  }
}

function validateFlowchart(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for missing arrows in connections
    // A line with text, not being a node definition, likely needs arrows
    if (
      !line.includes("-->") &&
      !line.includes("->") &&
      !line.match(/^\s*\w+\s*(\[.*?\]|$$.*?$$|{.*?}|$$>.*?$$|(\w+::\w+))/) && // Exclude node definitions
      line.match(/\w.*\w/) // Contains some words
    ) {
      errors.push(`Possible missing arrow in flowchart connection: "${line}"`)
    }
  }
}

function validateClassDiagram(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for proper class syntax
    if (line.includes("class ") && !line.match(/^class\s+(?:~|\w+|"[^"]+")(?:\s*<[^>]+>)?(?:\s*\{)?/)) {
      errors.push(`Invalid class declaration: "${line}"`)
    }
  }
}

function validateERDiagram(lines: string[], errors: string[]) {
  for (const line of lines) {
    // Check for proper entity relationship syntax
    if (
      line.includes("||") ||
      line.includes("}|") ||
      line.includes("|{") ||
      line.includes("o|") ||
      line.includes("|o") ||
      line.includes("o{") ||
      line.includes("}o")
    ) {
      if (
        !line.match(/^\s*\w+\s*([|}{o]+[-.]+?[|}{o]+)\s*\w+\s*:\s*".*?"\s*$/) &&
        !line.match(/^\s*\w+\s*\{[\s\S]*?\}\s*$/)
      ) {
        // also allow entity block
        errors.push(`Invalid ER relationship syntax: "${line}"`)
      }
    }
  }
}

export function sanitizeMermaidCode(code: string): string {
  if (!code || typeof code !== "string") {
    return ""
  }

  let cleanedCode = code.trim()

  cleanedCode = cleanedCode.replace(/^```(?:mermaid)?\n?/gm, "")
  cleanedCode = cleanedCode.replace(/\n?```$/gm, "")
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase()
    if (diagramKeywords.some((kw) => line.startsWith(kw))) {
      diagramStartIndex = i
      break
    }
  }

  if (diagramStartIndex > 0) {
    cleanedCode = lines.slice(diagramStartIndex).join("\n")
  } else if (
    diagramStartIndex === -1 &&
    lines.length > 0 &&
    !diagramKeywords.some((kw) => lines[0].trim().toLowerCase().startsWith(kw))
  ) {
    // If no keyword found and it's not the first line, it's likely missing.
    // The validation will catch this. Forcing a type here can be problematic.
  }

  if (isOldFlowchartSyntax(cleanedCode)) {
    cleanedCode = convertOldFlowchartToMermaid(cleanedCode)
  }

  cleanedCode = cleanInvalidSyntax(cleanedCode)

  const firstLineTrimmed = cleanedCode.split("\n")[0]?.trim().toLowerCase() || ""

  if (firstLineTrimmed.startsWith("sequencediagram")) {
    cleanedCode = fixSequenceDiagramSyntax(cleanedCode)
  } else if (firstLineTrimmed.startsWith("graph") || firstLineTrimmed.startsWith("flowchart")) {
    cleanedCode = fixFlowchartSyntax(cleanedCode)
  } else if (firstLineTrimmed.startsWith("erdiagram")) {
    cleanedCode = fixERDiagramSyntax(cleanedCode)
  } else if (firstLineTrimmed.startsWith("classdiagram")) {
    cleanedCode = fixClassDiagramSyntax(cleanedCode)
  }

  cleanedCode = cleanedCode
    .split("\n")
    .map((line) => line.trim()) // Trim again after specific fixes
    .filter((line) => line.length > 0 || line === "") // Keep single empty lines for readability if intended
    .join("\n")
    // Remove excessive blank lines (more than 2 consecutive)
    .replace(/\n{3,}/g, "\n\n")

  return cleanedCode.trim() // Final trim
}

function cleanInvalidSyntax(code: string): string {
  let cleaned = code
  cleaned = cleaned.replace(/ERROR\s*--\s*ERROR_TYPE\s*:\s*[^\n]*/gi, "")
  cleaned = cleaned.replace(/\bERROR[:\s]/gi, "Error_Node ") // Replace isolated ERROR keyword if followed by : or space
  cleaned = cleaned.replace(/\bIDENTIFYING\b(?!\s*:\s*")/gi, "Identifying_Attr ") // Avoid 'identifying' if not part of ER label
  cleaned = cleaned.replace(/\bBelow\b/gi, "Attribute_Below ")

  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, "\n\n") // Consolidate multiple blank lines

  return cleaned
}

function fixERDiagramSyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []
  let inEntityBlock = false

  for (const line of lines) {
    let fixedLine = line.trim()

    if (!fixedLine && !inEntityBlock) {
      // Allow empty lines outside blocks
      fixedLines.push(fixedLine)
      continue
    }
    if (fixedLine.toLowerCase() === "erdiagram") {
      fixedLines.push(fixedLine)
      continue
    }

    if (fixedLine.endsWith("{")) inEntityBlock = true
    if (fixedLine.startsWith("}")) inEntityBlock = false

    // Relationship: ENTITY |relationship|--|cardinality| ENTITY : "label"
    const relMatch = fixedLine.match(/^(\w+)\s*([|o}{]+[-.]+?[|o}{]+)\s*(\w+)\s*:\s*(.+)$/)
    if (relMatch) {
      let [, entity1, relation, entity2, label] = relMatch
      label = label.trim()
      if (!label.startsWith('"') || !label.endsWith('"')) {
        label = `"${label.replace(/"/g, "''")}"` // Escape inner quotes for label
      }
      fixedLine = `${entity1} ${relation} ${entity2} : ${label}`
    }
    // Entity definition: ENTITY { type name "comment" }
    else if (fixedLine.match(/^\w+\s*\{/)) {
      // Start of an entity block
      // Handled by block logic or pass as is
    } else if (inEntityBlock && !fixedLine.startsWith("}")) {
      // Inside an entity block
      const attrMatch = fixedLine.match(/^(\w+)\s+(\w+)(\s*(?:PK|FK))?(\s*".*?")?$/)
      if (attrMatch) {
        const [, type, name, keyConstraint, comment] = attrMatch
        fixedLine = `  ${type} ${name}`
        if (keyConstraint) fixedLine += keyConstraint.trim()
        if (comment) fixedLine += ` ${comment.trim()}`
      }
    }

    fixedLines.push(fixedLine)
  }

  return fixedLines.join("\n")
}

function fixClassDiagramSyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []
  let inClassBlock = false

  for (const line of lines) {
    let fixedLine = line.trim()

    if (!fixedLine && !inClassBlock) {
      fixedLines.push(fixedLine)
      continue
    }
    if (fixedLine.toLowerCase() === "classdiagram") {
      fixedLines.push(fixedLine)
      continue
    }

    if (fixedLine.includes("{")) inClassBlock = true
    if (fixedLine.includes("}")) inClassBlock = false

    // Class definition: class Animal { +String name }
    const classDefMatch = fixedLine.match(/^class\s+([\w~]+(?:\s*<[\w,\s]+>)?)/)
    if (classDefMatch) {
      // fixedLine is likely okay or needs more complex parsing for generics/annotations
    }
    // Member / method
    else if (inClassBlock && !fixedLine.startsWith("}")) {
      // Example: +String name
      // Example: +getName(): String
      const memberMatch = fixedLine.match(
        /^([#|+~-])?\s*([\w<>,\s[\]]+)\s*($$[\w\s,:]*$$)?(\s*:\s*[\w<>[\]]+)?(\s*[*$])?$/,
      )
      if (memberMatch) {
        // This regex is complex; simple pass-through might be safer unless specific errors occur
      }
    }
    // Relationship: Class1 --|> Class2 : Inheritance
    const relMatch = fixedLine.match(
      /^([\w~]+(?:\s*<[\w,\s]+>)?)\s*(<\|--|--\|>|\*--|--\*|o--|--o|-->|<--|--)\s*([\w~]+(?:\s*<[\w,\s]+>)?)(?:\s*:\s*(.+))?$/,
    )
    if (relMatch) {
      let [, classA, arrow, classB, label] = relMatch
      fixedLine = `${classA} ${arrow} ${classB}`
      if (label && label.trim()) {
        label = label.trim()
        if (!label.startsWith('"') || !label.endsWith('"')) {
          label = `"${label.replace(/"/g, "''")}"`
        }
        fixedLine += ` : ${label}`
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

  for (const line of lines) {
    if (line.includes("=>")) {
      const [idPart, defPart] = line.split("=>", 2)
      const id = idPart.trim()
      const [type, ...labelParts] = defPart.trim().split(":")
      const label = labelParts.join(":").trim() // Handle colons in labels
      nodes[id] = { type: type.trim(), label: label || id } // Default label to id if empty
    }
  }

  for (const line of lines) {
    if (line.includes("->") && !line.includes("=>")) {
      const parts = line.split("->")
      for (let i = 0; i < parts.length - 1; i++) {
        const fromPart = parts[i].trim()
        const toPart = parts[i + 1].trim()

        const conditionMatch = fromPart.match(/^(\w+)\s*$$(yes|no)$$$/i)
        if (conditionMatch) {
          connections.push(`${conditionMatch[1]} -- ${conditionMatch[2]} --> ${toPart}`)
        } else {
          connections.push(`${fromPart} --> ${toPart}`)
        }
      }
    }
  }

  let mermaidCode = "graph TD\n"
  for (const [id, node] of Object.entries(nodes)) {
    let nodeShape = "[]" // Default operation
    if (node.type === "start" || node.type === "end")
      nodeShape = "(())" // Rounded
    else if (node.type === "condition")
      nodeShape = "{}" // Diamond
    // inputoutput: >]
    else if (node.type === "input" || node.type === "io" || node.type === "inputoutput") nodeShape = "[>]"

    mermaidCode += `    ${id}${nodeShape[0]}"${node.label.replace(/"/g, "#quot;")}"${nodeShape.substring(1)}\n`
  }
  for (const conn of connections) {
    mermaidCode += `    ${conn}\n`
  }
  return mermaidCode
}

function fixSequenceDiagramSyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []
  let lastKnownSender = ""
  const declaredParticipants = new Set<string>()

  // First line must be sequenceDiagram
  if (lines.length === 0 || lines[0].trim().toLowerCase() !== "sequencediagram") {
    fixedLines.push("sequenceDiagram")
  } else {
    fixedLines.push(lines[0].trim())
  }

  // Collect explicit participant/actor declarations first
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    const participantMatch = line.match(/^(participant|actor)\s+(.+)/i)
    if (participantMatch) {
      let name = participantMatch[2].trim()
      if (/\s/.test(name) && !/^".*"$/.test(name) && !/^'.*'$/.test(name)) {
        name = `"${name}"` // Quote if contains space and not already quoted
      }
      declaredParticipants.add(name)
      // Don't add to fixedLines yet, will be added in order later
    }
  }

  // Add all declared participants at the top
  declaredParticipants.forEach((p) => fixedLines.push(`participant ${p}`))

  for (let i = 1; i < lines.length; i++) {
    let fixedLine = lines[i].trim()
    if (!fixedLine) continue

    // Skip already processed participant/actor declarations
    if (fixedLine.match(/^(participant|actor)\s+(.+)/i)) {
      continue
    }

    // Arrow syntax: (ActorA|ActorB) ArrowType (ActorC|ActorD): MessageText
    // Arrow Types: ->, ->>, -->, -->>, -x, --x, -+, --+
    const arrowRegex = /^(.*?)\s*(--?(?:>>?|x>?>?|\+>?>?)|->>?|-x|-+)\s*(.*?)(?:\s*:\s*(.*))?$/
    let match = fixedLine.match(arrowRegex)

    // Handle lines that might be missing a sender (e.g. "->> Server: Request")
    if (!match && fixedLine.match(/^\s*(--?(?:>>?|x>?>?|\+>?>?)|->>?|-x|-+)/)) {
      if (lastKnownSender) {
        fixedLine = `${lastKnownSender} ${fixedLine}`
        match = fixedLine.match(arrowRegex) // Re-match
      } else if (declaredParticipants.size > 0) {
        // Use first declared participant if no last sender
        const defaultSender = Array.from(declaredParticipants)[0]
        fixedLine = `${defaultSender} ${fixedLine}`
        match = fixedLine.match(arrowRegex)
      } else {
        // Fallback if no participants declared and no last sender
        fixedLine = `"Actor1" ${fixedLine}` // Add a default actor
        if (!fixedLines.includes(`participant "Actor1"`)) fixedLines.splice(1, 0, `participant "Actor1"`) // Declare it
        match = fixedLine.match(arrowRegex)
      }
    }

    if (match) {
      let [, sender, arrow, receiver, messageText = ""] = match
      sender = sender.trim()
      receiver = receiver.trim()
      messageText = messageText.trim()

      // Correct malformed arrows (e.g. single dash to solid arrow)
      if (arrow === "-") arrow = "->"
      if (arrow === "--") arrow = "-->"

      if (/\s/.test(sender) && !/^".*"$/.test(sender)) sender = `"${sender}"`
      if (/\s/.test(receiver) && !/^".*"$/.test(receiver)) receiver = `"${receiver}"`

      // Add sender/receiver to declaredParticipants if not already there (will be added at top)
      if (!declaredParticipants.has(sender)) {
        fixedLines.splice(1, 0, `participant ${sender}`)
        declaredParticipants.add(sender)
      }
      if (!declaredParticipants.has(receiver)) {
        fixedLines.splice(1, 0, `participant ${receiver}`)
        declaredParticipants.add(receiver)
      }

      lastKnownSender = sender // Update last known sender

      // Sanitize message text: remove patterns that look like new arrows
      messageText = messageText.replace(
        /\b\w+\s*(--?(?:>>?|x>?>?|\+>?>?)|->>?|-x|-+)\s*\w+(?:\s*:.*)?/g,
        "(interaction described)",
      )
      messageText = messageText.replace(/^:/, "").replace(/:$/, "").trim() // Remove leading/trailing colons from message

      fixedLine = `${sender} ${arrow} ${receiver}${messageText ? `: ${messageText}` : ""}`
    }
    // For other constructs (note, loop, activate, etc.), pass them mostly as-is for now.
    // Example: note right of User: This is a note.
    // Example: activate User
    // Example: loop Every minute
    // These might need their own sanitizers if they become problematic.

    // Only add non-participant lines here, as participants are added at the top
    if (!fixedLine.match(/^(participant|actor)\s+(.+)/i)) {
      fixedLines.push(fixedLine)
    }
  }

  // Remove duplicate lines that might have occurred from adding participants and then processing lines
  const uniqueLinesResult = Array.from(new Set(fixedLines))
  return uniqueLinesResult.join("\n")
}

function fixFlowchartSyntax(code: string): string {
  const lines = code.split("\n")
  const fixedLines: string[] = []

  for (const line of lines) {
    let fixedLine = line.trim()

    if (!fixedLine || fixedLine.toLowerCase().startsWith("graph") || fixedLine.toLowerCase().startsWith("flowchart")) {
      fixedLines.push(fixedLine)
      continue
    }

    // Ensure connections have proper arrow syntax
    // A simple heuristic: if a line has words/ids but no typical node definition brackets and no arrows, try to add arrows.
    if (
      !fixedLine.includes("-->") &&
      !fixedLine.includes("->") &&
      !fixedLine.match(/(\[.*?\]|$$.*?$$|{.*?}|$$>.*?$$|(\w+::\w+))/) && // Not a node definition
      fixedLine.match(/\w/) // Contains word characters
    ) {
      const parts = fixedLine.split(/\s+/).filter((p) => p.length > 0) // Split by space and filter empty
      if (parts.length >= 2) {
        fixedLine = parts.join(" --> ")
      }
    }
    fixedLines.push(fixedLine)
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
    const errorBody = await response.text() // Get error body for more details
    console.error("OpenAI API error:", response.status, errorBody)
    throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`)
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  return new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader()
      if (!reader) {
        controller.error(new Error("Failed to get ReadableStream reader.")) // More descriptive error
        // controller.close(); // Not needed here as error is thrown
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
                console.warn("Skipping invalid JSON in OpenAI stream chunk:", e, "Data:", data) // Log problematic data
              }
            }
          }
        }
      } catch (error) {
        console.error("Stream processing error:", error) // Log the error
        controller.error(error)
      } finally {
        reader.releaseLock()
        // controller.close(); // Already closed if [DONE] or error
      }
    },
  })
}
