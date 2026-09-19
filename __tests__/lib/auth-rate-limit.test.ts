import { enforceCredentialsLoginRateLimit, getLoginClientAddress, hashRateLimitKeyPart } from "@/lib/auth-rate-limit"
import { enforceRateLimit } from "@/lib/rate-limit"

jest.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: jest.fn(),
}))

const mockEnforceRateLimit = enforceRateLimit as jest.MockedFunction<typeof enforceRateLimit>

function requestWithHeaders(headers: Record<string, string>) {
  return { headers: new Headers(headers) }
}

describe("credentials login rate limiting", () => {
  beforeEach(() => jest.clearAllMocks())

  it("prefers the first trusted forwarded address and bounds the key", () => {
    const address = getLoginClientAddress(requestWithHeaders({
      "x-forwarded-for": "203.0.113.18, 10.0.0.2",
    }))
    expect(address).toBe("203.0.113.18")

    const longAddress = getLoginClientAddress(requestWithHeaders({
      "x-real-ip": `${"a".repeat(140)}!`,
    }))
    expect(longAddress).toHaveLength(96)
  })

  it("always guards the email and adds a client bucket when an address exists", async () => {
    mockEnforceRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 9, resetAt: 1000 })
      .mockResolvedValueOnce({ allowed: true, remaining: 29, resetAt: 1000 })

    const result = await enforceCredentialsLoginRateLimit(
      "person@example.com",
      requestWithHeaders({ "x-real-ip": "203.0.113.18" }),
    )

    expect(result.allowed).toBe(true)
    expect(mockEnforceRateLimit).toHaveBeenNthCalledWith(
      1,
      `credentials-login:email:${hashRateLimitKeyPart("person@example.com")}`,
      { limit: 10, windowMs: 60_000 },
    )
    expect(mockEnforceRateLimit).toHaveBeenNthCalledWith(
      2,
      `credentials-login:client:${hashRateLimitKeyPart("203.0.113.18")}`,
      { limit: 30, windowMs: 60_000 },
    )
  })

  it("does not expose raw identifiers in the shared key part", () => {
    const hashed = hashRateLimitKeyPart("person@example.com")

    expect(hashed).toMatch(/^[a-f0-9]{64}$/)
    expect(hashed).not.toContain("person@example.com")
  })

  it("does not create a shared unknown-client bucket", async () => {
    mockEnforceRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: 1000 })

    const result = await enforceCredentialsLoginRateLimit("person@example.com")

    expect(result.allowed).toBe(true)
    expect(mockEnforceRateLimit).toHaveBeenCalledTimes(1)
  })
})
