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
      // Enhanced system message with strict Mermaid v11.6.0 compatibility
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
        content: `You are an expert Mermaid v11.6.0 diagram generator. You MUST generate ONLY valid, compatible Mermaid syntax code.

CRITICAL COMPATIBILITY RULES FOR MERMAID v11.6.0:
1. NEVER include explanatory text before or after the diagram code
2. ALWAYS start your response directly with the diagram type keyword
3. Use ONLY proven, stable Mermaid syntax patterns
4. AVOID experimental or newer features that may not be supported
5. Use simple, alphanumeric node names (A, B, C, User, System, etc.)
6. NEVER use special characters in node names except underscore
7. Ensure all syntax follows Mermaid v11.6.0 documentation exactly

FLOWCHART RULES (graph TD/LR):
- CORRECT: "A[Start] --> B[Process] --> C[End]"
- CORRECT: "A --> B --> C"
- INCORRECT: "A[Start] B[Process] C[End]" (missing arrows)
- Use only: [], {}, (), (())
- Arrows: -->, -->, -.->

SEQUENCE DIAGRAM RULES:
- CORRECT: "participant A" then "A->>B: Message"
- CORRECT: "A-->>B: Response"
- INCORRECT: "->>B: Message" (missing sender)
- Use only: ->>, -->, -x, --x
- Always declare participants first

CLASS DIAGRAM RULES:
- CORRECT: "class User { +name: string +login() }"
- CORRECT: "User --> System"
- NEVER combine class definition with relationships on same line
- Use proper inheritance: User <|-- Admin
- Use composition: User *-- Address

ER DIAGRAM RULES:
- CORRECT: "USER ||--o{ ORDER : places"
- CORRECT: "USER { int id PK string name }"
- Use only: ||--||, }o--o{, ||--o{
- Always define entities before relationships

JOURNEY RULES:
- CORRECT: "journey\n    title My Journey\n    section Section1\n      Task1: 5: Actor"
- Always include title and sections
- Score format: "Task: score: Actor"

GANTT RULES:
- CORRECT: "gantt\n    title Project\n    dateFormat YYYY-MM-DD\n    Task1 :2024-01-01, 30d"
- Always include title and dateFormat
- Use standard date formats only

STATE DIAGRAM RULES:
- Use: stateDiagram-v2
- CORRECT: "[*] --> State1\n    State1 --> State2"
- Use [*] for start/end states

PIE CHART RULES:
- CORRECT: "pie title Chart\n    \"Label1\" : 42.96\n    \"Label2\" : 50.05"
- Always include title
- Use quotes for labels with spaces

FORBIDDEN ELEMENTS (WILL CAUSE ERRORS):
- Complex styling (%%{wrap}%%, themes in code)
- Subgraphs with complex nesting
- Custom CSS classes
- Advanced formatting
- Experimental syntax
- Non-ASCII characters in node names
- Special symbols: @, #, $, %, ^, &, *, +, =, |, \\, /, ?, <, >

MANDATORY VALIDATION CHECKLIST:
✓ Starts with valid diagram type
✓ No explanatory text
✓ Simple node names only
✓ Proper arrow syntax
✓ No forbidden elements
✓ Compatible with Mermaid v11.6.0
✓ Tested syntax patterns only

RESPOND WITH VALID MERMAID CODE ONLY - NO EXPLANATIONS!${retryInstructions}${contextInstructions}`,
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

Based on the current diagram, please modify it according to the request while maintaining the existing structure and connections. Use only Mermaid v11.6.0 compatible syntax.`

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
        temperature: retryAttempt > 0 ? 0.05 : 0.1, // Very low temperature for consistency
        max_tokens: isSummaryRequest ? 300 : 800, // Reduced to encourage simpler responses
        top_p: 0.9, // Reduce randomness
        frequency_penalty: 0.1, // Slight penalty for repetition
        presence_penalty: 0.1, // Encourage focused responses
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
