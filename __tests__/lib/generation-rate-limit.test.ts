jest.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: jest.fn(),
}))

import { enforceRateLimit } from "@/lib/rate-limit"
import { enforceGenerationRateLimit, generationRateLimitPolicy } from "@/lib/generation-rate-limit"

const mockEnforceRateLimit = enforceRateLimit as jest.MockedFunction<typeof enforceRateLimit>

describe("generation rate-limit policy", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("uses a route bucket followed by a shared account-wide hourly bucket", async () => {
    const perMinute = { allowed: true, remaining: 9, resetAt: Date.now() + 60_000 }
    const perHour = { allowed: true, remaining: 19, resetAt: Date.now() + 3_600_000 }
    mockEnforceRateLimit.mockResolvedValueOnce(perMinute).mockResolvedValueOnce(perHour)

    await expect(enforceGenerationRateLimit("proposal", "user-1")).resolves.toEqual(perHour)
    expect(mockEnforceRateLimit).toHaveBeenNthCalledWith(
      1,
      "proposal-generation:user-1",
      generationRateLimitPolicy.perMinute,
    )
    expect(mockEnforceRateLimit).toHaveBeenNthCalledWith(
      2,
      "generation-hourly:user-1",
      generationRateLimitPolicy.perHour,
    )
  })

  it("does not spend the hourly bucket after the route bucket denies", async () => {
    const denied = { allowed: false, remaining: 0, resetAt: Date.now() + 60_000 }
    mockEnforceRateLimit.mockResolvedValue(denied)

    await expect(enforceGenerationRateLimit("pitch-deck", "user-1")).resolves.toEqual(denied)
    expect(mockEnforceRateLimit).toHaveBeenCalledTimes(1)
  })

  it("keeps the shared policy bounded for a predictable retry window", () => {
    expect(generationRateLimitPolicy.perMinute).toEqual({ limit: 10, windowMs: 60_000 })
    expect(generationRateLimitPolicy.perHour).toEqual({ limit: 20, windowMs: 3_600_000 })
  })
})
