import { type NextRequest, NextResponse } from "next/server"
import { APP_CONFIG, ERROR_MESSAGES } from "@/lib/constants" // Import constants
import type { Message } from "@/types/type" // Assuming types/type.ts exists

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      model = "gpt-3.5-turbo",
      retryAttempt = 0,
      previousErrors = [],
      currentDiagram = "",
      isModification = false,
      diagramType = null, // This can help guide the AI
    } = await req.json()

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.error("OPENAI_API_KEY environment variable is not set")
      return NextResponse.json({ error: ERROR_MESSAGES.API_KEY_MISSING }, { status: 500 })
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array is required and cannot be empty" }, { status: 400 })
    }

    const isSummaryRequest = messages.some(
      (msg: any) => msg.role === "system" && msg.content.includes("diagram analyst"),
    )

    let systemMessageContent: string

    if (isSummaryRequest) {
      systemMessageContent = `You are an expert diagram analyst. Analyze the given Mermaid diagram and provide: 
    1) A brief summary of what the diagram shows (max 50 words)
    2) Three specific, actionable suggestions for improving or expanding the diagram
    
    Respond ONLY with valid JSON in this exact format:
    {
      "summary": "Brief description of the diagram",
      "suggestions": [
        "First specific suggestion",
        "Second specific suggestion", 
        "Third specific suggestion"
      ]
    }`
    } else {
      const retryInstructions =
        retryAttempt > 0
          ? `
CRITICAL RETRY INSTRUCTIONS (Attempt ${retryAttempt + 1}/${APP_CONFIG.MAX_RETRIES}):
- This is a retry due to previous syntax errors: ${previousErrors.join("; ")}
- YOU MUST START WITH A VALID DIAGRAM KEYWORD.
- Double-check every line for Mermaid syntax correctness.
- NO EXPLANATORY TEXT. ONLY VALID MERMAID CODE.
${retryAttempt === 1 ? "- Focus: Simplify syntax, use basic examples." : ""}
${retryAttempt === 2 ? "- Focus: Use minimal, proven syntax patterns ONLY. ABSOLUTELY START WITH DIAGRAM KEYWORD." : ""}
`
          : ""

      const modificationContext =
        isModification && currentDiagram
          ? `
MODIFICATION CONTEXT:
You are modifying an existing diagram. Current diagram:
\`\`\`mermaid
${currentDiagram}
\`\`\`
MODIFICATION RULES:
- Build upon the existing diagram.
- Preserve existing nodes/connections unless modification is requested.
- Maintain the original diagram type unless explicitly asked to change.
`
          : ""

      const diagramTypeHint = diagramType
        ? `The user likely intends a '${diagramType}' diagram. Prioritize this type if appropriate.`
        : `If unsure of diagram type, try to infer from the request or default to 'graph TD' for flowcharts or 'sequenceDiagram' for interactions.`

      systemMessageContent = `You are an expert Mermaid diagram generator. You MUST generate ONLY valid Mermaid syntax code.

CRITICAL FIRST LINE RULE:
Your response MUST start *directly* with a valid Mermaid diagram type keyword on the VERY FIRST line. NO other text, explanation, or markdown before it.
Examples of CORRECT first lines:
- graph TD
- sequenceDiagram
- classDiagram
- journey
- gantt

GENERAL CRITICAL RULES:
1. NO EXPLANATORY TEXT before or after the diagram code. Your entire response is the Mermaid code.
2. For flowcharts (graph TD/LR), ALWAYS use proper connections with arrows (e.g., A --> B).
3. For sequence diagrams, EVERY arrow MUST have both a sender and a receiver (e.g., ActorA ->> ActorB: Message).
4. NEVER start a sequence diagram message line with just an arrow (e.g., INCORRECT: "->> ActorB: Message").
5. Node names should be simple, alphanumeric, or enclosed in quotes if they contain spaces/special characters (e.g., "Node with spaces").
6. Ensure all syntax follows official Mermaid documentation.
${diagramTypeHint}
${modificationContext}
${retryInstructions}

VALID DIAGRAM TYPES:
- graph TD / graph LR (flowchart)
- sequenceDiagram
- classDiagram
- journey
- gantt
- stateDiagram-v2 (or stateDiagram)
- erDiagram
- pie
- mindmap
- timeline

RESPOND WITH VALID MERMAID CODE ONLY.
`
    }

    const systemMessage: Message = {
      role: "system",
      content: systemMessageContent,
      id: `system-${Date.now()}`,
      timestamp: Date.now(),
    }

    const processedMessages = [...messages] // Use a mutable copy
    if (!isSummaryRequest && isModification && currentDiagram) {
      const lastUserMessage = processedMessages[processedMessages.length - 1]
      if (lastUserMessage && lastUserMessage.role === "user") {
        // This enhanced content is for the AI's internal processing
        const enhancedContent = `${lastUserMessage.content}\n\n(Instruction: Modify the existing diagram provided in the system prompt context based on this request.)`
        processedMessages[processedMessages.length - 1] = {
          ...lastUserMessage,
          content: enhancedContent,
        }
      }
    }

    const apiRequestBody = {
      model,
      messages: [systemMessage, ...processedMessages],
      stream: !isSummaryRequest,
      temperature: retryAttempt > 0 ? 0.15 * retryAttempt : 0.2, // Slightly increase temp for later retries if stuck
      max_tokens: isSummaryRequest ? 300 : 1200, // Increased for potentially complex diagrams
      top_p: 1,
      frequency_penalty: 0.1, // Slightly discourage repetitive tokens
      presence_penalty: 0.1, // Slightly encourage new topics/tokens
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(apiRequestBody),
    })

    if (!response.ok) {
      const errorData = await response.text() // Read as text for more detailed error
      console.error("OpenAI API error:", response.status, errorData)
      let errorMessage = `OpenAI API error: ${response.status}`
      try {
        const parsedError = JSON.parse(errorData)
        if (parsedError.error && parsedError.error.message) {
          errorMessage = parsedError.error.message
        }
      } catch (e) {
        /* Ignore parsing error, use status text */
      }

      if (response.status === 401) errorMessage = ERROR_MESSAGES.API_KEY_MISSING
      else if (response.status === 429) errorMessage = ERROR_MESSAGES.RATE_LIMIT

      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    if (isSummaryRequest) {
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ""
      return new Response(content, { headers: { "Content-Type": "application/json; charset=utf-8" } })
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) {
          controller.error(new Error("Failed to get ReadableStream reader."))
          return
        }
        const decoder = new TextDecoder()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value)
            controller.enqueue(new TextEncoder().encode(chunk))
          }
        } catch (error) {
          console.error("Stream error:", error)
          controller.error(error)
        } finally {
          reader.releaseLock()
          controller.close()
        }
      },
    })

    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
  } catch (error: any) {
    console.error("API route error:", error)
    return NextResponse.json({ error: error.message || ERROR_MESSAGES.UNKNOWN_ERROR }, { status: 500 })
  }
}
