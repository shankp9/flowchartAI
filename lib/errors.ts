// Centralized error handling
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 500,
    public isOperational = true,
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400)
  }
}

export class APIError extends AppError {
  constructor(message: string, statusCode = 500) {
    super(message, "API_ERROR", statusCode)
  }
}

export class MermaidError extends AppError {
  constructor(
    message: string,
    public originalCode?: string,
  ) {
    super(message, "MERMAID_ERROR", 422)
  }
}

export const ERROR_MESSAGES = {
  INVALID_INPUT: "Invalid input provided",
  API_KEY_MISSING: "OpenAI API key not configured",
  GENERATION_FAILED: "Failed to generate diagram",
  PARSING_FAILED: "Failed to parse diagram code",
  NETWORK_ERROR: "Network connection error",
  RATE_LIMIT: "Rate limit exceeded",
} as const

export function handleError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    return new AppError(error.message, "UNKNOWN_ERROR")
  }

  return new AppError("An unknown error occurred", "UNKNOWN_ERROR")
}
