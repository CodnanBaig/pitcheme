import fs from "node:fs"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getRuntimeEnvironmentStatus } from "@/lib/env"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"

type ServiceStatus = "healthy" | "degraded" | "unhealthy" | "disabled"

interface HealthCheck {
  status: ServiceStatus
  responseTime: number
  message: string
}

const EXTERNAL_PROBE_TIMEOUT_MS = 3_000
const EXTERNAL_PROBE_CACHE_MS = 30_000
const externalProbeCache = new Map<string, { expiresAt: number; check: HealthCheck }>()

const requiredMongoIndexes = [
  ["Account", "Account_provider_providerAccountId_key"],
  ["Session", "Session_sessionToken_key"],
  ["User", "User_email_key"],
  ["VerificationToken", "VerificationToken_token_key"],
  ["VerificationToken", "VerificationToken_identifier_token_key"],
  ["UserSubscription", "UserSubscription_userId_key"],
  ["Usage", "Usage_userId_month_key"],
  ["DocumentVersion", "DocumentVersion_userId_createdAt_idx"],
  ["DocumentVersion", "DocumentVersion_documentId_version_key"],
  ["Generation", "Generation_userId_createdAt_idx"],
  ["Generation", "Generation_requestId_createdAt_idx"],
  ["Generation", "Generation_documentId_createdAt_idx"],
  ["RateLimitBucket", "RateLimitBucket_key_key"],
  ["RateLimitBucket", "RateLimitBucket_resetAt_idx"],
] as const

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  const [database, ai_service, stripe, export_runtime] = await Promise.all([
    checkDatabase(),
    checkAIService(),
    checkStripe(),
    checkExportRuntime(),
  ])
  const checks = { database, ai_service, stripe, export_runtime, storage: checkStorage() }

  const readinessChecks = [checks.database, checks.ai_service, checks.storage]
  if (checks.export_runtime.status !== "disabled") readinessChecks.push(checks.export_runtime)
  const ready = readinessChecks.every((check) => check.status === "healthy")
    && ["healthy", "disabled"].includes(checks.stripe.status)
  const environment = getRuntimeEnvironmentStatus()

  const init = jsonWithRequestId(requestId, { status: ready && environment.ok ? 200 : 503 })
  const headers = new Headers(init.headers)
  headers.set("Cache-Control", "no-store")

  return NextResponse.json(
    {
      status: ready && environment.ok ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      requestId,
      build: getBuildInfo(),
      checks,
      environment: {
        status: environment.ok ? "valid" : "invalid",
        missing: environment.missing,
        errors: environment.errors,
        warnings: environment.warnings,
      },
    },
    { ...init, headers },
  )
}

function getBuildInfo(): { version: string; commit: string } {
  const version = process.env.APP_VERSION || "0.1.0"
  const commit = process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.GIT_COMMIT_SHA
    || process.env.BUILD_SHA
    || "unknown"
  return {
    version: /^[A-Za-z0-9._-]{1,64}$/.test(version) ? version : "unknown",
    commit: /^[A-Za-z0-9._-]{1,128}$/.test(commit) ? commit : "unknown",
  }
}

async function checkDatabase(): Promise<HealthCheck> {
  const startedAt = Date.now()
  try {
    await prisma.$runCommandRaw({ ping: 1 })
  } catch {
    return {
      status: "unhealthy",
      responseTime: Date.now() - startedAt,
      message: "Database connection failed",
    }
  }

  if (process.env.HEALTHCHECK_DATABASE_INDEXES === "true") {
    try {
      const missingIndexes = await findMissingMongoIndexes()
      if (missingIndexes.length > 0) {
        return {
          status: "unhealthy",
          responseTime: Date.now() - startedAt,
          message: `Required MongoDB indexes are missing: ${missingIndexes.join(", ")}`,
        }
      }
    } catch {
      return {
        status: "unhealthy",
        responseTime: Date.now() - startedAt,
        message: "Database index check failed",
      }
    }
  }

  return {
    status: "healthy",
    responseTime: Date.now() - startedAt,
    message: process.env.HEALTHCHECK_DATABASE_INDEXES === "true"
      ? "Database connection and required indexes successful"
      : "Database connection successful",
  }
}

async function findMissingMongoIndexes(): Promise<string[]> {
  const collections = [...new Set(requiredMongoIndexes.map(([collection]) => collection))]
  const indexesByCollection = new Map<string, Set<string>>()

  await Promise.all(collections.map(async (collection) => {
    const result = await prisma.$runCommandRaw({ listIndexes: collection }) as unknown as {
      cursor?: { firstBatch?: Array<{ name?: unknown }> }
    }
    indexesByCollection.set(
      collection,
      new Set(
        (result.cursor?.firstBatch || [])
          .map((index) => typeof index.name === "string" ? index.name : null)
          .filter((name): name is string => Boolean(name)),
      ),
    )
  }))

  return requiredMongoIndexes
    .filter(([collection, index]) => !indexesByCollection.get(collection)?.has(index))
    .map(([collection, index]) => `${collection}.${index}`)
}

async function checkAIService(): Promise<HealthCheck> {
  const startedAt = Date.now()
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return {
      status: "unhealthy",
      responseTime: Date.now() - startedAt,
      message: "AI provider key is missing",
    }
  }

  if (process.env.HEALTHCHECK_EXTERNAL_SERVICES !== "true") {
    return {
      status: "healthy",
      responseTime: Date.now() - startedAt,
      message: "AI provider configured; external probe disabled",
    }
  }

  return probeExternalService(
    "openrouter",
    "https://openrouter.ai/api/v1/models",
    { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
  )
}

async function checkStripe(): Promise<HealthCheck> {
  const startedAt = Date.now()
  if (process.env.STRIPE_BILLING_ENABLED !== "true") {
    return {
      status: "disabled",
      responseTime: Date.now() - startedAt,
      message: "Stripe billing is disabled",
    }
  }

  const secretConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim())
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim())
  const plansConfigured = Boolean(
    process.env.STRIPE_PRO_PRICE_ID?.trim() && process.env.STRIPE_ENTERPRISE_PRICE_ID?.trim(),
  )

  if (!secretConfigured || !webhookConfigured || !plansConfigured) {
    return {
      status: "unhealthy",
      responseTime: Date.now() - startedAt,
      message: "Stripe billing configuration is incomplete",
    }
  }

  if (process.env.HEALTHCHECK_EXTERNAL_SERVICES !== "true") {
    return {
      status: "healthy",
      responseTime: Date.now() - startedAt,
      message: "Stripe configuration present; external probe disabled",
    }
  }

  return probeExternalService(
    "stripe",
    "https://api.stripe.com/v1/balance",
    { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  )
}

async function checkExportRuntime(): Promise<HealthCheck> {
  const startedAt = Date.now()
  if (process.env.HEALTHCHECK_EXPORT_RUNTIME !== "true") {
    return {
      status: "disabled",
      responseTime: Date.now() - startedAt,
      message: "Export runtime probe disabled",
    }
  }

  try {
    const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH?.trim() || process.env.PUPPETEER_EXECUTABLE_PATH?.trim()
    if (!executablePath || !fs.existsSync(executablePath)) {
      return {
        status: "unhealthy",
        responseTime: Date.now() - startedAt,
        message: "Chromium executable is unavailable",
      }
    }

    return {
      status: "healthy",
      responseTime: Date.now() - startedAt,
      message: "Chromium executable is available",
    }
  } catch {
    return {
      status: "unhealthy",
      responseTime: Date.now() - startedAt,
      message: "Chromium executable is unavailable",
    }
  }
}

async function probeExternalService(
  key: string,
  url: string,
  headers: Record<string, string>,
): Promise<HealthCheck> {
  const cached = externalProbeCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.check

  const startedAt = Date.now()
  let check: HealthCheck
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(EXTERNAL_PROBE_TIMEOUT_MS),
    })
    check = {
      status: response.ok ? "healthy" : "unhealthy",
      responseTime: Date.now() - startedAt,
      message: response.ok ? `${key} external probe successful` : `${key} external probe failed`,
    }
  } catch {
    check = {
      status: "unhealthy",
      responseTime: Date.now() - startedAt,
      message: `${key} external probe failed`,
    }
  }

  externalProbeCache.set(key, { expiresAt: Date.now() + EXTERNAL_PROBE_CACHE_MS, check })
  return check
}

function checkStorage(): HealthCheck {
  const startedAt = Date.now()
  // Generated files are streamed from memory; no local disk volume is required.
  return {
    status: "healthy",
    responseTime: Date.now() - startedAt,
    message: "Ephemeral storage mode",
  }
}
