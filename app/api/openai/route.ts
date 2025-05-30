import { type NextRequest, NextResponse } from "next/server"
import type { APIRequestBody } from "@/types"
import { APIError, handleError, ERROR_MESSAGES } from "@/lib/errors"
import { APP_CONFIG } from "@/lib/constants"

export async function POST(req: NextRequest) {
  try {
    const body: APIRequestBody = await req.json()

    const {
      messages,
      model = "gpt-3.5-turbo",
      retryAttempt = 0,
      previousErrors = [],
      currentDiagram = "",
      isModification = false,
      diagramType = null,
    } = body

    // Validate API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("OPENAI_API_KEY environment variable is not set")
      throw new APIError(ERROR_MESSAGES.API_KEY_MISSING, 500)
    }

    // Validate request body
    if (!messages || !Array.isArray(messages)) {
      throw new APIError("Messages array is required", 400)
    }

    // Check if this is a summary request
    const isSummaryRequest = messages.some((msg) => msg.role === "system" && msg.content.includes("diagram analyst"))

    let systemMessage
    if (isSummaryRequest) {
      systemMessage = {
        role: "system",
        content: `You are an expert diagram analyst. Analyze the given Mermaid diagram and provide: 
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
}`,
      }
    } else {
      // Enhanced system message with retry-specific instructions
      const retryInstructions =
        retryAttempt > 0
          ? `

RETRY ATTEMPT ${retryAttempt + 1}/${APP_CONFIG.MAX_RETRIES} - PREVIOUS ERRORS DETECTED:
${previousErrors.map((err) => `- ${err}`).join("\n")}

CRITICAL FIXES NEEDED:
- Use ONLY basic Mermaid syntax patterns
- Ensure every arrow has proper spacing: "A --> B"
- Put each connection on its own line
- Use simple alphanumeric node IDs only
- Double-check line formatting and indentation
- NO complex features that might cause parsing errors

SIMPLIFIED APPROACH:
${retryAttempt === 1 ? "- Use minimal syntax with proven patterns" : ""}
${retryAttempt === 2 ? "- Generate the simplest possible valid diagram" : ""}
`
          : ""

      // Context handling for modifications
      const contextInstructions =
        isModification && currentDiagram
          ? `

MODIFICATION CONTEXT:
You are modifying an existing diagram. Here is the current diagram code:

\`\`\`mermaid
${currentDiagram}
\`\`\`

MODIFICATION RULES:
- Build upon the existing diagram structure
- Maintain existing nodes and connections where possible
- Add the requested improvements while preserving the core flow
- Keep the same diagram type unless explicitly asked to change
- Ensure all existing functionality remains intact
- Only modify what's specifically requested
`
          : ""

      systemMessage = {
        role: "system",
        content: `You are an expert Mermaid diagram generator. You MUST generate ONLY valid, properly formatted Mermaid syntax code that renders without errors.

CRITICAL FORMATTING RULES:
1. ALWAYS start directly with the diagram type (graph TD, sequenceDiagram, etc.)
2. NEVER include explanatory text before or after the code
3. Use proper line breaks - each element on its own line
4. Ensure proper spacing around arrows: "A --> B" (spaces around arrows)
5. Use consistent indentation (4 spaces for content)

FLOWCHART RULES:
- Start with: graph TD or graph LR
- Node format: A[Label], B{Decision}, C((Circle)), D(Rounded)
- Connection format: A --> B (always with spaces)
- Each connection on separate line with 4-space indent

SEQUENCE DIAGRAM RULES:
- Start with: sequenceDiagram
- Participant format: participant A as Name
- Arrow format: A->>B: Message (no spaces around arrows)
- Response format: B-->>A: Response

CLASS DIAGRAM RULES:
- Start with: classDiagram
- Class format: class ClassName { +method() }
- Relationship format: ClassA --> ClassB

FORBIDDEN PATTERNS:
- Never use: ERROR, IDENTIFYING, syntax error, parse error
- Never start lines with just arrows: -->> or ->>
- Never concatenate nodes without arrows: A B C
- Never use special characters in node IDs
- Never include markdown code blocks (\`\`\`)

RESPONSE FORMAT:
- Start immediately with diagram type
- No explanations or comments
- Each line properly formatted
- Proper indentation throughout
- End cleanly without extra text

Generate ONLY the Mermaid code that will render perfectly without any syntax errors.${retryInstructions}${contextInstructions}`,
      }
    }

    // Process messages for modifications
    const processedMessages = [...messages]
    if (!isSummaryRequest && isModification && currentDiagram) {
      const lastMessage = processedMessages[processedMessages.length - 1]
      if (lastMessage && lastMessage.role === "user") {
        const enhancedContent = `${lastMessage.content}

Based on the current diagram, please modify it according to the request while maintaining the existing structure and connections.`

        processedMessages[processedMessages.length - 1] = {
          ...lastMessage,
          content: enhancedContent,
        }
      }
    }

    // Make API request
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [systemMessage, ...processedMessages],
        stream: !isSummaryRequest,
        temperature: retryAttempt > 0 ? 0.1 : 0.2,
        max_tokens: isSummaryRequest ? 300 : 1000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("OpenAI API error:", response.status, errorData)

      if (response.status === 401) {
        throw new APIError("Invalid OpenAI API key. Please check your API key configuration.", 401)
      }

      if (response.status === 429) {
        throw new APIError(ERROR_MESSAGES.RATE_LIMIT, 429)
      }

      throw new APIError(`OpenAI API error: ${response.status}`, response.status)
    }

    // Handle non-streaming response for summary requests
    if (isSummaryRequest) {
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ""
      return new Response(content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      })
    }

    // Handle streaming response for diagram generation
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
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
          console.error("Stream error:", error)
          controller.error(error)
        } finally {
          reader.releaseLock()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    const appError = handleError(error)
    console.error("API route error:", appError)

    return NextResponse.json(
      {
        error: appError.message,
        code: appError.code,
        ...(process.env.NODE_ENV === "development" && { stack: appError.stack }),
      },
      { status: appError.statusCode },
    )
  }
}
