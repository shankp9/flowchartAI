"use client"

import type React from "react"

import { useState } from "react"
import { Check, ChevronDown, Copy, Play, Save, Terminal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface File {
  id: string
  name: string
  language: string
  content: string
}

export default function CodeEditor() {
  const [files, setFiles] = useState<File[]>([
    {
      id: "1",
      name: "index.js",
      language: "javascript",
      content: `import React from 'react';\nimport ReactDOM from 'react-dom';\n\nfunction App() {\n  return (\n    <div className="app">\n      <h1>Hello, World!</h1>\n      <p>Welcome to my React app.</p>\n    </div>\n  );\n}\n\nReactDOM.render(<App />, document.getElementById('root'));`,
    },
    {
      id: "2",
      name: "styles.css",
      language: "css",
      content: `.app {\n  font-family: 'Arial', sans-serif;\n  max-width: 800px;\n  margin: 0 auto;\n  padding: 20px;\n}\n\nh1 {\n  color: #333;\n}\n\np {\n  color: #666;\n}`,
    },
    {
      id: "3",
      name: "index.html",
      language: "html",
      content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>React App</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <div id="root"></div>\n  <script src="index.js"></script>\n</body>\n</html>`,
    },
  ])

  const [activeFile, setActiveFile] = useState<string>("1")
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "> npm start",
    "Starting development server...",
    "Compiled successfully!",
    "",
    "You can now view my-app in the browser.",
    "",
    "  Local:            http://localhost:3000",
    "  On Your Network:  http://192.168.1.5:3000",
    "",
    "Note that the development build is not optimized.",
    "To create a production build, use npm run build.",
  ])
  const [isCopied, setIsCopied] = useState(false)

  const handleTabChange = (value: string) => {
    setActiveFile(value)
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const updatedFiles = files.map((file) => {
      if (file.id === activeFile) {
        return { ...file, content: e.target.value }
      }
      return file
    })
    setFiles(updatedFiles)
  }

  const handleCopyCode = () => {
    const currentFile = files.find((file) => file.id === activeFile)
    if (currentFile) {
      navigator.clipboard.writeText(currentFile.content)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  const handleRunCode = () => {
    setTerminalOutput([...terminalOutput, "> Running code...", "Recompiling...", "Compiled successfully!"])
  }

  const currentFile = files.find((file) => file.id === activeFile)

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl overflow-hidden">
      {/* Editor Header */}
      <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-2">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="h-3 w-3 rounded-full bg-red-500"></div>
            <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm text-zinc-400">Code Editor</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400">
            <Save className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" onClick={handleCopyCode}>
            {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" onClick={handleRunCode}>
            <Play className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* File Explorer */}
      <div className="flex h-[600px]">
        <div className="w-48 border-r border-zinc-700 bg-zinc-900 p-2">
          <div className="mb-2 flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium text-zinc-400">EXPLORER</span>
            <ChevronDown className="h-3 w-3 text-zinc-400" />
          </div>
          <div className="space-y-1">
            {files.map((file) => (
              <button
                key={file.id}
                className={`flex w-full items-center rounded px-2 py-1 text-left text-sm ${
                  activeFile === file.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800"
                }`}
                onClick={() => setActiveFile(file.id)}
              >
                <span className="truncate">{file.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex flex-1 flex-col">
          <Tabs value={activeFile} onValueChange={handleTabChange} className="flex-1">
            <div className="border-b border-zinc-700 bg-zinc-900">
              <TabsList className="bg-transparent h-9">
                {files.map((file) => (
                  <TabsTrigger
                    key={file.id}
                    value={file.id}
                    className={`relative h-9 rounded-none border-r border-zinc-700 px-4 data-[state=active]:bg-zinc-800 data-[state=active]:shadow-none`}
                  >
                    <span className="mr-1 text-xs">{file.name}</span>
                    <button className="ml-1 rounded-full p-0.5 hover:bg-zinc-700">
                      <X className="h-3 w-3" />
                    </button>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {files.map((file) => (
              <TabsContent key={file.id} value={file.id} className="flex-1 p-0 data-[state=active]:flex">
                <div className="flex flex-1">
                  <div className="w-12 flex-shrink-0 bg-zinc-900 py-2 text-right">
                    {file.content.split("\n").map((_, i) => (
                      <div key={i} className="px-3 text-xs text-zinc-500">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={file.content}
                    onChange={handleContentChange}
                    className="flex-1 resize-none bg-zinc-800 p-2 font-mono text-sm text-zinc-200 outline-none"
                    spellCheck="false"
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Terminal */}
          <div className="border-t border-zinc-700 bg-zinc-900">
            <div className="flex items-center border-b border-zinc-700 px-4 py-1">
              <Terminal className="mr-2 h-4 w-4 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-400">TERMINAL</span>
            </div>
            <div className="h-32 overflow-auto p-2 font-mono text-xs text-zinc-300">
              {terminalOutput.map((line, i) => (
                <div key={i} className="whitespace-pre">
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
