type InFlightBucket = {
  active: number
  touchedAt: number
}

const buckets = new Map<string, InFlightBucket>()
const MAX_BUCKETS = 10_000

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.active === 0 && now - bucket.touchedAt > 5 * 60_000) buckets.delete(key)
  }

  if (buckets.size <= MAX_BUCKETS) return
  for (const [key] of buckets) {
    if (buckets.size <= MAX_BUCKETS) break
    buckets.delete(key)
  }
}

/** Process-local in-flight guard; combine with the shared request limiter. */
export function acquireConcurrencySlot(key: string, limit = 1): (() => void) | null {
  const now = Date.now()
  prune(now)
  const bucket = buckets.get(key) || { active: 0, touchedAt: now }
  if (bucket.active >= limit) return null

  bucket.active += 1
  bucket.touchedAt = now
  buckets.set(key, bucket)
  let released = false
  return () => {
    if (released) return
    released = true
    const current = buckets.get(key)
    if (!current) return
    current.active = Math.max(current.active - 1, 0)
    current.touchedAt = Date.now()
    buckets.set(key, current)
  }
}

export function resetConcurrencySlots() {
  buckets.clear()
}
