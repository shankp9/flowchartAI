"use client"

import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { OpenAIModel } from "@/types/type"
import { useState, useEffect } from "react"

interface ModelSelectorProps {
  value: OpenAIModel
  onValueChange: (value: OpenAIModel) => void
}

const models = [
  {
    value: "gpt-3.5-turbo",
    label: "GPT-3.5 Turbo",
  },
  {
    value: "gpt-4",
    label: "GPT-4",
  },
]

export function ModelSelector({ value, onValueChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)

  const selectedModel = models.find((model) => model.value === value)

  useEffect(() => {
    if (value) {
      localStorage.setItem("model", value)
    }
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-[180px] justify-between">
          {selectedModel?.label || "Select model"}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-0">
        <Command>
          <CommandInput placeholder="Search model..." />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup>
              {models.map((model) => (
                <CommandItem
                  key={model.value}
                  value={model.value}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue as OpenAIModel)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === model.value ? "opacity-100" : "opacity-0")} />
                  {model.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
