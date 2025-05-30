# Flowchart AI

Draw flowchart, sequence diagram, class diagram, user journey, gantt, C4C diagram with natural language.

## Getting Started

### Prerequisites

- Docker and Docker Compose installed on your system
- OpenAI API key

### Running with Docker

1. Clone this repository
2. Copy `.env.example` to `.env` and add your OpenAI API key:
   \`\`\`
   cp .env.example .env
   \`\`\`
3. Edit the `.env` file and add your OpenAI API key:
   \`\`\`
   OPENAI_API_KEY=your_openai_api_key_here
   \`\`\`
4. Run the application using Docker Compose:
   \`\`\`
   docker-compose up -d
   \`\`\`
5. Open [http://localhost:3000](http://localhost:3000) in your browser

Alternatively, you can use the provided start script:
\`\`\`
./start.sh
\`\`\`

### Development

If you want to run the application in development mode:

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

- Generate diagrams from natural language descriptions
- Support for multiple diagram types:
  - Flowcharts
  - Sequence diagrams
  - Class diagrams
  - User journeys
  - Gantt charts
  - C4C diagrams
- Interactive diagram editing
- Export diagrams as SVG, PNG, or JPEG
- Dark mode support

## Credits

* [Next.js](https://nextjs.org/)
* [UI](https://ui.shadcn.com/) by shadcn
* [Mermaid.js](https://mermaid.js.org/)
