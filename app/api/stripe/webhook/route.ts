import { type NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import {
  getStripeConfigurationError,
  normalizeStripeSubscriptionStatus,
  stripe,
} from "@/lib/stripe"
import { getUserSubscription, syncStripeSubscription, updateUserSubscription } from "@/lib/subscription"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"
import { readTextBody } from "@/lib/request-body"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"
import {
  claimStripeWebhookEvent,
  markStripeWebhookFailed,
  markStripeWebhookProcessed,
} from "@/lib/stripe-webhook"

const MAX_WEBHOOK_BYTES = 1024 * 1024

export const runtime = "nodejs"
export const maxDuration = 30

function json(requestId: string, body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { ...jsonWithRequestId(requestId, { status }) })
}

function stripeId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value?.id ?? null
}

async function findUserId(
  metadataUserId: unknown,
  customerId: string | null,
  subscriptionId: string | null,
): Promise<string | null> {
  const metadataId = typeof metadataUserId === "string" && metadataUserId.trim()
    ? metadataUserId.trim()
    : null

  const references = [
    customerId ? { stripeCustomerId: customerId } : null,
    subscriptionId ? { stripeSubscriptionId: subscriptionId } : null,
  ].filter((reference): reference is { stripeCustomerId: string } | { stripeSubscriptionId: string } => Boolean(reference))

  if (references.length === 0) return metadataId

  // Customer and subscription references are independently supplied by
  // Stripe. Never let an OR query pick an arbitrary owner when they disagree.
  const records = await prisma.userSubscription.findMany({
    where: { OR: references },
    select: { userId: true },
  })
  const referenceUserIds = [...new Set(records.map((record) => record.userId))]

  if (referenceUserIds.length > 1) return null
  const referenceUserId = referenceUserIds[0] ?? null
  if (metadataId && referenceUserId && metadataId !== referenceUserId) return null

  return metadataId ?? referenceUserId
}

async function syncSubscriptionForUser(
  userId: string | null,
  subscription: Stripe.Subscription,
  eventCreated?: number,
): Promise<boolean> {
  if (!userId) return false
  return Boolean(await syncStripeSubscription(userId, subscription, eventCreated))
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, eventCreated?: number): Promise<boolean> {
  const subscriptionId = stripeId(session.subscription)
  if (!subscriptionId || !stripe) return false

  const subscription = typeof session.subscription === "string"
    ? await stripe.subscriptions.retrieve(subscriptionId)
    : session.subscription
  if (!subscription) return false
  const userId = await findUserId(
    session.metadata?.userId || session.client_reference_id,
    stripeId(session.customer) || stripeId(subscription.customer),
    subscriptionId,
  )
  return syncSubscriptionForUser(userId, subscription, eventCreated)
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription, eventCreated?: number): Promise<boolean> {
  const userId = await findUserId(
    subscription.metadata?.userId,
    stripeId(subscription.customer),
    subscription.id,
  )
  return syncSubscriptionForUser(userId, subscription, eventCreated)
}

async function handleInvoicePaymentFailure(invoice: Stripe.Invoice, eventCreated?: number): Promise<boolean> {
  const subscriptionId = stripeId(invoice.subscription)
  const customerId = stripeId(invoice.customer)
  const userId = await findUserId(undefined, customerId, subscriptionId)
  if (!userId) return false

  const existing = await getUserSubscription(userId)
  await updateUserSubscription(userId, {
    stripeCustomerId: customerId || existing?.stripeCustomerId,
    stripeSubscriptionId: subscriptionId || existing?.stripeSubscriptionId,
    stripePriceId: existing?.stripePriceId,
    plan: existing?.plan || "FREE",
    status: normalizeStripeSubscriptionStatus("past_due"),
    currentPeriodStart: existing?.currentPeriodStart,
    currentPeriodEnd: existing?.currentPeriodEnd,
    cancelAtPeriodEnd: existing?.cancelAtPeriodEnd,
  }, eventCreated)
  return true
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  const configurationError = getStripeConfigurationError()
  if (configurationError) return json(requestId, { error: configurationError, requestId }, 503)
  if (!stripe) return json(requestId, { error: "Stripe is not configured", requestId }, 503)

  const signature = request.headers.get("stripe-signature")
  if (!signature) return json(requestId, { error: "Missing Stripe signature", requestId }, 400)

  let event: Stripe.Event
  try {
    const payload = await readTextBody(request, MAX_WEBHOOK_BYTES)
    if (!payload.ok) {
      return json(
        requestId,
        {
          error: payload.reason === "too-large" ? "Webhook payload is too large" : "Invalid webhook payload",
          requestId,
        },
        payload.reason === "too-large" ? 413 : 400,
      )
    }
    event = stripe.webhooks.constructEvent(
      payload.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    )
  } catch (error) {
    console.error("Stripe webhook signature verification failed", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "stripe_failed",
      requestId,
      path: "/api/stripe/webhook",
      method: "POST",
      category: "webhook-signature",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json(requestId, { error: "Invalid Stripe webhook signature", requestId }, 400)
  }

  if (!event.id?.trim()) {
    return json(requestId, { error: "Invalid Stripe webhook event", requestId }, 400)
  }
  if (!Number.isInteger(event.created) || event.created <= 0) {
    return json(requestId, { error: "Invalid Stripe webhook event timestamp", requestId }, 400)
  }

  try {
    const claim = await claimStripeWebhookEvent(event)
    if (claim.state === "in-progress") {
      return json(
        requestId,
        { received: false, handled: false, retryable: true, requestId },
        503,
      )
    }
    if (claim.state === "duplicate") {
      return json(requestId, { received: true, handled: false, duplicate: true, requestId })
    }
  } catch (error) {
    console.error("Stripe webhook event claim failed", {
      requestId,
      eventId: event.id,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "stripe_failed",
      requestId,
      path: "/api/stripe/webhook",
      method: "POST",
      category: "webhook-claim",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json(requestId, { error: "Unable to record Stripe webhook event", requestId }, 503)
  }

  try {
    let handled = false
    switch (event.type) {
      case "checkout.session.completed":
        handled = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, event.created)
        break
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        handled = await handleSubscriptionEvent(event.data.object as Stripe.Subscription, event.created)
        break
      case "invoice.payment_failed":
        handled = await handleInvoicePaymentFailure(event.data.object as Stripe.Invoice, event.created)
        break
      default:
        break
    }

    await markStripeWebhookProcessed(event.id)

    return json(requestId, { received: true, handled, requestId })
  } catch (error) {
    try {
      await markStripeWebhookFailed(event.id, error instanceof Error ? error.name : "unknown")
    } catch (markError) {
      console.error("Stripe webhook failure state update failed", {
        requestId,
        eventId: event.id,
        error: markError instanceof Error ? markError.name : "unknown",
      })
      void sendOperationalErrorTelemetry({
        event: "stripe_failed",
        requestId,
        path: "/api/stripe/webhook",
        method: "POST",
        category: "webhook-state",
        error: markError instanceof Error ? markError.name : "unknown",
      })
    }
    console.error("Stripe webhook processing failed", {
      requestId,
      eventId: event.id,
      eventType: event.type,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "stripe_failed",
      requestId,
      path: "/api/stripe/webhook",
      method: "POST",
      category: "webhook-processing",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json(requestId, { error: "Stripe webhook processing failed", requestId }, 500)
  }
}
