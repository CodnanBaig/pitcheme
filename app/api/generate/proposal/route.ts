import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { canUserGenerate, incrementUsage, releaseUsage, reserveUsage, type UsageReservation } from "@/lib/subscription"
import { prisma } from "@/lib/prisma"
import { aiService } from "@/lib/ai-service"
import { AI_GENERATION_DEADLINE_MS } from "@/lib/generation-timeout"
import { getGenerationSafetyReason, normalizeGenerationBody, validateGenerationBody, validateGenerationBrief, validateGenerationOptions } from "@/lib/generation-validation"
import { getFieldConfiguration } from "@/lib/field-config"
import { enforceGenerationRateLimit } from "@/lib/generation-rate-limit"
import { validateGeneratedContent } from "@/lib/generation-output"
import { normalizeStructuredOutput } from "@/lib/structured-output"
import { classifyGenerationError, recordGeneration } from "@/lib/generation-tracking"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"
import { estimateGenerationCost } from "@/lib/model-cost"
import { acquireConcurrencySlot } from "@/lib/concurrency-limit"
import { readJsonBody } from "@/lib/request-body"
import { emitGenerationStage } from "@/lib/generation-progress"
import { recordProductEvent } from "@/lib/product-events"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"

export const runtime = "nodejs"
export const maxDuration = 60

interface ProposalBody {
  field?: string
  clientName: string
  clientCompany?: string
  projectTitle?: string
  projectDescription: string
  goals: string
  budget?: string
  timeline?: string
  services?: string | string[]
  fieldSpecificData?: Record<string, string | string[]>
  modelPreference?: "primary" | "fallback" | "lightweight" | "visual"
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  const json = (body: unknown, init: ResponseInit = {}) =>
    NextResponse.json(body, jsonWithRequestId(requestId, init))
  let generationStarted = false
  let generationTracked = false
  let generationResult: Awaited<ReturnType<typeof aiService.generateProposal>> | undefined
  let userId: string | undefined
  let releaseGenerationSlot: (() => void) | null = null
  let usageReservation: UsageReservation | null = null
  let usageCommitted = false
  const useAtomicUsage = process.env.NODE_ENV !== "test" && process.env.RATE_LIMIT_STORE === "mongodb"

  try {
    const session = await auth()

    if (!session?.user?.id) {
      return json({ error: "Unauthorized", requestId }, { status: 401 })
    }
    userId = session.user.id

    if (process.env.NODE_ENV !== "test") {
      const rateLimit = await enforceGenerationRateLimit("proposal", session.user.id)
      if (!rateLimit.allowed) {
        return json(
          { error: "Too many generation requests. Please try again shortly.", requestId },
          { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
        )
      }
    }

    const parsedBody = await readJsonBody(request, 64 * 1024)
    if (!parsedBody.ok) {
      return json(
        { error: parsedBody.reason === "too-large" ? "Request body is too large" : "Invalid JSON request body", requestId },
        { status: parsedBody.reason === "too-large" ? 413 : 400 },
      )
    }
    const rawBody = parsedBody.body

    const validation = validateGenerationBody(rawBody, ["clientName", "projectDescription", "goals"])
    if (!validation.valid) {
      return json({ error: "Invalid request", fields: validation.errors, requestId }, { status: 400 })
    }

    const normalizedBody = normalizeGenerationBody(validation.data)
    const safetyReason = getGenerationSafetyReason(normalizedBody)
    const briefErrors = validateGenerationBrief(normalizedBody, "proposal")
    if (briefErrors.length > 0) {
      if (safetyReason) {
        await recordProductEvent({
          name: "generation_blocked",
          userId: session.user.id,
          requestId,
          metadata: { type: "proposal", reason: safetyReason },
        })
      }
      return json({ error: "Invalid request", fields: briefErrors, requestId }, { status: 400 })
    }

    const body = normalizedBody as unknown as ProposalBody
    const optionErrors = validateGenerationOptions(body as unknown as Record<string, unknown>, "proposal")
    if (optionErrors.length > 0) {
      return json({ error: "Invalid request", fields: optionErrors, requestId }, { status: 400 })
    }
    const field = typeof body.field === "string" && body.field.trim() ? body.field.trim() : "technology"
    if (!getFieldConfiguration(field)) {
      return json({ error: "Invalid request", fields: ["field is not supported"], requestId }, { status: 400 })
    }
    if (useAtomicUsage) {
      usageReservation = await reserveUsage(session.user.id, "proposals")
      if (!usageReservation) {
        await recordProductEvent({
          name: "plan_limit_reached",
          userId: session.user.id,
          requestId,
          metadata: { type: "proposal", field },
        })
        return json(
          {
            error: "Usage limit reached. Please upgrade your plan to generate more proposals.",
            requestId,
          },
          { status: 403 },
        )
      }
    } else {
      const canGenerate = await canUserGenerate(session.user.id, "proposals")
      if (!canGenerate) {
        await recordProductEvent({
          name: "plan_limit_reached",
          userId: session.user.id,
          requestId,
          metadata: { type: "proposal", field },
        })
        return json(
          {
            error: "Usage limit reached. Please upgrade your plan to generate more proposals.",
            requestId,
          },
          { status: 403 },
        )
      }
    }

    if (process.env.NODE_ENV !== "test") {
      releaseGenerationSlot = acquireConcurrencySlot(`proposal-generation:${session.user.id}`)
      if (!releaseGenerationSlot) {
        return json({ error: "A proposal generation is already in progress. Please wait for it to finish.", requestId }, { status: 429 })
      }
    }

    const { 
      clientName, 
      clientCompany, 
      projectTitle, 
      projectDescription, 
      goals, 
      budget, 
      timeline, 
      services,
      fieldSpecificData = {},
      modelPreference 
    } = body

    // Generate proposal using field-specific AI service
    const generationRequest = {
      field,
      clientName,
      clientCompany,
      projectTitle: projectTitle || "Custom Project",
      projectDescription,
      goals,
      budget: budget || "To be determined",
      timeline: timeline || "To be determined",
      services: Array.isArray(services)
        ? services.filter((service): service is string => typeof service === "string" && service.length > 0)
        : [services].filter((service): service is string => typeof service === "string" && service.length > 0),
      fieldSpecificData,
      modelPreference,
      abortSignal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(AI_GENERATION_DEADLINE_MS),
      ]),
    }

    generationStarted = true
    await recordProductEvent({
      name: "generation_started",
      userId: session.user.id,
      requestId,
      metadata: { type: "proposal", field },
    })
    const result = await aiService.generateProposal(generationRequest)
    generationResult = result
    
    const normalized = normalizeStructuredOutput(result.content, "proposal")
    const output = validateGeneratedContent(normalized.content, "proposal")
    if (!result.success || !output.valid) {
      throw new Error(result.error || "Failed to generate proposal")
    }

    const promptVersion = normalized.format === "structured-json"
      ? "proposal-v3-structured-json"
      : "proposal-v1-legacy-fallback"
    const estimatedCost = estimateGenerationCost(result.model, result.tokensUsed)

    await emitGenerationStage("saving")
    const proposal = await prisma.$transaction(async (transaction) => {
      const document = await transaction.document.create({
        data: {
          userId: session.user.id,
          type: "proposal",
          clientName,
          clientCompany,
          projectTitle: projectTitle || "Custom Project",
          content: output.content,
          metadata: JSON.stringify({
            field,
            model: result.model,
            tokensUsed: result.tokensUsed,
            generationTime: result.generationTime,
            ...(estimatedCost !== undefined ? { estimatedCost } : {}),
            outputFormat: normalized.format,
            promptVersion,
            ...(result.repairAttempted ? { repairAttempted: true } : {}),
            fieldSpecificData
          })
        }
      })
      await transaction.documentVersion.create({
        data: {
          documentId: document.id,
          userId: session.user.id,
          version: 1,
          type: document.type,
          clientName: document.clientName,
          clientCompany: document.clientCompany,
          projectTitle: document.projectTitle,
          content: document.content,
          metadata: document.metadata,
        },
      })
      return document
    })
    if (useAtomicUsage) usageCommitted = true

    await recordGeneration({
      requestId,
      userId: session.user.id,
      generationType: "proposal",
      documentId: proposal.id,
      model: result.model,
      promptVersion,
      totalTokens: result.tokensUsed,
      durationMs: result.generationTime,
      estimatedCost,
      status: "completed",
      repairAttempted: result.repairAttempted,
    })
    generationTracked = true
    await recordProductEvent({
      name: "generation_completed",
      userId: session.user.id,
      documentId: proposal.id,
      requestId,
      metadata: { type: "proposal", field, format: normalized.format },
    })

    // Increment usage count
    if (!useAtomicUsage) await incrementUsage(session.user.id, "proposals")

    return json({
      id: proposal.id,
      status: "completed",
      message: "Proposal generated successfully",
      requestId,
      metadata: {
        field,
        model: result.model,
        tokensUsed: result.tokensUsed,
        generationTime: result.generationTime,
        ...(estimatedCost !== undefined ? { estimatedCost } : {}),
        outputFormat: normalized.format,
        promptVersion,
        ...(result.repairAttempted ? { repairAttempted: true } : {}),
      }
    })
  } catch (error) {
    if (generationStarted && !generationTracked) {
      if (userId) {
        await recordGeneration({
          requestId,
          userId,
          generationType: "proposal",
          model: generationResult?.model,
          totalTokens: generationResult?.tokensUsed,
          durationMs: generationResult?.generationTime,
          estimatedCost: estimateGenerationCost(generationResult?.model, generationResult?.tokensUsed),
          status: "failed",
          errorCode: classifyGenerationError(error),
          repairAttempted: generationResult?.repairAttempted,
        })
        await recordProductEvent({
          name: "generation_failed",
          userId,
          requestId,
          metadata: { type: "proposal" },
        })
      }
    }
    console.error("Error generating proposal", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "generation_failed",
      requestId,
      path: "/api/generate/proposal",
      method: "POST",
      category: "generation",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Failed to generate proposal", requestId }, { status: 500 })
  } finally {
    releaseGenerationSlot?.()
    if (useAtomicUsage && usageReservation && !usageCommitted && userId) {
      await releaseUsage(userId, "proposals", usageReservation.month).catch(() => undefined)
    }
  }
}
