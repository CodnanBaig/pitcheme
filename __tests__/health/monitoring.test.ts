jest.mock("@/lib/prisma", () => ({
  prisma: {
    $runCommandRaw: jest.fn(),
  },
}))

import { NextRequest } from "next/server"
import { GET } from "@/app/api/health/route"
import { prisma } from "@/lib/prisma"

const mockPing = prisma.$runCommandRaw as jest.MockedFunction<typeof prisma.$runCommandRaw>

describe("health and monitoring contract", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    mockPing.mockResolvedValue({ ok: 1 })
    process.env.OPENROUTER_API_KEY = "monitoring-test-key"
    process.env.STRIPE_BILLING_ENABLED = "true"
    process.env.STRIPE_SECRET_KEY = "sk_test_monitoring"
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_monitoring"
    delete process.env.HEALTHCHECK_EXTERNAL_SERVICES
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.HEALTHCHECK_EXTERNAL_SERVICES
    delete process.env.HEALTHCHECK_DATABASE_INDEXES
    delete process.env.STRIPE_BILLING_ENABLED
  })

  it("reports database, provider, storage, build, and request status", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/api/health", {
      headers: { "x-request-id": "monitoring-healthy" },
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      status: "healthy",
      requestId: "monitoring-healthy",
      checks: {
        database: { status: "healthy" },
        ai_service: { status: "healthy" },
        stripe: { status: "healthy" },
        storage: { status: "healthy" },
      },
      build: { version: expect.any(String), commit: expect.any(String) },
    })
    expect(response.headers.get("X-Request-ID")).toBe("monitoring-healthy")
    expect(mockPing).toHaveBeenCalledWith({ ping: 1 })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("returns a failing readiness status when MongoDB is unavailable", async () => {
    mockPing.mockRejectedValue(new Error("database unavailable"))

    const response = await GET(new NextRequest("http://localhost:3000/api/health"))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe("unhealthy")
    expect(body.checks.database).toMatchObject({
      status: "unhealthy",
      message: "Database connection failed",
    })
  })

  it("reports healthy when the required MongoDB indexes are present", async () => {
    process.env.HEALTHCHECK_DATABASE_INDEXES = "true"
    const indexesByCollection: Record<string, string[]> = {
      Account: ["Account_provider_providerAccountId_key"],
      Session: ["Session_sessionToken_key"],
      User: ["User_email_key"],
      VerificationToken: ["VerificationToken_token_key", "VerificationToken_identifier_token_key"],
      UserSubscription: ["UserSubscription_userId_key"],
      Usage: ["Usage_userId_month_key"],
      DocumentVersion: ["DocumentVersion_userId_createdAt_idx", "DocumentVersion_documentId_version_key"],
      Generation: ["Generation_userId_createdAt_idx", "Generation_requestId_createdAt_idx", "Generation_documentId_createdAt_idx"],
      RateLimitBucket: ["RateLimitBucket_key_key", "RateLimitBucket_resetAt_idx"],
    }
    mockPing.mockImplementation(async (command) => {
      const listIndexes = (command as { listIndexes?: string }).listIndexes
      if (listIndexes) {
        return { cursor: { firstBatch: (indexesByCollection[listIndexes] || []).map((name) => ({ name })) } }
      }
      return { ok: 1 }
    })

    const response = await GET(new NextRequest("http://localhost:3000/api/health"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.checks.database).toMatchObject({
      status: "healthy",
      message: "Database connection and required indexes successful",
    })
  })

  it("fails readiness when a required MongoDB index is missing", async () => {
    process.env.HEALTHCHECK_DATABASE_INDEXES = "true"
    mockPing.mockImplementation(async (command) => {
      const listIndexes = (command as { listIndexes?: string }).listIndexes
      if (listIndexes) return { cursor: { firstBatch: [] } }
      return { ok: 1 }
    })

    const response = await GET(new NextRequest("http://localhost:3000/api/health"))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe("unhealthy")
    expect(body.checks.database).toMatchObject({
      status: "unhealthy",
      message: expect.stringContaining("Required MongoDB indexes are missing"),
    })
  })

  it("runs and caches explicit external probes without exposing response bodies", async () => {
    process.env.HEALTHCHECK_EXTERNAL_SERVICES = "true"
    global.fetch = jest.fn().mockResolvedValue({ ok: true })

    const first = await GET(new NextRequest("http://localhost:3000/api/health"))
    const second = await GET(new NextRequest("http://localhost:3000/api/health"))
    const firstBody = await first.json()
    const secondBody = await second.json()

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(firstBody.checks.ai_service.message).toContain("external probe successful")
    expect(secondBody.checks.stripe.message).toContain("external probe successful")
    expect(firstBody).not.toHaveProperty("body")
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
