jest.mock("next-auth/react", () => ({
  getSession: jest.fn(),
}))

import { getSession } from "next-auth/react"
import { authenticatedJsonFetch, AuthApiError } from "@/lib/auth-api"

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe("authenticatedJsonFetch", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSession.mockResolvedValue({ user: { id: "user-123" } } as never)
  })

  it("surfaces structured field validation errors from protected APIs", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      error: "Invalid request",
      fields: ["problem must contain meaningful information"],
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }))

    await expect(authenticatedJsonFetch("/api/generate/pitch-deck", { method: "POST" }))
      .rejects.toEqual(expect.objectContaining<AuthApiError>({
        message: "problem must contain meaningful information",
        status: 400,
      }))
  })

  it("falls back to the status message for oversized error responses", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ error: "x".repeat(65 * 1024) }), {
      status: 502,
      statusText: "Bad Gateway",
      headers: { "Content-Type": "application/json" },
    }))

    await expect(authenticatedJsonFetch("/api/generate/pitch-deck", { method: "POST" }))
      .rejects.toEqual(expect.objectContaining<AuthApiError>({
        message: "Request failed: Bad Gateway",
        status: 502,
      }))
  })
})
