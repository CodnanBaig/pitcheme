import fs from "node:fs"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import { getUserSubscription, incrementUsage } from "@/lib/subscription"

const mockSubscriptionFindUnique = prisma.userSubscription.findUnique as jest.MockedFunction<typeof prisma.userSubscription.findUnique>
const mockSubscriptionCreate = prisma.userSubscription.create as jest.MockedFunction<typeof prisma.userSubscription.create>
const mockUsageUpsert = prisma.usage.upsert as jest.MockedFunction<typeof prisma.usage.upsert>

describe("database persistence contracts", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("declares ownership relations and operational indexes in the Mongo schema", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8")

    expect(schema).toContain("userId        String   @db.ObjectId")
    expect(schema).toContain("@@unique([documentId, version])")
    expect(schema).toContain("@@index([userId, createdAt])")
    expect(schema).toContain("@@index([requestId, createdAt])")
  })

  it("creates a free subscription when a user has no subscription", async () => {
    mockSubscriptionFindUnique.mockResolvedValue(null)
    mockSubscriptionCreate.mockResolvedValue({
      userId: "user-1",
      plan: "FREE",
      status: "active",
      id: "subscription-1",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const subscription = await getUserSubscription("user-1")

    expect(subscription?.plan).toBe("FREE")
    expect(mockSubscriptionCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", plan: "FREE", status: "active" },
    })
  })

  it("increments only the selected monthly usage counter", async () => {
    mockUsageUpsert.mockResolvedValue({
      id: "usage-1",
      userId: "user-1",
      month: "2026-09",
      proposals: 1,
      pitchDecks: 0,
    })

    await incrementUsage("user-1", "proposals")

    expect(mockUsageUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_month: expect.objectContaining({ userId: "user-1" }) },
      update: { proposals: { increment: 1 } },
      create: expect.objectContaining({ userId: "user-1", proposals: 1, pitchDecks: 0 }),
    }))
  })
})
