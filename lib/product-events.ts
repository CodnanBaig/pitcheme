import { prisma } from "@/lib/prisma"

export type ProductEventName =
  | "generation_started"
  | "generation_completed"
  | "generation_failed"
  | "generation_blocked"
  | "export_used"
  | "export_failed"
  | "edit_saved"
  | "document_restored"
  | "plan_limit_reached"

type ProductEventValue = string | number | boolean | null

export type ProductEventInput = {
  name: ProductEventName
  userId: string
  documentId?: string
  requestId?: string
  metadata?: Record<string, ProductEventValue>
}

function safeMetadata(metadata: Record<string, ProductEventValue> | undefined): string | undefined {
  if (!metadata) return undefined

  const safeEntries = Object.entries(metadata)
    .filter(([key, value]) => /^[A-Za-z0-9_.-]{1,48}$/.test(key)
      && !/(prompt|content|token|secret|password|error|email)/i.test(key)
      && (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"))
    .map(([key, value]) => {
      if (typeof value === "string") return [key, value.slice(0, 160)] as const
      if (typeof value === "number" && Number.isFinite(value)) return [key, value] as const
      return [key, value] as const
    })

  if (safeEntries.length === 0) return undefined

  const bounded: Record<string, ProductEventValue> = {}
  for (const [key, value] of safeEntries) {
    const candidate = JSON.stringify({ ...bounded, [key]: value })
    if (candidate.length > 1_000) break
    bounded[key] = value
  }
  return Object.keys(bounded).length > 0 ? JSON.stringify(bounded) : undefined
}

/**
 * Persist product-level telemetry without making a user-facing request fail.
 * Only bounded identifiers and operational metadata are accepted; prompts,
 * generated content, tokens, and provider error messages are intentionally
 * outside this contract.
 */
export async function recordProductEvent(input: ProductEventInput): Promise<void> {
  const productEventClient = (prisma as unknown as {
    productEvent?: { create?: (args: { data: Record<string, unknown> }) => Promise<unknown> }
  }).productEvent

  if (!productEventClient?.create) return

  try {
    const metadata = safeMetadata(input.metadata)
    await productEventClient.create({
      data: {
        name: input.name,
        userId: input.userId,
        ...(input.documentId ? { documentId: input.documentId } : {}),
        ...(input.requestId ? { requestId: input.requestId.slice(0, 96) } : {}),
        ...(metadata ? { metadata } : {}),
      },
    })
  } catch (error) {
    console.warn("Product telemetry unavailable", {
      requestId: input.requestId,
      event: input.name,
      error: error instanceof Error ? error.name : "unknown",
    })
  }
}
