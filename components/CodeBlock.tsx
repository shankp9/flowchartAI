"use client"

import type React from "react"

import Link from "next/link"
import { useState } from "react"
import { Copy, HelpCircle, Edit, Check } from "lucide-react"

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"

import { serializeCode } from "@/lib/utils"
import { Button } from "./ui/button"

interface Props {
  code: string
}

export const CodeBlock: React.FC<Props> = ({ code }) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  return (
    <div className="relative rounded-lg border bg-muted/50 overflow-hidden">
      <div className="flex items-center justify-between bg-muted px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">mermaid</span>
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <HelpCircle className="h-4 w-4" />
                <span className="sr-only">Mermaid syntax help</span>
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2">
                <h4 className="font-medium">Mermaid Diagram Syntax</h4>
                <p className="text-sm text-muted-foreground">
                  Learn more about{" "}
                  <Link
                    href="https://mermaid.js.org/intro/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Mermaid syntax
                  </Link>
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 gap-1" asChild>
            <Link href={`https://mermaid.live/edit#pako:${serializeCode(code)}`} target="_blank" rel="noreferrer">
              <Edit className="h-3.5 w-3.5" />
              <span>Edit</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => copyToClipboard(code)}>
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      </div>
      <div className="max-h-[500px] overflow-y-auto p-4">
        <pre className="text-sm">
          <code className="whitespace-pre text-foreground">{code}</code>
        </pre>
      </div>
    </div>
  )
}
