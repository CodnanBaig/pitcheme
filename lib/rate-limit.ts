import { prisma } from "@/lib/prisma"

type RateLimitOptions = {
  limit: number
  windowMs: number
}

type Bucket = {
  count: number
  resetAt: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 10_000
const SHARED_BUCKET_CLEANUP_INTERVAL_MS = 60_000
let lastSharedBucketCleanupAt = 0

function pruneBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }

  if (buckets.size <= MAX_BUCKETS) return
  const oldest = [...buckets.entries()]
    .sort(([, left], [, right]) => left.resetAt - right.resetAt)
    .slice(0, buckets.size - MAX_BUCKETS)
  oldest.forEach(([key]) => buckets.delete(key))
}

/**
 * Process-local guard for expensive endpoints. A shared store (Redis or an
 * equivalent provider) is still required for a multi-instance deployment.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = { limit: 10, windowMs: 60_000 },
  now = Date.now(),
): RateLimitResult {
  pruneBuckets(now)
  const existing = buckets.get(key)
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + options.windowMs }
    : existing

  bucket.count += 1
  buckets.set(key, bucket)

  return {
    allowed: bucket.count <= options.limit,
    remaining: Math.max(options.limit - bucket.count, 0),
    resetAt: bucket.resetAt,
  }
}

export function resetRateLimits() {
  buckets.clear()
  lastSharedBucketCleanupAt = 0
}

type RateLimitStoreClient = {
  findUnique?: (args: { where: { key: string } }) => Promise<{ count: number; resetAt: Date } | null>
  create?: (args: { data: { key: string; count: number; resetAt: Date } }) => Promise<{ count: number; resetAt: Date }>
  deleteMany?: (args: { where: { resetAt: { lte: Date } } }) => Promise<{ count: number }>
  updateMany?: (args: {
    where: { key: string; resetAt?: { lte?: Date; gt?: Date }; count?: { lt: number } }
    data: { count: number | { increment: number }; resetAt?: Date }
  }) => Promise<{ count: number }>
}

function getRateLimitStore(): Required<RateLimitStoreClient> | null {
  const store = (prisma as unknown as { rateLimitBucket?: RateLimitStoreClient }).rateLimitBucket
  if (!store || typeof store.findUnique !== "function" || typeof store.create !== "function" || typeof store.updateMany !== "function") {
    return null
  }
  return store as Required<RateLimitStoreClient>
}

async function pruneExpiredSharedBuckets(
  store: RateLimitStoreClient,
  now: Date,
): Promise<void> {
  if (typeof store.deleteMany !== "function") return

  const nowMs = now.getTime()
  if (nowMs - lastSharedBucketCleanupAt < SHARED_BUCKET_CLEANUP_INTERVAL_MS) return
  lastSharedBucketCleanupAt = nowMs

  try {
    await store.deleteMany({ where: { resetAt: { lte: now } } })
  } catch {
    // Cleanup is maintenance only. The limiter below still fails closed if
    // its atomic operations cannot reach the shared store.
  }
}

function resultFromBucket(bucket: { count: number; resetAt: Date }, limit: number): RateLimitResult {
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(limit - bucket.count, 0),
    resetAt: bucket.resetAt.getTime(),
  }
}

function unavailableRateLimit(options: RateLimitOptions): RateLimitResult {
  return {
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + options.windowMs,
  }
}

/**
 * Uses the MongoDB-backed bucket when RATE_LIMIT_STORE=mongodb. If the shared
 * store is unavailable, fail closed so a multi-instance deployment cannot
 * silently fall back to independent process-local buckets.
 */
export async function enforceRateLimit(
  key: string,
  options: RateLimitOptions = { limit: 10, windowMs: 60_000 },
): Promise<RateLimitResult> {
  if (process.env.RATE_LIMIT_STORE !== "mongodb") return checkRateLimit(key, options)

  const store = getRateLimitStore()
  if (!store) return unavailableRateLimit(options)

  const normalizedKey = key.slice(0, 200)
  const now = new Date()
  const resetAt = new Date(now.getTime() + options.windowMs)

  try {
    await pruneExpiredSharedBuckets(store, now)
    const reset = await store.updateMany({
      where: { key: normalizedKey, resetAt: { lte: now } },
      data: { count: 1, resetAt },
    })
    if (reset.count > 0) return { allowed: true, remaining: Math.max(options.limit - 1, 0), resetAt: resetAt.getTime() }

    try {
      const created = await store.create({ data: { key: normalizedKey, count: 1, resetAt } })
      return resultFromBucket(created, options.limit)
    } catch {
      // Another instance may have created the unique bucket. Continue with the
      // atomic increment path rather than treating the request as a failure.
    }

    const incremented = await store.updateMany({
      where: { key: normalizedKey, resetAt: { gt: now }, count: { lt: options.limit } },
      data: { count: { increment: 1 } },
    })
    const current = await store.findUnique({ where: { key: normalizedKey } })
    if (!current) return unavailableRateLimit(options)
    if (incremented.count === 0) {
      return { allowed: false, remaining: 0, resetAt: current.resetAt.getTime() }
    }
    return resultFromBucket(current, options.limit)
  } catch {
    return unavailableRateLimit(options)
  }
}
