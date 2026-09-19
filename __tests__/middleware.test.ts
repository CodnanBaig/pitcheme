import { NextRequest } from "next/server"
import { config, middleware } from "@/middleware"

describe("API request correlation middleware", () => {
  it("matches application routes while excluding framework assets", () => {
    expect(config.matcher).toEqual(["/((?!_next/|favicon.ico).*)"])
  })

  it("preserves a valid incoming request ID", () => {
    const response = middleware(new NextRequest("http://localhost:3000/api/documents", {
      headers: { "x-request-id": "trace-123" },
    }))

    expect(response.headers.get("X-Request-ID")).toBe("trace-123")
  })

  it("replaces invalid IDs with a bounded UUID", () => {
    const response = middleware(new NextRequest("http://localhost:3000/api/documents", {
      headers: { "x-request-id": "not valid for logs" },
    }))
    const requestId = response.headers.get("X-Request-ID")

    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("allows same-origin state-changing API requests", () => {
    const response = middleware(new NextRequest("http://localhost:3000/api/documents", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    }))

    expect(response.status).toBe(200)
  })

  it("accepts the configured public origin behind a reverse proxy", () => {
    const originalNextAuthUrl = process.env.NEXTAUTH_URL
    process.env.NEXTAUTH_URL = "https://app.example.com"

    try {
      const response = middleware(new NextRequest("http://internal-app:3000/api/documents", {
        method: "POST",
        headers: { origin: "https://app.example.com" },
      }))

      expect(response.status).toBe(200)
    } finally {
      if (originalNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL
      else process.env.NEXTAUTH_URL = originalNextAuthUrl
    }
  })

  it("rejects cross-origin state-changing API requests with a correlation ID", async () => {
    const response = middleware(new NextRequest("http://localhost:3000/api/documents", {
      method: "PATCH",
      headers: { origin: "https://attacker.example" },
    }))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ error: "Cross-origin request rejected", requestId: expect.any(String) })
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(response.headers.get("X-Request-ID")).toBe(body.requestId)
  })

  it("keeps provider callbacks and NextAuth callbacks available without browser origins", () => {
    const stripeResponse = middleware(new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: { origin: "https://stripe.example" },
    }))
    const nextAuthResponse = middleware(new NextRequest("http://localhost:3000/api/auth/callback/credentials", {
      method: "POST",
      headers: { origin: "https://accounts.example" },
    }))

    expect(stripeResponse.status).toBe(200)
    expect(nextAuthResponse.status).toBe(200)
  })

  it("protects custom registration while leaving read requests unaffected", () => {
    const registrationResponse = middleware(new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    }))
    const readResponse = middleware(new NextRequest("http://localhost:3000/api/documents", {
      method: "GET",
      headers: { origin: "https://attacker.example" },
    }))

    expect(registrationResponse.status).toBe(403)
    expect(readResponse.status).toBe(200)
  })

  it("protects client error telemetry from cross-origin browser posts", () => {
    const response = middleware(new NextRequest("http://localhost:3000/api/telemetry/client-error", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    }))

    expect(response.status).toBe(403)
  })
})
