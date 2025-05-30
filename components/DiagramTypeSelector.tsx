"use client"

import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { DiagramType } from "@/types/type"
import { useState } from "react"

interface DiagramTypeSelectorProps {
  value: DiagramType
  onValueChange: (value: DiagramType) => void
}

const diagramTypes = [
  {
    value: "flowchart",
    label: "Flowchart",
  },
  {
    value: "sequence",
    label: "Sequence Diagram",
  },
  {
    value: "class",
    label: "Class Diagram",
  },
  {
    value: "journey",
    label: "User Journey",
  },
  {
    value: "gantt",
    label: "Gantt Chart",
  },
  {
    value: "c4c",
    label: "C4C Diagram",
  },
]

export function DiagramTypeSelector({ value, onValueChange }: DiagramTypeSelectorProps) {
  const [open, setOpen] = useState(false)

  const selectedType = diagramTypes.find((type) => type.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-[180px] justify-between">
          {selectedType?.label || "Select diagram"}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-0">
        <Command>
          <CommandInput placeholder="Search diagram type..." />
          <CommandList>
            <CommandEmpty>No diagram type found.</CommandEmpty>
            <CommandGroup>
              {diagramTypes.map((type) => (
                <CommandItem
                  key={type.value}
                  value={type.value}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue as DiagramType)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === type.value ? "opacity-100" : "opacity-0")} />
                  {type.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
