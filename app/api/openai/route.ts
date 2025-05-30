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

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.error("OPENAI_API_KEY environment variable is not set")
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
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
CRITICAL RETRY INSTRUCTIONS (Attempt ${retryAttempt + 1}/3):
- Previous errors: ${previousErrors.join("; ")}
- YOU MUST START WITH A VALID DIAGRAM KEYWORD (e.g., sequenceDiagram, graph TD).
- Double-check every line for Mermaid syntax correctness, especially for sequence diagrams.
- NO EXPLANATORY TEXT. ONLY VALID MERMAID CODE.
${retryAttempt === 1 ? "- Focus: Simplify syntax, use basic examples. Ensure correct arrow types." : ""}
${retryAttempt === 2 ? "- Focus: Use minimal, proven syntax patterns ONLY. ABSOLUTELY START WITH DIAGRAM KEYWORD. Verify all actor interactions." : ""}
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

GENERAL CRITICAL RULES:
1. NO EXPLANATORY TEXT before or after the diagram code. Your entire response is the Mermaid code.
2. Node names should be simple, alphanumeric, or enclosed in quotes if they contain spaces/special characters (e.g., "Node with spaces").
3. Ensure all syntax follows official Mermaid documentation.
${diagramTypeHint}
${modificationContext}
${retryInstructions}

SEQUENCE DIAGRAM CRITICAL RULES:
1. Start with \`sequenceDiagram\`.
2. Declare participants/actors if they are not implicitly defined by messages. Explicit declaration is preferred:
   \`participant Alice\`
   \`actor Bob\`
3. Messages MUST follow the format: \`SenderArrowReceiver: Message Text\`.
   - Arrow types: \`->>\` (solid line with arrow), \`-->>\` (dashed line with arrow), \`->\` (solid line, no arrow head for synchronous return), \`-->\` (dashed line, no arrow head for asynchronous return).
   - Example: \`Alice->>Bob: Hello Bob!\`
   - Example: \`Bob-->>Alice: Hi Alice!\`
4. DO NOT put colons in actor/participant names (e.g., INCORRECT: \`Actor1:System\`). Use "as" for aliases: \`participant A as Alice_System\`.
5. DO NOT combine participant declaration with message sending on the same line like \`Alice: Hello Bob! ->> Bob\`.
6. Ensure every message line clearly defines a Sender, an Arrow, a Receiver, and then a Colon followed by the message text.
   - CORRECT: \`User->>API: Request data\`
   - INCORRECT: \`User API: Request data\` (Missing arrow and colon structure)
   - INCORRECT: \`User ->> API Request data\` (Missing colon before message text)
   - INCORRECT: \`User: ->> API: Request data\` (Colon in sender part)

FLOWCHART (graph TD/LR) CRITICAL RULES:
1. Start with \`graph TD\` (top-down) or \`graph LR\` (left-right).
2. Nodes are defined like: \`nodeId[Node Text]\` (rectangle), \`nodeId(Node Text)\` (rounded), \`nodeId((Node Text))\` (circle), \`nodeId{Node Text}\` (diamond).
3. Connections use arrows: \`A --> B\`, \`A --- B\`, \`A -- text --> B\`.

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

    const systemMessage = {
      role: "system",
      content: systemMessageContent,
    }

    const processedMessages = [...messages]
    if (!isSummaryRequest && isModification && currentDiagram) {
      const lastUserMessage = processedMessages[processedMessages.length - 1]
      if (lastUserMessage && lastUserMessage.role === "user") {
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
      temperature: retryAttempt > 0 ? 0.15 * retryAttempt + 0.1 : 0.2,
      max_tokens: isSummaryRequest ? 350 : 1500,
      top_p: 1,
      frequency_penalty: 0.05,
      presence_penalty: 0.05,
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
      const errorData = await response.text()
      console.error("OpenAI API error:", response.status, errorData)
      let errorMessage = `OpenAI API error: ${response.status}`
      try {
        const parsedError = JSON.parse(errorData)
        if (parsedError.error && parsedError.error.message) {
          errorMessage = `OpenAI: ${parsedError.error.message}`
        }
      } catch (e) {
        /* Ignore parsing error */
      }

      if (response.status === 401) errorMessage = "Invalid OpenAI API key."
      else if (response.status === 429) errorMessage = "OpenAI API rate limit exceeded."

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
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
