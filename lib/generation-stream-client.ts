import { authenticatedFetch, AuthApiError } from "@/lib/auth-api"
import type { GenerationStage } from "@/lib/generation-progress"

export type GenerationStreamEvent = {
  type: "started" | "stage" | "delta" | "completed" | "error"
  requestId: string
  stage?: GenerationStage
  text?: string
  status?: number
  payload?: Record<string, unknown>
}

type StreamOptions = {
  onEvent?: (event: GenerationStreamEvent) => void
}

export function generationStageIndex(stage: GenerationStage): number {
  return {
    queued: 0,
    provider: 1,
    validating: 2,
    saving: 3,
    completed: 3,
  }[stage]
}

function parseEvent(block: string): GenerationStreamEvent | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("\n")
  if (!data) return null

  try {
    return JSON.parse(data) as GenerationStreamEvent
  } catch {
    return null
  }
}

function errorFromEvent(event: GenerationStreamEvent): AuthApiError {
  const payload = event.payload
  const fieldError = Array.isArray(payload?.fields) && typeof payload.fields[0] === "string"
    ? payload.fields[0]
    : undefined
  const message = fieldError
    || (typeof payload?.error === "string" ? payload.error : "Generation failed")
  return new AuthApiError(message, event.status || 500)
}

/** Consume the streamed transport and return the same final payload as JSON generation. */
export async function streamGeneration<T extends Record<string, unknown>>(
  url: string,
  body: unknown,
  options: StreamOptions = {},
): Promise<T> {
  const requestOptions: RequestInit = {
    method: "POST",
    headers: { Accept: "text/event-stream" },
    body: JSON.stringify(body),
  }

  const consumeResponse = async (response: Response): Promise<T> => {
    if (!response.body) throw new AuthApiError("Generation stream was unavailable", 500)

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let completed: T | null = null

    const consumeBlock = (block: string) => {
      const event = parseEvent(block)
      if (!event) return
      options.onEvent?.(event)
      if (event.type === "error") throw errorFromEvent(event)
      if (event.type === "completed") {
        if (!event.payload || event.status !== 200) throw errorFromEvent(event)
        completed = event.payload as T
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() || ""
      for (const block of blocks) consumeBlock(block)
      if (done) break
    }
    if (buffer.trim()) consumeBlock(buffer)

    if (!completed) throw new AuthApiError("Generation stream ended before completion", 502)
    return completed
  }

  const requestStream = async (): Promise<Response> => {
    try {
      return await authenticatedFetch(url, requestOptions)
    } catch (error) {
      if (error instanceof AuthApiError) throw error
      throw new AuthApiError("Network error occurred", 500)
    }
  }

  const response = await requestStream()
  try {
    return await consumeResponse(response)
  } catch (error) {
    if (!(error instanceof AuthApiError) || error.status !== 401) throw error

    try {
      const refreshResponse = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
      })
      if (!refreshResponse.ok) throw error
    } catch {
      throw error
    }

    return consumeResponse(await requestStream())
  }
}
