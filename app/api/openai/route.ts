import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { messages, model = "gpt-3.5-turbo", retryAttempt = 0 } = await req.json()

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
      // Find the last generated diagram code from the conversation
      let lastDiagramCode = ""
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          const content = messages[i].content
          const codeMatch = content.match(/```(?:mermaid)?\n([\s\S]*?)\n```/)
          if (codeMatch) {
            lastDiagramCode = codeMatch[1].trim()
            break
          }
        }
      }

      // Enhanced system message with retry-specific instructions
      const retryInstructions =
        retryAttempt > 0
          ? `

CRITICAL RETRY INSTRUCTIONS (Attempt ${retryAttempt + 1}/3):
- This is a retry attempt due to previous syntax errors
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

      systemMessage = {
        role: "system",
        content: `You are an expert Mermaid diagram generator. You MUST generate ONLY valid Mermaid syntax code.

CRITICAL RULES:
1. NEVER include explanatory text before or after the diagram code
2. ALWAYS start your response directly with the diagram type keyword
3. For flowcharts, ALWAYS use proper connections between nodes with arrows (-->)
4. For sequence diagrams, EVERY arrow MUST have both sender and receiver
5. NEVER start a line with just an arrow (-->> or ->>)
6. When modifying existing diagrams, maintain the same structure and add improvements
7. NEVER use words like "ERROR", "IDENTIFYING", or other invalid keywords
8. ALWAYS use proper Mermaid syntax for each diagram type
9. Use simple, alphanumeric node names without special characters
10. Ensure all syntax follows official Mermaid documentation${retryInstructions}

${
  lastDiagramCode
    ? `EXISTING DIAGRAM CONTEXT:
The user has this existing diagram:
\`\`\`
${lastDiagramCode}
\`\`\`

When making modifications, build upon this existing diagram structure. Maintain existing nodes and connections while adding the requested improvements.`
    : ""
}

SEQUENCE DIAGRAM SYNTAX RULES:
- CORRECT: "ParticipantA ->> ParticipantB: Message"
- CORRECT: "ParticipantA -->> ParticipantB: Response"
- INCORRECT: "->> ParticipantB: Message" (missing sender)
- INCORRECT: "-->> ParticipantB: Response" (missing sender)

FLOWCHART SYNTAX RULES:
- CORRECT: "A[Start] --> B[Process] --> C[End]"
- INCORRECT: "A[Start] B[Process] C[End]" (missing arrows)

ER DIAGRAM SYNTAX RULES:
- CORRECT: "CUSTOMER ||--o{ ORDER : places"
- CORRECT: "USER { int id PK }"
- INCORRECT: "USER ERROR -- ERROR_TYPE : Below"

CLASS DIAGRAM SYNTAX RULES:
- CORRECT: "class User { +String name +login() }"
- CORRECT: "User --> System"
- INCORRECT: "class User ERROR IDENTIFYING"

VALID DIAGRAM TYPES:
- graph TD / graph LR (flowchart)
- sequenceDiagram
- classDiagram
- journey
- gantt
- stateDiagram-v2
- erDiagram
- pie

RESPOND WITH VALID MERMAID CODE ONLY - NO EXPLANATIONS OR ERROR MESSAGES!`,
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
        messages: [systemMessage, ...messages],
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
