import nextConfig from "@/next.config"
import { hashPassword, verifyPassword } from "@/lib/auth-utils"
import { validateGenerationBody } from "@/lib/generation-validation"
import { getRuntimeEnvironmentStatus } from "@/lib/env"
import { resetRateLimits, checkRateLimit } from "@/lib/rate-limit"
import { escapeHtml, sanitizeGeneratedHtml } from "@/lib/sanitize-html"
import { getRequestId } from "@/lib/request-id"
import { NextRequest } from "next/server"

describe("security controls", () => {
  afterEach(() => {
    resetRateLimits()
  })

  it("escapes text and discards executable generated markup", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;")

    const sanitized = sanitizeGeneratedHtml(`<div class="slide" onclick="alert(1)"><script>bad()</script><p>Safe</p></div>`)

    expect(sanitized).toContain('<div class="slide">')
    expect(sanitized).toContain("<p>Safe</p>")
    expect(sanitized).not.toContain("script")
    expect(sanitized).not.toContain("onclick")
  })

  it("hashes passwords and verifies only the matching secret", async () => {
    const hashed = await hashPassword("correct horse battery staple")

    await expect(verifyPassword("correct horse battery staple", hashed)).resolves.toBe(true)
    await expect(verifyPassword("wrong password", hashed)).resolves.toBe(false)
    expect(hashed).not.toContain("correct horse")
  })

  it("enforces bounded process-local request limits", () => {
    const options = { limit: 2, windowMs: 60_000 }

    expect(checkRateLimit("security-test", options).allowed).toBe(true)
    expect(checkRateLimit("security-test", options).allowed).toBe(true)
    expect(checkRateLimit("security-test", options).allowed).toBe(false)
    expect(checkRateLimit("other-key", options).allowed).toBe(true)
  })

  it("rejects oversized and malformed generation input before provider calls", () => {
    const result = validateGenerationBody({
      clientName: "Client",
      projectDescription: "x".repeat(10_001),
      goals: "Goal",
      fieldSpecificData: [],
    }, ["clientName", "projectDescription", "goals"])

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors).toEqual(expect.arrayContaining([
        "projectDescription must be 10000 characters or fewer",
        "fieldSpecificData must be an object",
      ]))
    }
  })

  it("requires production HTTPS, database, AI, and secret configuration", () => {
    const original = {
      nodeEnv: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      nextAuthSecret: process.env.NEXTAUTH_SECRET,
      openRouterKey: process.env.OPENROUTER_API_KEY,
    }

    try {
      process.env.NODE_ENV = "production"
      process.env.DATABASE_URL = "sqlite:./dev.db"
      process.env.NEXTAUTH_URL = "http://localhost:3000"
      process.env.NEXTAUTH_SECRET = "short"
      delete process.env.OPENROUTER_API_KEY

      const status = getRuntimeEnvironmentStatus()

      expect(status.ok).toBe(false)
      expect(status.errors).toEqual(expect.arrayContaining([
        "DATABASE_URL must use a MongoDB connection string",
        "OPENROUTER_API_KEY is required in production",
        "NEXTAUTH_URL must use https:// in production",
        "NEXTAUTH_SECRET must be at least 32 characters in production",
      ]))
    } finally {
      process.env.NODE_ENV = original.nodeEnv
      process.env.DATABASE_URL = original.databaseUrl
      process.env.NEXTAUTH_URL = original.nextAuthUrl
      process.env.NEXTAUTH_SECRET = original.nextAuthSecret
      process.env.OPENROUTER_API_KEY = original.openRouterKey
    }
  })

  it("returns only the intended security headers", async () => {
    const headerGroups = await nextConfig.headers?.()
    const headers = headerGroups?.[0]?.headers ?? []
    const values = Object.fromEntries(headers.map((header) => [header.key, header.value]))

    expect(values).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    })
    expect(values["Permissions-Policy"]).toContain("camera=()")
    expect(values["Content-Security-Policy"]).toContain("default-src 'self'")
    expect(values["Content-Security-Policy"]).toContain("frame-ancestors 'none'")
  })

  it("rejects unsafe caller request IDs and generates a bounded replacement", () => {
    const request = new NextRequest("http://localhost", {
      headers: { "x-request-id": "unsafe value with secrets" },
    })

    expect(getRequestId(request)).toMatch(/^[0-9a-f-]{36}$/)
  })
})
