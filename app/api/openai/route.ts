import { type NextRequest, NextResponse } from "next/server"

interface RequestBody {
  messages: Array<{
    role: string
    content: string
  }>
  model?: string
  retryAttempt?: number
  previousErrors?: string[]
  currentDiagram?: string
  isModification?: boolean
  diagramType?: string | null
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json()
    const {
      messages,
      model = "gpt-3.5-turbo",
      retryAttempt = 0,
      previousErrors = [],
      currentDiagram = "",
      isModification = false,
      diagramType = null,
    } = body

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
2) Three specific, actionable suggestions that will generate VALID Mermaid v11.6.0 syntax

CRITICAL SUGGESTION RULES FOR MERMAID v11.6.0:
- Suggestions MUST result in valid, renderable Mermaid v11.6.0 diagrams
- Focus on structural improvements (add nodes, connections, decision points)
- Ensure suggestions work with the current diagram type
- Use simple, clear language that translates to basic Mermaid elements
- Consider v11.6.0 features like mindmaps, timelines, and enhanced C4 diagrams
Diagram Validity:
All suggestions must result in valid, renderable Mermaid v11.6.0 diagrams with zero syntax errors.

Type Awareness:
Detect and respect the current Mermaid diagram type (flowchart, sequenceDiagram, classDiagram, stateDiagram, mindmap, timeline, erDiagram, C4, etc.).
Never use syntax incompatible with the current type.

Structural Focus:
Your suggestions should:

    Add meaningful nodes, edges, or components

    Include decision points, hierarchy, parallel flows, or modular structure

    Improve clarity or completeness of the diagram

VALID SUGGESTION EXAMPLES:
- "Add error handling paths to the process flow"
- "Include a decision point for user authentication"
- "Add parallel processing branches"
- "Include start and end nodes"
- "Add validation steps between processes"
- "Create a mindmap view of the process"
- "Add timeline elements for sequential steps"

AVOID SUGGESTIONS THAT:
- Require experimental features
- Use non-standard syntax
- Need external integrations

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
      // Enhanced system message with v11.6.0 specific instructions
      const retryInstructions =
        retryAttempt > 0
          ? `

CRITICAL RETRY INSTRUCTIONS (Attempt ${retryAttempt + 1}/3):
- This is a retry attempt due to previous syntax errors
- Previous errors: ${previousErrors.join("; ")}
- Use ONLY the most basic, validated Mermaid v11.6.0 syntax
- Avoid complex features that might cause parsing errors
- Start directly with diagram type keyword
- Use simple node names without special characters
- Ensure all arrows and connections are properly formatted
- Escape special characters in labels (&lt;, &gt;, &amp;)
- Double-check every line for syntax correctness
- NO explanatory text, ONLY valid Mermaid code

RETRY FOCUS:
${retryAttempt === 1 ? "- Simplify syntax and use basic examples" : ""}
${retryAttempt === 2 ? "- Use minimal syntax with proven patterns only" : ""}
`
          : ""

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
        content: `You are an expert Mermaid diagram generator. You MUST generate ONLY valid Mermaid syntax code that is compatible with Mermaid version 11.6.0 EXACTLY.

CRITICAL COMPATIBILITY RULES FOR MERMAID 11.6.0:
1. NEVER include explanatory text before or after the diagram code
2. ALWAYS start your response directly with the diagram type keyword
3. Use ONLY syntax that is fully compatible with Mermaid v11.6.0
4. ALWAYS escape special characters in labels using HTML entities (&lt;, &gt;, &amp;)
5. Ensure proper spacing around all operators and arrows
6. Use double quotes for labels containing special characters or spaces

SUPPORTED DIAGRAM TYPES IN MERMAID 11.6.0:
- graph TD/LR/TB/RL (flowchart)
- flowchart TD/LR/TB/RL (enhanced flowchart)
- sequenceDiagram
- classDiagram
- stateDiagram-v2
- erDiagram
- journey
- gantt
- pie title "Chart Title"
- gitGraph
- mindmap
- timeline
- sankey-beta
- requirementDiagram
- c4Context, c4Container, c4Component, c4Dynamic, c4Deployment

MANDATORY SYNTAX VALIDATION FOR VERSION 11.6.0:
- Every line must follow exact Mermaid 11.6.0 specification
- Escape all special characters (&lt;, &gt;, &amp;) in node labels
- Use proper bracket matching for all constructs
- Ensure all node IDs are alphanumeric with underscores only
- Test compatibility with Mermaid 11.6.0 syntax rules

FLOWCHART RULES (v11.6.0 compatible):
- Use: graph TD, graph LR, flowchart TD, flowchart LR
- Node syntax: A[Text], B(Text), C{Text}, D((Text))
- Connection syntax: A --> B, A --- B, A -.- B
- Labels: A -->|label| B (escape special chars in labels)
- Subgraphs: subgraph title ... end

SEQUENCE DIAGRAM RULES (v11.6.0 compatible):
- Start with: sequenceDiagram
- Participant syntax: participant A, participant B as "Name"
- Arrow syntax: A->>B: Message, A-->>B: Response, A-xB: Cancel
- NEVER start arrows without sender
- Escape special characters in messages
- Support for notes, loops, alternatives

CLASS DIAGRAM RULES (v11.6.0 compatible):
- Start with: classDiagram
- Class syntax: class ClassName
- Method syntax: ClassName : methodName()
- Attribute syntax: ClassName : attributeName
- Relationship syntax: ClassA --|> ClassB, ClassA --> ClassB
- Support for interfaces and abstract classes

ER DIAGRAM RULES (v11.6.0 compatible):
- Start with: erDiagram
- Entity syntax: ENTITY { type attribute }
- Relationship syntax: ENTITY ||--o{ OTHER_ENTITY : relationship
- Support for cardinality and relationship labels

MINDMAP RULES (v11.6.0 compatible):
- Start with: mindmap
- Root syntax: root((Central Topic))
- Branch syntax: A[Branch], B(Branch), C{{Branch}}
- Nested structure with proper indentation

TIMELINE RULES (v11.6.0 compatible):
- Start with: timeline
- Title syntax: title Timeline Title
- Event syntax: period : event
- Support for multiple events per period

C4 DIAGRAM RULES (v11.6.0 compatible):
- Start with: c4Context, c4Container, c4Component, etc.
- Person syntax: Person(alias, "Label")
- System syntax: System(alias, "Label")
- Relationship syntax: Rel(from, to, "Label")

RESPONSE FORMAT:
- Start immediately with diagram type (no explanation)
- Use only validated, 11.6.0 compatible syntax
- End immediately after diagram (no explanation)
- Escape all special characters in labels
- Maximum clarity while meeting user requirements${retryInstructions}${contextInstructions}

RESPOND WITH MERMAID 11.6.0 COMPATIBLE CODE ONLY!`,
      }
    }

    // Process the last user message and enhance it with context if needed
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
