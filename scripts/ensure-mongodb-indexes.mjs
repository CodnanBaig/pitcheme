import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const indexDefinitions = {
  Account: [
    { name: "Account_provider_providerAccountId_key", key: { provider: 1, providerAccountId: 1 }, unique: true },
  ],
  Session: [
    { name: "Session_sessionToken_key", key: { sessionToken: 1 }, unique: true },
  ],
  User: [
    { name: "User_email_key", key: { email: 1 }, unique: true },
  ],
  VerificationToken: [
    { name: "VerificationToken_identifier_token_key", key: { identifier: 1, token: 1 }, unique: true },
    { name: "VerificationToken_token_key", key: { token: 1 }, unique: true },
  ],
  UserSubscription: [
    { name: "UserSubscription_userId_key", key: { userId: 1 }, unique: true },
    { name: "UserSubscription_stripeCustomerId_idx", key: { stripeCustomerId: 1 } },
    { name: "UserSubscription_stripeSubscriptionId_idx", key: { stripeSubscriptionId: 1 } },
  ],
  StripeWebhookEvent: [
    { name: "StripeWebhookEvent_eventId_key", key: { eventId: 1 }, unique: true },
    { name: "StripeWebhookEvent_status_receivedAt_idx", key: { status: 1, receivedAt: 1 } },
  ],
  Document: [
    { name: "Document_userId_createdAt_idx", key: { userId: 1, createdAt: 1 } },
    { name: "Document_userId_type_createdAt_idx", key: { userId: 1, type: 1, createdAt: 1 } },
  ],
  Usage: [
    { name: "Usage_userId_month_key", key: { userId: 1, month: 1 }, unique: true },
  ],
  DocumentVersion: [
    { name: "DocumentVersion_documentId_version_key", key: { documentId: 1, version: 1 }, unique: true },
    { name: "DocumentVersion_userId_createdAt_idx", key: { userId: 1, createdAt: 1 } },
  ],
  DocumentShare: [
    { name: "DocumentShare_tokenHash_key", key: { tokenHash: 1 }, unique: true },
    { name: "DocumentShare_documentId_createdAt_idx", key: { documentId: 1, createdAt: 1 } },
    { name: "DocumentShare_userId_createdAt_idx", key: { userId: 1, createdAt: 1 } },
    { name: "DocumentShare_expiresAt_idx", key: { expiresAt: 1 } },
  ],
  ProductEvent: [
    { name: "ProductEvent_name_createdAt_idx", key: { name: 1, createdAt: 1 } },
    { name: "ProductEvent_userId_createdAt_idx", key: { userId: 1, createdAt: 1 } },
    { name: "ProductEvent_documentId_createdAt_idx", key: { documentId: 1, createdAt: 1 } },
  ],
  Generation: [
    { name: "Generation_userId_createdAt_idx", key: { userId: 1, createdAt: 1 } },
    { name: "Generation_requestId_createdAt_idx", key: { requestId: 1, createdAt: 1 } },
    { name: "Generation_documentId_createdAt_idx", key: { documentId: 1, createdAt: 1 } },
  ],
  RateLimitBucket: [
    { name: "RateLimitBucket_key_key", key: { key: 1 }, unique: true },
    { name: "RateLimitBucket_resetAt_idx", key: { resetAt: 1 } },
  ],
}

async function ensureIndexes() {
  let ensured = 0
  for (const [collection, definitions] of Object.entries(indexDefinitions)) {
    // MongoDB's createIndexes is idempotent when the named index already has
    // the same key/options. It also materializes a collection on a fresh DB.
    await prisma.$runCommandRaw({
      createIndexes: collection,
      indexes: definitions,
    })
    ensured += definitions.length
  }

  console.log(`MongoDB index bootstrap complete: ${ensured} index definition(s) verified.`)
}

try {
  await ensureIndexes()
} finally {
  await prisma.$disconnect()
}
