import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { canUserGenerate, incrementUsage, releaseUsage, reserveUsage } from "@/lib/subscription"
import { prisma } from "@/lib/prisma"
import { aiService } from "@/lib/ai-service"
import { normalizeGenerationBody, validateGenerationBody, validateGenerationBrief, validateGenerationOptions } from "@/lib/generation-validation"
import { getFieldConfiguration } from "@/lib/field-config"
import { enforceRateLimit } from "@/lib/rate-limit"
import { validateGeneratedContent } from "@/lib/generation-output"
import { normalizeStructuredOutput } from "@/lib/structured-output"
import { classifyGenerationError, recordGeneration } from "@/lib/generation-tracking"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"
import { estimateGenerationCost } from "@/lib/model-cost"
import { acquireConcurrencySlot } from "@/lib/concurrency-limit"

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
  let usageReserved = false
  let usageCommitted = false
  const useAtomicUsage = process.env.NODE_ENV !== "test" && process.env.RATE_LIMIT_STORE === "mongodb"

  try {
    const session = await auth()

    if (!session?.user?.id) {
      return json({ error: "Unauthorized", requestId }, { status: 401 })
    }
    userId = session.user.id

    if (process.env.NODE_ENV !== "test") {
      const rateLimit = await enforceRateLimit(`proposal-generation:${session.user.id}`)
      if (!rateLimit.allowed) {
        return json(
          { error: "Too many generation requests. Please try again shortly." },
          { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
        )
      }
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return json({ error: "Invalid JSON request body", requestId }, { status: 400 })
    }

    const validation = validateGenerationBody(rawBody, ["clientName", "projectDescription", "goals"])
    if (!validation.valid) {
      return json({ error: "Invalid request", fields: validation.errors, requestId }, { status: 400 })
    }

    const normalizedBody = normalizeGenerationBody(validation.data)
    const briefErrors = validateGenerationBrief(normalizedBody, "proposal")
    if (briefErrors.length > 0) {
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
      usageReserved = await reserveUsage(session.user.id, "proposals")
      if (!usageReserved) {
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
      modelPreference
    }

    generationStarted = true
    const result = await aiService.generateProposal(generationRequest)
    generationResult = result
    
    const normalized = normalizeStructuredOutput(result.content, "proposal")
    const output = validateGeneratedContent(normalized.content, "proposal")
    if (!result.success || !output.valid) {
      throw new Error(result.error || "Failed to generate proposal")
    }

    const promptVersion = normalized.format === "structured-json"
      ? "proposal-v2-structured-json"
      : "proposal-v1-legacy-fallback"
    const estimatedCost = estimateGenerationCost(result.model, result.tokensUsed)

    const proposal = await prisma.document.create({
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
      }
    }
    console.error("Error generating proposal", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Failed to generate proposal", requestId }, { status: 500 })
  } finally {
    releaseGenerationSlot?.()
    if (useAtomicUsage && usageReserved && !usageCommitted && userId) {
      await releaseUsage(userId, "proposals").catch(() => undefined)
    }
  }
}
