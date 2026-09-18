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
  if (typeof metadataUserId === "string" && metadataUserId.trim()) return metadataUserId.trim()

  const references = [
    customerId ? { stripeCustomerId: customerId } : null,
    subscriptionId ? { stripeSubscriptionId: subscriptionId } : null,
  ].filter((reference): reference is { stripeCustomerId: string } | { stripeSubscriptionId: string } => Boolean(reference))

  if (references.length === 0) return null
  const record = await prisma.userSubscription.findFirst({
    where: { OR: references },
    select: { userId: true },
  })
  return record?.userId ?? null
}

async function syncSubscriptionForUser(
  userId: string | null,
  subscription: Stripe.Subscription,
): Promise<boolean> {
  if (!userId) return false
  return Boolean(await syncStripeSubscription(userId, subscription))
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<boolean> {
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
  return syncSubscriptionForUser(userId, subscription)
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription): Promise<boolean> {
  const userId = await findUserId(
    subscription.metadata?.userId,
    stripeId(subscription.customer),
    subscription.id,
  )
  return syncSubscriptionForUser(userId, subscription)
}

async function handleInvoicePaymentFailure(invoice: Stripe.Invoice): Promise<boolean> {
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
  })
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
    const payload = await request.text()
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    )
  } catch (error) {
    console.error("Stripe webhook signature verification failed", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    return json(requestId, { error: "Invalid Stripe webhook signature", requestId }, 400)
  }

  try {
    let handled = false
    switch (event.type) {
      case "checkout.session.completed":
        handled = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        handled = await handleSubscriptionEvent(event.data.object as Stripe.Subscription)
        break
      case "invoice.payment_failed":
        handled = await handleInvoicePaymentFailure(event.data.object as Stripe.Invoice)
        break
      default:
        break
    }

    return json(requestId, { received: true, handled, requestId })
  } catch (error) {
    console.error("Stripe webhook processing failed", {
      requestId,
      eventType: event.type,
      error: error instanceof Error ? error.name : "unknown",
    })
    return json(requestId, { error: "Stripe webhook processing failed", requestId }, 500)
  }
}
