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
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
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
      // Enhanced system message with comprehensive error prevention
      const retryInstructions = getRetryInstructions(retryAttempt, previousErrors)
      const contextInstructions = getContextInstructions(isModification, currentDiagram)
      const diagramSpecificInstructions = getDiagramSpecificInstructions(diagramType)

      systemMessage = {
        role: "system",
        content: `You are an expert Mermaid diagram generator. You MUST generate ONLY valid Mermaid syntax code.

CRITICAL RULES - NEVER VIOLATE THESE:
1. ALWAYS start your response directly with the diagram type keyword (graph, sequenceDiagram, etc.)
2. NEVER include explanatory text, comments, or descriptions
3. NEVER use words like "ERROR", "UNDEFINED", "NULL", "INVALID", "PARSE ERROR"
4. NEVER start lines with arrows without specifying the sender
5. ALWAYS use proper Mermaid syntax as per official documentation
6. ALWAYS ensure all brackets, parentheses, and quotes are properly matched
7. NEVER use special characters that aren't part of Mermaid syntax
8. ALWAYS validate each line follows proper Mermaid patterns

${retryInstructions}
${contextInstructions}
${diagramSpecificInstructions}

RESPONSE FORMAT:
- Start immediately with diagram type (e.g., "graph TD" or "sequenceDiagram")
- Follow with properly formatted Mermaid syntax
- End when diagram is complete
- NO additional text or explanations

VALIDATION CHECKLIST:
✓ Starts with valid diagram type
✓ All node names are alphanumeric
✓ All connections use proper arrow syntax
✓ All brackets and quotes are matched
✓ No error keywords present
✓ Follows official Mermaid documentation

RESPOND WITH VALID MERMAID CODE ONLY!`,
      }
    }

    // Process the last user message and enhance it with context if needed
    const processedMessages = [...messages]

    if (!isSummaryRequest && isModification && currentDiagram) {
      // Get the last user message
      const lastMessage = processedMessages[processedMessages.length - 1]

      if (lastMessage && lastMessage.role === "user") {
        // Enhance the user message with context for the AI
        const enhancedContent = `${lastMessage.content}

MODIFICATION CONTEXT: Build upon this existing diagram while maintaining its structure and adding the requested changes.`

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
        temperature: getTemperatureForAttempt(retryAttempt),
        max_tokens: isSummaryRequest ? 300 : 1200,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
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

function getRetryInstructions(retryAttempt: number, previousErrors: string[]): string {
  if (retryAttempt === 0) return ""

  const errorContext =
    previousErrors.length > 0
      ? `\nPREVIOUS ERRORS TO AVOID:\n${previousErrors.map((err, i) => `${i + 1}. ${err}`).join("\n")}`
      : ""

  switch (retryAttempt) {
    case 1:
      return `
RETRY ATTEMPT 2/3 - SIMPLIFY APPROACH:
- Use only basic, proven Mermaid syntax patterns
- Avoid complex features or advanced syntax
- Use simple alphanumeric node names only
- Ensure every line follows basic patterns${errorContext}`

    case 2:
      return `
FINAL RETRY ATTEMPT 3/3 - MINIMAL SYNTAX ONLY:
- Use the most basic Mermaid syntax possible
- Copy patterns from official Mermaid documentation
- Use only single-word node names
- Avoid any advanced or complex features
- Ensure absolute syntax correctness${errorContext}`

    default:
      return ""
  }
}

function getContextInstructions(isModification: boolean, currentDiagram: string): string {
  if (!isModification || !currentDiagram) return ""

  return `
MODIFICATION MODE - EXISTING DIAGRAM:
${currentDiagram}

MODIFICATION RULES:
- Preserve the existing diagram structure
- Maintain all current nodes and connections
- Add only the requested changes
- Keep the same diagram type
- Ensure compatibility with existing elements`
}

function getDiagramSpecificInstructions(diagramType: string | null): string {
  switch (diagramType) {
    case "flowchart":
      return `
FLOWCHART SPECIFIC RULES:
- Start with "graph TD" or "graph LR"
- Use format: NodeID[Label] --> NodeID2[Label2]
- Valid shapes: [] {} () (()) >] 
- Always include arrows between connected nodes`

    case "sequence":
      return `
SEQUENCE DIAGRAM SPECIFIC RULES:
- Start with "sequenceDiagram"
- Declare participants: participant Name
- Use format: ParticipantA ->> ParticipantB: Message
- Valid arrows: ->> -->> -x --x
- NEVER start lines with arrows without sender`

    case "class":
      return `
CLASS DIAGRAM SPECIFIC RULES:
- Start with "classDiagram"
- Use format: class ClassName { +method() }
- Relationships: --> <|-- --|> <--
- Methods: +public -private #protected`

    case "er":
      return `
ER DIAGRAM SPECIFIC RULES:
- Start with "erDiagram"
- Entity format: ENTITY { type field }
- Relationships: ||--o{ ||--|| }o--||
- Always include relationship labels`

    default:
      return `
GENERAL DIAGRAM RULES:
- Use appropriate diagram type keyword
- Follow official Mermaid syntax exactly
- Ensure all syntax is valid and complete`
  }
}

function getTemperatureForAttempt(retryAttempt: number): number {
  switch (retryAttempt) {
    case 0:
      return 0.3 // First attempt - creative but controlled
    case 1:
      return 0.1 // Second attempt - very conservative
    case 2:
      return 0.05 // Final attempt - minimal creativity
    default:
      return 0.3
  }
}
