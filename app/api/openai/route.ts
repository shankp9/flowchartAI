import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      model = "gpt-3.5-turbo",
      retryAttempt = 0,
      previousErrors = [],
      currentDiagram = "",
      isModification = false,
      diagramType = null,
    } = await req.json()

    // Get API key from environment variables
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.error("OPENAI_API_KEY environment variable is not set")
      return NextResponse.json(
        {
          error: "OpenAI API key not configured. Please set the OPENAI_API_KEY environment variable.",
        },
        { status: 500 },
      )
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 })
    }

    // Check if this is a summary request
    const isSummaryRequest = messages.some(
      (msg: any) => msg.role === "system" && msg.content.includes("diagram analyst"),
    )

    let systemMessage
    if (isSummaryRequest) {
      systemMessage = {
        role: "system",
        content: `You are an expert Mermaid diagram analyst. Analyze the given diagram and provide:
1) A brief summary of what the diagram shows (max 50 words)
2) Three specific, actionable suggestions that will generate VALID Mermaid syntax

CRITICAL SUGGESTION RULES:
- Suggestions MUST result in valid, renderable Mermaid diagrams
- Focus on structural improvements (add nodes, connections, decision points)
- Avoid suggestions that require complex syntax or experimental features
- Ensure suggestions work with the current diagram type
- Use simple, clear language that translates to basic Mermaid elements

VALID SUGGESTION EXAMPLES:
- "Add error handling paths to the process flow"
- "Include a decision point for user authentication"
- "Add parallel processing branches"
- "Include start and end nodes"
- "Add validation steps between processes"

AVOID SUGGESTIONS THAT:
- Require complex styling or theming
- Use experimental Mermaid features
- Need external integrations
- Require non-standard syntax

Respond ONLY with valid JSON in this exact format:
{
  "summary": "Brief description of the diagram",
  "suggestions": [
    "First specific, renderable suggestion",
    "Second specific, renderable suggestion", 
    "Third specific, renderable suggestion"
  ]
}`,
      }
    } else {
      // Enhanced system message with retry-specific instructions
      const retryInstructions =
        retryAttempt > 0
          ? `

CRITICAL RETRY INSTRUCTIONS (Attempt ${retryAttempt + 1}/3):
- This is a retry attempt due to previous syntax errors
- Previous errors: ${previousErrors.join("; ")}
- Use ONLY the most basic, validated Mermaid syntax
- Avoid complex features that might cause parsing errors
- Start directly with diagram type keyword
- Use simple node names without special characters
- Ensure all arrows and connections are properly formatted
- Double-check every line for syntax correctness
- NO explanatory text, ONLY valid Mermaid code

RETRY FOCUS:
${retryAttempt === 1 ? "- Simplify syntax and use basic examples" : ""}
${retryAttempt === 2 ? "- Use minimal syntax with proven patterns only" : ""}
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
        content: `You are an expert Mermaid diagram generator. You MUST generate ONLY valid Mermaid syntax code that is compatible with Mermaid version 11.6.0.

CRITICAL COMPATIBILITY RULES FOR MERMAID 11.6.0:
1. NEVER include explanatory text before or after the diagram code
2. ALWAYS start your response directly with the diagram type keyword
3. Use ONLY basic, well-established Mermaid syntax - NO experimental features
4. NEVER use deprecated syntax or newer features not available in v11.6.0
5. Stick to simple, proven patterns that have been stable for years

SUPPORTED DIAGRAM TYPES IN MERMAID 11.6.0:
- graph TD/LR/TB/RL (flowchart)
- sequenceDiagram
- classDiagram
- stateDiagram
- erDiagram
- journey
- gantt
- pie
- gitGraph
- requirementDiagram
- c4Context/c4Container/c4Component

MANDATORY SYNTAX VALIDATION:
- Every line must follow exact Mermaid specification
- No custom or experimental syntax elements
- Use only alphanumeric characters and basic symbols
- Ensure all brackets, braces, and quotes are properly matched
- Test compatibility with Mermaid 11.6.0 syntax rules

FLOWCHART RULES (v11.6.0 compatible):
- Use: graph TD, graph LR, graph TB, graph RL only
- Node syntax: A[Text], B(Text), C{Text}, D((Text))
- Connection syntax: A --> B, A --- B, A -.- B
- Labels: A -->|label| B
- NEVER use: complex styling, custom themes, advanced features

SEQUENCE DIAGRAM RULES (v11.6.0 compatible):
- Start with: sequenceDiagram
- Participant syntax: participant A, participant B as Name
- Arrow syntax: A->>B: Message, A-->>B: Response, A-xB: Cancel
- NEVER start arrows without sender: CORRECT "A->>B", INCORRECT "->>B"
- NEVER use: advanced formatting, complex interactions

RESPONSE FORMAT:
- Start immediately with diagram type (no explanation)
- Use only validated, compatible syntax
- End immediately after diagram (no explanation)
- Maximum simplicity while meeting user requirements${retryInstructions}${contextInstructions}

RESPOND WITH MERMAID 11.6.0 COMPATIBLE CODE ONLY!`,
      }
    }

    // Process the last user message and enhance it with context if needed
    const processedMessages = [...messages]

    if (!isSummaryRequest && isModification && currentDiagram) {
      // Get the last user message
      const lastMessage = processedMessages[processedMessages.length - 1]

      if (lastMessage && lastMessage.role === "user") {
        // Enhance the user message with context for the AI, but this won't be shown to the user
        const enhancedContent = `${lastMessage.content}

Based on the current diagram, please modify it according to the request while maintaining the existing structure and connections.`

        // Replace the last message with the enhanced version
        processedMessages[processedMessages.length - 1] = {
          ...lastMessage,
          content: enhancedContent,
        }
      }
    }

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
        temperature: retryAttempt > 0 ? 0.1 : 0.2, // Lower temperature for retries
        max_tokens: isSummaryRequest ? 300 : 1000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("OpenAI API error:", response.status, errorData)

      if (response.status === 401) {
        return NextResponse.json(
          { error: "Invalid OpenAI API key. Please check your API key configuration." },
          { status: 401 },
        )
      }

      return NextResponse.json({ error: `OpenAI API error: ${response.status}` }, { status: response.status })
    }

    // Handle non-streaming response for summary requests
    if (isSummaryRequest) {
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ""
      return new Response(content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
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
      },
    })
  } catch (error) {
    console.error("API route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
