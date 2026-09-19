import { enforceRateLimit, type RateLimitResult } from "@/lib/rate-limit"

const GENERATION_MINUTE_LIMIT = 10
const GENERATION_MINUTE_WINDOW_MS = 60_000
const GENERATION_HOURLY_LIMIT = 20
const GENERATION_HOURLY_WINDOW_MS = 60 * 60_000

export const generationRateLimitPolicy = {
  perMinute: {
    limit: GENERATION_MINUTE_LIMIT,
    windowMs: GENERATION_MINUTE_WINDOW_MS,
  },
  perHour: {
    limit: GENERATION_HOURLY_LIMIT,
    windowMs: GENERATION_HOURLY_WINDOW_MS,
  },
} as const

/**
 * Apply both the route bucket and the account-wide hourly bucket. The hourly
 * bucket is shared by proposals and pitch decks so switching routes cannot
 * bypass the expensive-generation guard.
 */
export async function enforceGenerationRateLimit(
  route: "proposal" | "pitch-deck",
  userId: string,
): Promise<RateLimitResult> {
  const perMinute = await enforceRateLimit(
    `${route}-generation:${userId}`,
    generationRateLimitPolicy.perMinute,
  )
  if (!perMinute.allowed) return perMinute

  return enforceRateLimit(
    `generation-hourly:${userId}`,
    generationRateLimitPolicy.perHour,
  )
}
