jest.mock("@/lib/prisma", () => ({
  prisma: {
    rateLimitBucket: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { enforceRateLimit } from "@/lib/rate-limit"

const store = prisma.rateLimitBucket as unknown as {
  findUnique: jest.Mock
  create: jest.Mock
  updateMany: jest.Mock
}

describe("shared rate limiting", () => {
  const originalStore = process.env.RATE_LIMIT_STORE

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.RATE_LIMIT_STORE = "mongodb"
  })

  afterEach(() => {
    if (originalStore === undefined) delete process.env.RATE_LIMIT_STORE
    else process.env.RATE_LIMIT_STORE = originalStore
  })

  it("creates a shared bucket for the first request", async () => {
    store.updateMany.mockResolvedValue({ count: 0 })
    store.create.mockResolvedValue({ count: 1, resetAt: new Date(Date.now() + 60_000) })

    const result = await enforceRateLimit("user-1", { limit: 2, windowMs: 60_000 })

    expect(result.allowed).toBe(true)
    expect(store.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ key: "user-1", count: 1 }),
    })
  })

  it("atomically denies requests after the shared limit", async () => {
    store.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
    store.create.mockRejectedValue(new Error("duplicate key"))
    store.findUnique.mockResolvedValue({ count: 2, resetAt: new Date(Date.now() + 60_000) })

    const result = await enforceRateLimit("user-1", { limit: 2, windowMs: 60_000 })

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })
})
