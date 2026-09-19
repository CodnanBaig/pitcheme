jest.mock("@/lib/prisma", () => ({
  prisma: {
    $runCommandRaw: jest.fn(),
  },
}))

import { NextRequest } from "next/server"
import { GET } from "@/app/api/health/route"
import { prisma } from "@/lib/prisma"

const mockPing = prisma.$runCommandRaw as jest.MockedFunction<typeof prisma.$runCommandRaw>

describe("GET /api/health", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENROUTER_API_KEY = "test-openrouter-key"
    process.env.STRIPE_BILLING_ENABLED = "true"
    process.env.STRIPE_SECRET_KEY = "sk_test_123456789"
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123"
    delete process.env.HEALTHCHECK_EXTERNAL_SERVICES
    delete process.env.HEALTHCHECK_EXPORT_RUNTIME
  })

  afterEach(() => {
    delete process.env.HEALTHCHECK_EXTERNAL_SERVICES
    delete process.env.HEALTHCHECK_EXPORT_RUNTIME
    delete process.env.STRIPE_BILLING_ENABLED
  })

  it("reports healthy when the database and required providers are configured", async () => {
    mockPing.mockResolvedValue({ ok: 1 })

    const response = await GET(new NextRequest("http://localhost:3000/api/health"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe("healthy")
    expect(body.requestId).toEqual(expect.any(String))
    expect(body.checks.database.status).toBe("healthy")
    expect(body.checks.ai_service.status).toBe("healthy")
    expect(body.checks.stripe.status).toBe("healthy")
    expect(body.build).toEqual({ version: expect.any(String), commit: expect.any(String) })
    expect(body.environment.missing).toEqual([])
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(mockPing).toHaveBeenCalledWith({ ping: 1 })
  })

  it("fails production readiness when release provenance is missing", async () => {
    const names = [
      "NODE_ENV",
      "APP_VERSION",
      "BUILD_SHA",
      "GIT_COMMIT_SHA",
      "VERCEL_GIT_COMMIT_SHA",
      "NEXTAUTH_URL",
      "NEXTAUTH_SECRET",
      "RATE_LIMIT_STORE",
      "HEALTHCHECK_EXPORT_RUNTIME",
      "HEALTHCHECK_DATABASE_INDEXES",
      "CHROMIUM_EXECUTABLE_PATH",
    ] as const
    const original = Object.fromEntries(names.map((name) => [name, process.env[name]]))

    try {
      process.env.NODE_ENV = "production"
      process.env.NEXTAUTH_URL = "https://pitchgenie.example.com"
      process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
      process.env.RATE_LIMIT_STORE = "mongodb"
      process.env.HEALTHCHECK_EXPORT_RUNTIME = "false"
      process.env.HEALTHCHECK_DATABASE_INDEXES = "false"
      process.env.CHROMIUM_EXECUTABLE_PATH = ""
      delete process.env.APP_VERSION
      delete process.env.BUILD_SHA
      delete process.env.GIT_COMMIT_SHA
      delete process.env.VERCEL_GIT_COMMIT_SHA
      mockPing.mockResolvedValue({ ok: 1 })

      const response = await GET(new NextRequest("http://localhost:3000/api/health"))
      const body = await response.json()

      expect(response.status).toBe(503)
      expect(body.status).toBe("unhealthy")
      expect(body.build).toEqual({ version: "unknown", commit: "unknown" })
      expect(body.environment).toMatchObject({
        status: "invalid",
        errors: expect.arrayContaining(["APP_VERSION and a build commit are required in production"]),
      })
    } finally {
      for (const name of names) {
        const value = original[name]
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
      }
    }
  })

  it("fails production readiness when release provenance is malformed", async () => {
    const names = [
      "NODE_ENV",
      "APP_VERSION",
      "BUILD_SHA",
      "GIT_COMMIT_SHA",
      "VERCEL_GIT_COMMIT_SHA",
      "NEXTAUTH_URL",
      "NEXTAUTH_SECRET",
      "RATE_LIMIT_STORE",
      "HEALTHCHECK_EXPORT_RUNTIME",
      "HEALTHCHECK_DATABASE_INDEXES",
      "CHROMIUM_EXECUTABLE_PATH",
    ] as const
    const original = Object.fromEntries(names.map((name) => [name, process.env[name]]))

    try {
      process.env.NODE_ENV = "production"
      process.env.NEXTAUTH_URL = "https://pitchgenie.example.com"
      process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
      process.env.RATE_LIMIT_STORE = "mongodb"
      process.env.HEALTHCHECK_EXPORT_RUNTIME = "false"
      process.env.HEALTHCHECK_DATABASE_INDEXES = "false"
      process.env.APP_VERSION = "release/2026 09 19"
      process.env.BUILD_SHA = "sha with whitespace"
      delete process.env.GIT_COMMIT_SHA
      delete process.env.VERCEL_GIT_COMMIT_SHA
      process.env.CHROMIUM_EXECUTABLE_PATH = ""
      mockPing.mockResolvedValue({ ok: 1 })

      const response = await GET(new NextRequest("http://localhost:3000/api/health"))
      const body = await response.json()

      expect(response.status).toBe(503)
      expect(body.status).toBe("unhealthy")
      expect(body.build).toEqual({ version: "unknown", commit: "unknown" })
      expect(body.environment).toMatchObject({
        status: "invalid",
        errors: expect.arrayContaining(["APP_VERSION and a build commit are required in production"]),
      })
    } finally {
      for (const name of names) {
        const value = original[name]
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
      }
    }
  })

  it("reports unavailable when the database probe fails", async () => {
    mockPing.mockRejectedValue(new Error("database unavailable"))

    const response = await GET(new NextRequest("http://localhost:3000/api/health"))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe("unhealthy")
    expect(body.checks.database.status).toBe("unhealthy")
  })

  it("fails readiness promptly when the database probe hangs", async () => {
    jest.useFakeTimers()
    let resolvePing: ((value: unknown) => void) | undefined
    const pendingPing = new Promise((resolve) => {
      resolvePing = resolve
    })
    mockPing.mockReturnValue(pendingPing as never)

    try {
      const responsePromise = GET(new NextRequest("http://localhost:3000/api/health"))
      await jest.advanceTimersByTimeAsync(3_000)
      const response = await responsePromise
      const body = await response.json()

      expect(response.status).toBe(503)
      expect(body.checks.database).toMatchObject({
        status: "unhealthy",
        message: "Database probe timed out",
      })
    } finally {
      resolvePing?.({ ok: 1 })
      await Promise.resolve()
      jest.useRealTimers()
    }
  })

  it("runs cached external provider probes when explicitly enabled", async () => {
    process.env.HEALTHCHECK_EXTERNAL_SERVICES = "true"
    mockPing.mockResolvedValue({ ok: 1 })
    const originalFetch = global.fetch
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as typeof fetch

    try {
      const response = await GET(new NextRequest("http://localhost:3000/api/health"))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.checks.ai_service.message).toContain("external probe successful")
      expect(body.checks.stripe.message).toContain("external probe successful")
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenCalledWith(
        "https://openrouter.ai/api/v1/models",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.stripe.com/v1/balance",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    } finally {
      global.fetch = originalFetch
    }
  })

  it("fails readiness when the configured model catalog is missing a role", async () => {
    process.env.HEALTHCHECK_EXTERNAL_SERVICES = "true"
    process.env.HEALTHCHECK_MODEL_CATALOG = "true"
    mockPing.mockResolvedValue({ ok: 1 })
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "qwen/qwen3.8-27b:free" }] }),
    }) as typeof fetch

    try {
      const response = await GET(new NextRequest("http://localhost:3000/api/health"))
      const body = await response.json()

      expect(response.status).toBe(503)
      expect(body.checks.ai_service).toMatchObject({
        status: "unhealthy",
        message: expect.stringContaining("missing configured roles"),
      })
    } finally {
      global.fetch = originalFetch
      delete process.env.HEALTHCHECK_MODEL_CATALOG
    }
  })

  it("fails readiness when the opt-in export runtime probe cannot find Chromium", async () => {
    process.env.HEALTHCHECK_EXPORT_RUNTIME = "true"
    process.env.CHROMIUM_EXECUTABLE_PATH = "/missing/chromium"
    mockPing.mockResolvedValue({ ok: 1 })

    try {
      const response = await GET(new NextRequest("http://localhost:3000/api/health"))
      const body = await response.json()

      expect(response.status).toBe(503)
      expect(body.status).toBe("unhealthy")
      expect(body.checks.export_runtime).toMatchObject({
        status: "unhealthy",
        message: "Chromium executable is unavailable",
      })
    } finally {
      delete process.env.CHROMIUM_EXECUTABLE_PATH
    }
  })

  it("does not treat a directory as an available Chromium executable", async () => {
    process.env.HEALTHCHECK_EXPORT_RUNTIME = "true"
    process.env.CHROMIUM_EXECUTABLE_PATH = process.cwd()
    mockPing.mockResolvedValue({ ok: 1 })

    try {
      const response = await GET(new NextRequest("http://localhost:3000/api/health"))
      const body = await response.json()

      expect(response.status).toBe(503)
      expect(body.checks.export_runtime).toMatchObject({
        status: "unhealthy",
        message: "Chromium executable is unavailable",
      })
    } finally {
      delete process.env.CHROMIUM_EXECUTABLE_PATH
    }
  })
})
