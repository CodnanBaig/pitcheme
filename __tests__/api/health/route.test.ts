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

  it("reports unavailable when the database probe fails", async () => {
    mockPing.mockRejectedValue(new Error("database unavailable"))

    const response = await GET(new NextRequest("http://localhost:3000/api/health"))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe("unhealthy")
    expect(body.checks.database.status).toBe("unhealthy")
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
})
