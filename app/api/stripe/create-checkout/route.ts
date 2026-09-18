import { type NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { auth } from "@/auth"
import {
  getPriceIdForPlan,
  getStripeConfigurationError,
  getStripeReturnUrl,
  isPaidPlan,
  stripe,
  type PaidPlanType,
} from "@/lib/stripe"
import { getUserSubscription } from "@/lib/subscription"
import { enforceRateLimit } from "@/lib/rate-limit"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"

function json(
  requestId: string,
  body: Record<string, unknown>,
  status = 200,
  headers?: Headers,
) {
  const init = jsonWithRequestId(requestId, { status })
  const responseHeaders = new Headers(init.headers)
  headers?.forEach((value, key) => responseHeaders.set(key, value))
  return NextResponse.json(body, { ...init, headers: responseHeaders })
}

function rateLimitHeaders(resetAt: number): Headers {
  const headers = new Headers()
  headers.set("Retry-After", String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))))
  return headers
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return json(requestId, { error: "Unauthorized", requestId }, 401)
    }

    const configurationError = getStripeConfigurationError()
    if (configurationError) {
      return json(requestId, { error: configurationError, requestId }, 503)
    }
    if (!stripe) {
      return json(requestId, { error: "Stripe is not configured", requestId }, 503)
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return json(requestId, { error: "Invalid JSON request body", requestId }, 400)
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json(requestId, { error: "Invalid request body", requestId }, 400)
    }

    const plan = (body as Record<string, unknown>).plan
    if (!isPaidPlan(plan)) {
      return json(requestId, { error: "A paid plan of PRO or ENTERPRISE is required", requestId }, 400)
    }

    const rateLimit = await enforceRateLimit(`stripe-checkout:${session.user.id}`, {
      limit: 10,
      windowMs: 60_000,
    })
    if (!rateLimit.allowed) {
      return json(
        requestId,
        { error: "Too many checkout attempts. Try again shortly.", requestId },
        429,
        rateLimitHeaders(rateLimit.resetAt),
      )
    }

    const subscription = await getUserSubscription(session.user.id)
    if (subscription?.status === "active" && subscription.plan !== "FREE") {
      return json(requestId, { error: "An active paid subscription already exists", requestId }, 409)
    }

    const priceId = getPriceIdForPlan(plan as PaidPlanType)
    if (!priceId) {
      return json(requestId, { error: "The selected Stripe price is not configured", requestId }, 503)
    }

    const customerEmail = session.user.email?.trim()
    if (!subscription?.stripeCustomerId && !customerEmail) {
      return json(requestId, { error: "A verified account email is required for checkout", requestId }, 400)
    }

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: getStripeReturnUrl("/billing?checkout=success"),
      cancel_url: getStripeReturnUrl("/pricing?checkout=cancelled"),
      client_reference_id: session.user.id,
      metadata: {
        userId: session.user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          userId: session.user.id,
          plan,
        },
      },
    }

    if (subscription?.stripeCustomerId) {
      params.customer = subscription.stripeCustomerId
    } else {
      params.customer_email = customerEmail
    }

    const checkout = await stripe.checkout.sessions.create(params)
    if (!checkout.url) {
      return json(requestId, { error: "Stripe did not return a checkout URL", requestId }, 502)
    }

    return json(requestId, {
      url: checkout.url,
      sessionId: checkout.id,
      requestId,
    })
  } catch (error) {
    console.error("Stripe checkout error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    return json(requestId, { error: "Unable to create checkout session", requestId }, 502)
  }
}
