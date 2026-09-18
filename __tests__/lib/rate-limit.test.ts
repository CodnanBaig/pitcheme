import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit"

describe("rate limiting", () => {
  beforeEach(() => resetRateLimits())

  it("allows requests up to the configured limit and returns a reset window", () => {
    expect(checkRateLimit("user-1", { limit: 2, windowMs: 1000 }, 100)).toMatchObject({ allowed: true, remaining: 1, resetAt: 1100 })
    expect(checkRateLimit("user-1", { limit: 2, windowMs: 1000 }, 200)).toMatchObject({ allowed: true, remaining: 0, resetAt: 1100 })
    expect(checkRateLimit("user-1", { limit: 2, windowMs: 1000 }, 300)).toMatchObject({ allowed: false, remaining: 0, resetAt: 1100 })
  })

  it("starts a new window after the previous one expires", () => {
    expect(checkRateLimit("user-1", { limit: 1, windowMs: 1000 }, 100).allowed).toBe(true)
    expect(checkRateLimit("user-1", { limit: 1, windowMs: 1000 }, 1100).allowed).toBe(true)
  })

  it("prunes expired buckets before accepting new keys", () => {
    expect(checkRateLimit("expired", { limit: 1, windowMs: 10 }, 0).allowed).toBe(true)
    expect(checkRateLimit("fresh", { limit: 1, windowMs: 10 }, 11).allowed).toBe(true)
    expect(checkRateLimit("expired", { limit: 1, windowMs: 10 }, 11).allowed).toBe(true)
  })
})
