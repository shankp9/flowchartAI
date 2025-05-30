"use client"

import type React from "react"

import { useState } from "react"
import { Copy, HelpCircle, Edit } from "lucide-react"
import { serializeCode } from "@/lib/utils"

interface Props {
  code: string
}

export const CodeBlock: React.FC<Props> = ({ code }) => {
  const [label, setLabel] = useState<string>("Copy code")
  const [showHelp, setShowHelp] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback for older browsers
      const el = document.createElement("textarea")
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
    })
  }

  const handleCopyClick = () => {
    copyToClipboard(code)
    setLabel("Copied!")

    setTimeout(() => {
      setLabel("Copy code")
    }, 1000)
  }

  return (
    <pre>
      <div className="bg-black rounded-md mb-4">
        <div className="flex items-center relative text-gray-200 bg-gray-800 px-4 py-2 text-xs font-sans justify-between rounded-t-md">
          <div className="flex items-center">
            <span>mermaid</span>
            <div className="relative ml-2">
              <button
                onMouseEnter={() => setShowHelp(true)}
                onMouseLeave={() => setShowHelp(false)}
                className="cursor-pointer"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
              {showHelp && (
                <div className="absolute bottom-full left-0 mb-2 p-2 bg-white text-black text-xs rounded shadow-lg z-10 whitespace-nowrap">
                  Learn more about{" "}
                  <a
                    href="https://mermaid.js.org/intro/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-blue-600"
                  >
                    Mermaid syntax
                  </a>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`https://mermaid.live/edit#pako:${serializeCode(code)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-white"
            >
              <Edit className="h-4 w-4" /> Edit
            </a>
            <button className="flex items-center gap-1 hover:text-white" onClick={handleCopyClick}>
              <Copy className="h-4 w-4" />
              {label}
            </button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto">
          <code className="!whitespace-pre text-white">{code}</code>
        </div>
      </div>
    </pre>
  )
}
