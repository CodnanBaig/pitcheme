import { prisma } from "@/lib/prisma"

export type StripeWebhookClaim =
  | { state: "claimed" }
  | { state: "duplicate" }
  | { state: "in-progress" }

const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000

export async function claimStripeWebhookEvent(event: { id: string; type: string }): Promise<StripeWebhookClaim> {
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { eventId: event.id },
    select: { status: true, receivedAt: true },
  })

  if (!existing) {
    try {
      await prisma.stripeWebhookEvent.create({
        data: {
          eventId: event.id,
          eventType: event.type,
          status: "processing",
        },
      })
      return { state: "claimed" }
    } catch {
      const concurrent = await prisma.stripeWebhookEvent.findUnique({
        where: { eventId: event.id },
        select: { status: true, receivedAt: true },
      })
      if (concurrent?.status === "processing") {
        const staleBefore = new Date(Date.now() - PROCESSING_TIMEOUT_MS)
        const reclaimed = await prisma.stripeWebhookEvent.updateMany({
          where: { eventId: event.id, status: "processing", receivedAt: { lt: staleBefore } },
          data: { receivedAt: new Date() },
        })
        return reclaimed.count === 1 ? { state: "claimed" } : { state: "in-progress" }
      }
      if (concurrent) return { state: "duplicate" }
      throw new Error("Unable to claim Stripe webhook event")
    }
  }

  if (existing.status === "processing") {
    const staleBefore = new Date(Date.now() - PROCESSING_TIMEOUT_MS)
    const reclaimed = await prisma.stripeWebhookEvent.updateMany({
      where: { eventId: event.id, status: "processing", receivedAt: { lt: staleBefore } },
      data: { receivedAt: new Date() },
    })
    return reclaimed.count === 1 ? { state: "claimed" } : { state: "in-progress" }
  }

  if (existing.status !== "failed") return { state: "duplicate" }

  const retry = await prisma.stripeWebhookEvent.updateMany({
    where: { eventId: event.id, status: "failed" },
    data: {
      eventType: event.type,
      status: "processing",
      receivedAt: new Date(),
      processedAt: null,
      failureCode: null,
    },
  })

  return retry.count === 1 ? { state: "claimed" } : { state: "duplicate" }
}

export async function markStripeWebhookProcessed(eventId: string): Promise<void> {
  await prisma.stripeWebhookEvent.updateMany({
    where: { eventId, status: "processing" },
    data: {
      status: "processed",
      processedAt: new Date(),
      failureCode: null,
    },
  })
}

export async function markStripeWebhookFailed(eventId: string, failureCode: string): Promise<void> {
  await prisma.stripeWebhookEvent.updateMany({
    where: { eventId, status: "processing" },
    data: {
      status: "failed",
      failureCode: failureCode.slice(0, 120),
    },
  })
}
