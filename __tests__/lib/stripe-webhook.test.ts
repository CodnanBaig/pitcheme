jest.mock("@/lib/prisma", () => ({
  prisma: {
    stripeWebhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import {
  claimStripeWebhookEvent,
  markStripeWebhookFailed,
  markStripeWebhookProcessed,
} from "@/lib/stripe-webhook"

const mockEvents = prisma.stripeWebhookEvent as unknown as {
  findUnique: jest.Mock
  create: jest.Mock
  updateMany: jest.Mock
}

describe("Stripe webhook event ledger", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEvents.updateMany.mockResolvedValue({ count: 0 })
  })

  it("claims a new event", async () => {
    mockEvents.findUnique.mockResolvedValue(null)
    mockEvents.create.mockResolvedValue({ eventId: "evt_1" })

    await expect(claimStripeWebhookEvent({ id: "evt_1", type: "invoice.payment_failed" }))
      .resolves.toEqual({ state: "claimed" })
    expect(mockEvents.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { eventId: "evt_1", eventType: "invoice.payment_failed", status: "processing" },
    }))
  })

  it("deduplicates processed and in-progress events", async () => {
    mockEvents.findUnique.mockResolvedValue({ status: "processed", receivedAt: new Date() })
    await expect(claimStripeWebhookEvent({ id: "evt_1", type: "test" })).resolves.toEqual({ state: "duplicate" })

    mockEvents.findUnique.mockResolvedValue({ status: "processing", receivedAt: new Date() })
    await expect(claimStripeWebhookEvent({ id: "evt_1", type: "test" })).resolves.toEqual({ state: "in-progress" })
  })

  it("reclaims stale in-progress events", async () => {
    mockEvents.findUnique.mockResolvedValue({
      status: "processing",
      receivedAt: new Date(Date.now() - 10 * 60 * 1000),
    })
    mockEvents.updateMany.mockResolvedValue({ count: 1 })

    await expect(claimStripeWebhookEvent({ id: "evt_1", type: "test" })).resolves.toEqual({ state: "claimed" })
    expect(mockEvents.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ eventId: "evt_1", status: "processing", receivedAt: expect.any(Object) }),
      data: { receivedAt: expect.any(Date) },
    }))
  })

  it("reclaims failed events atomically", async () => {
    mockEvents.findUnique.mockResolvedValue({ status: "failed" })
    mockEvents.updateMany.mockResolvedValue({ count: 1 })

    await expect(claimStripeWebhookEvent({ id: "evt_1", type: "test" })).resolves.toEqual({ state: "claimed" })
    expect(mockEvents.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId: "evt_1", status: "failed" },
      data: expect.objectContaining({ status: "processing", processedAt: null, failureCode: null }),
    }))
  })

  it("records processed and retryable failure states", async () => {
    mockEvents.updateMany.mockResolvedValue({ count: 1 })

    await markStripeWebhookProcessed("evt_1")
    await markStripeWebhookFailed("evt_1", "ErrorName")

    expect(mockEvents.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { eventId: "evt_1", status: "processing" },
      data: expect.objectContaining({ status: "processed" }),
    }))
    expect(mockEvents.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { eventId: "evt_1", status: "processing" },
      data: { status: "failed", failureCode: "ErrorName" },
    }))
  })
})
