"use client"

import type React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GitBranch, Users, Database, Calendar, Workflow, Building } from "lucide-react"

interface DiagramExample {
  title: string
  description: string
  prompt: string
  icon: React.ReactNode
  category: string
}

const examples: DiagramExample[] = [
  {
    title: "User Login Flow",
    description: "Authentication process flowchart",
    prompt:
      "Create a flowchart showing the user login process with email verification, password validation, and error handling",
    icon: <Users className="h-5 w-5" />,
    category: "Flowchart",
  },
  {
    title: "API Sequence",
    description: "Service interaction diagram",
    prompt:
      "Create a sequence diagram showing how a user places an order through a web app, including frontend, backend, payment service, and database interactions",
    icon: <GitBranch className="h-5 w-5" />,
    category: "Sequence",
  },
  {
    title: "Database Schema",
    description: "Entity relationship diagram",
    prompt:
      "Create a class diagram for an e-commerce system with User, Product, Order, and Payment entities showing their relationships",
    icon: <Database className="h-5 w-5" />,
    category: "Class",
  },
  {
    title: "Project Timeline",
    description: "Development schedule",
    prompt:
      "Create a gantt chart for a 3-month web development project including planning, design, development, testing, and deployment phases",
    icon: <Calendar className="h-5 w-5" />,
    category: "Gantt",
  },
  {
    title: "User Journey",
    description: "Customer experience map",
    prompt: "Create a user journey map for an online shopping experience from product discovery to purchase completion",
    icon: <Workflow className="h-5 w-5" />,
    category: "Journey",
  },
  {
    title: "System Architecture",
    description: "C4 context diagram",
    prompt:
      "Create a C4 context diagram for a microservices e-commerce platform showing users, web app, mobile app, and external payment systems",
    icon: <Building className="h-5 w-5" />,
    category: "C4",
  },
]

interface DiagramExamplesProps {
  onExampleSelect: (prompt: string) => void
}

export function DiagramExamples({ onExampleSelect }: DiagramExamplesProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Get Started with Examples</h2>
        <p className="text-muted-foreground">Choose from these popular diagram types or describe your own</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {examples.map((example, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {example.icon}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{example.title}</CardTitle>
                  <CardDescription className="text-sm">{example.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="outline" size="sm" className="w-full" onClick={() => onExampleSelect(example.prompt)}>
                Try this example
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
