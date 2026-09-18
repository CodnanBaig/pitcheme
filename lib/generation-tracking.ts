import { prisma } from "@/lib/prisma"

export type GenerationType = "proposal" | "pitch-deck"
export type GenerationStatus = "completed" | "failed"

export interface GenerationTrackingInput {
  requestId: string
  userId: string
  generationType: GenerationType
  documentId?: string
  model?: string
  promptVersion?: string
  totalTokens?: number
  durationMs?: number
  estimatedCost?: number
  status: GenerationStatus
  errorCode?: string
  repairAttempted?: boolean
}

function boundedInteger(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(Math.trunc(value as number), 2_147_483_647))
}

function safeErrorCode(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.toLowerCase().replace(/[^a-z0-9_.-]/g, "_").slice(0, 64)
  return normalized || undefined
}

function safeEstimatedCost(value: number | undefined): number | undefined {
  if (!Number.isFinite(value) || (value ?? 0) < 0) return undefined
  return Math.min(Math.round((value ?? 0) * 1_000_000) / 1_000_000, 1_000_000)
}

export function classifyGenerationError(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name.toLowerCase()
    if (name.includes("timeout") || error.message.toLowerCase().includes("timeout")) {
      return "provider_timeout"
    }
    if (name.includes("auth") || error.message.toLowerCase().includes("unauthorized")) {
      return "provider_authentication"
    }
    if (name.includes("validation")) return "output_validation"
    if (name.includes("database") || name.includes("prisma")) return "persistence_failure"
  }
  return "generation_failed"
}

/**
 * Persist operational generation facts without making the user-facing request
 * fail when telemetry storage is unavailable. The payload intentionally omits
 * prompts, generated content, and provider error messages.
 */
export async function recordGeneration(input: GenerationTrackingInput): Promise<void> {
  const generationClient = (prisma as unknown as {
    generation?: { create?: (args: { data: Record<string, unknown> }) => Promise<unknown> }
  }).generation

  // Lightweight API mocks and older local clients may not have the model yet.
  if (!generationClient?.create) return

  try {
    await generationClient.create({
      data: {
        requestId: input.requestId,
        userId: input.userId,
        ...(input.documentId ? { documentId: input.documentId } : {}),
        generationType: input.generationType,
        provider: "openrouter",
        ...(input.model ? { model: input.model.slice(0, 200) } : {}),
        ...(input.promptVersion ? { promptVersion: input.promptVersion.slice(0, 120) } : {}),
        totalTokens: boundedInteger(input.totalTokens),
        durationMs: boundedInteger(input.durationMs),
        ...(safeEstimatedCost(input.estimatedCost) !== undefined
          ? { estimatedCost: safeEstimatedCost(input.estimatedCost) }
          : {}),
        status: input.status,
        ...(safeErrorCode(input.errorCode) ? { errorCode: safeErrorCode(input.errorCode) } : {}),
        repairAttempted: input.repairAttempted === true,
      },
    })
  } catch (error) {
    console.warn("Generation tracking unavailable", {
      requestId: input.requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
  }
}
