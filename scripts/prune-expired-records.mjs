import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const applyChanges = process.env.PRUNE_EXPIRED_CONFIRM === "apply"
const OBSERVABILITY_RETENTION_DAYS = 180

function observabilityCutoff(now) {
  const cutoff = new Date(now)
  cutoff.setUTCDate(cutoff.getUTCDate() - OBSERVABILITY_RETENTION_DAYS)
  return cutoff
}

async function countExpired(now) {
  const observabilityCutoffDate = observabilityCutoff(now)
  const [sessions, verificationTokens, rateLimitBuckets, generations, productEvents] = await Promise.all([
    prisma.session.count({ where: { expires: { lte: now } } }),
    prisma.verificationToken.count({ where: { expires: { lte: now } } }),
    prisma.rateLimitBucket.count({ where: { resetAt: { lte: now } } }),
    prisma.generation.count({ where: { createdAt: { lte: observabilityCutoffDate } } }),
    prisma.productEvent.count({ where: { createdAt: { lte: observabilityCutoffDate } } }),
  ])

  return { sessions, verificationTokens, rateLimitBuckets, generations, productEvents }
}

async function pruneExpiredRecords(now) {
  const observabilityCutoffDate = observabilityCutoff(now)
  const result = await prisma.$transaction([
    prisma.session.deleteMany({ where: { expires: { lte: now } } }),
    prisma.verificationToken.deleteMany({ where: { expires: { lte: now } } }),
    prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lte: now } } }),
    prisma.generation.deleteMany({ where: { createdAt: { lte: observabilityCutoffDate } } }),
    prisma.productEvent.deleteMany({ where: { createdAt: { lte: observabilityCutoffDate } } }),
  ])

  return {
    sessions: result[0].count,
    verificationTokens: result[1].count,
    rateLimitBuckets: result[2].count,
    generations: result[3].count,
    productEvents: result[4].count,
  }
}

try {
  const now = new Date()
  const counts = await countExpired(now)

  if (!applyChanges) {
    console.log(`Dry run at ${now.toISOString()}: ${JSON.stringify({ ...counts, observabilityRetentionDays: OBSERVABILITY_RETENTION_DAYS })}`)
    console.log("Set PRUNE_EXPIRED_CONFIRM=apply to delete these expired records.")
  } else {
    const deleted = await pruneExpiredRecords(now)
    console.log(`Expired-record cleanup complete at ${now.toISOString()}: ${JSON.stringify({ ...deleted, observabilityRetentionDays: OBSERVABILITY_RETENTION_DAYS })}`)
  }
} finally {
  await prisma.$disconnect()
}
