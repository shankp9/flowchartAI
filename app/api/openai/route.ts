import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { messages, model = "gpt-3.5-turbo" } = await req.json()

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
      systemMessage = {
        role: "system",
        content: `You are an expert Mermaid diagram generator. You MUST respond with ONLY valid Mermaid syntax code, nothing else.

CRITICAL RULES:
1. NEVER include explanatory text before or after the diagram code
2. ALWAYS start your response directly with the diagram type keyword
3. ALWAYS wrap the entire response in a code block with 'mermaid' language identifier

Available diagram types and their syntax:
- Flowchart: "graph TD" or "graph LR"
- Sequence: "sequenceDiagram"
- Class: "classDiagram"
- State: "stateDiagram-v2"
- Entity Relationship: "erDiagram"
- User Journey: "journey"
- Gantt: "gantt"
- Pie Chart: "pie title Chart Title"
- Git Graph: "gitGraph"

Example valid responses:
For flowchart request: "graph TD\n    A[Start] --> B[Process]\n    B --> C[End]"
For sequence request: "sequenceDiagram\n    participant A\n    participant B\n    A->>B: Message"

RESPOND WITH MERMAID CODE ONLY - NO EXPLANATIONS OR ADDITIONAL TEXT!`,
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
        temperature: 0.3, // Lower temperature for more consistent output
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
