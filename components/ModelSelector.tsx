"use client"

import type React from "react"

import { useAtom } from "jotai"
import { Check, ChevronDown, Zap, Brain } from "lucide-react"

import { modelAtom } from "@/lib/atom"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { OpenAIModel } from "@/types/type"

const models: { value: OpenAIModel; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "gpt-3.5-turbo",
    label: "GPT-3.5 Turbo",
    description: "Fast and efficient",
    icon: <Zap className="h-4 w-4" />,
  },
  {
    value: "gpt-4",
    label: "GPT-4",
    description: "Most capable",
    icon: <Brain className="h-4 w-4" />,
  },
]

export function ModelSelector() {
  const [model, setModel] = useAtom(modelAtom)

  const handleModelChange = (newModel: OpenAIModel) => {
    setModel(newModel)
    localStorage.setItem("model", newModel)
  }

  const currentModel = models.find((m) => m.value === model) || models[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {currentModel.icon}
          {currentModel.label}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {models.map((modelOption) => (
          <DropdownMenuItem
            key={modelOption.value}
            onClick={() => handleModelChange(modelOption.value)}
            className="flex items-center gap-3 p-3"
          >
            <div className="flex items-center gap-2 flex-1">
              {modelOption.icon}
              <div className="flex flex-col">
                <span className="font-medium">{modelOption.label}</span>
                <span className="text-xs text-muted-foreground">{modelOption.description}</span>
              </div>
            </div>
            {model === modelOption.value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
