import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getStripeConfigurationError, getStripeReturnUrl, stripe } from "@/lib/stripe"
import { getUserSubscription } from "@/lib/subscription"
import { enforceRateLimit } from "@/lib/rate-limit"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"

export const runtime = "nodejs"
export const maxDuration = 30

function json(requestId: string, body: Record<string, unknown>, status = 200, headers?: Headers) {
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

    const rateLimit = await enforceRateLimit(`stripe-portal:${session.user.id}`, {
      limit: 10,
      windowMs: 60_000,
    })
    if (!rateLimit.allowed) {
      return json(
        requestId,
        { error: "Too many billing portal attempts. Try again shortly.", requestId },
        429,
        rateLimitHeaders(rateLimit.resetAt),
      )
    }

    const subscription = await getUserSubscription(session.user.id)
    if (!subscription?.stripeCustomerId) {
      return json(requestId, { error: "No Stripe billing customer exists for this account", requestId }, 409)
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: getStripeReturnUrl("/billing"),
    })

    return json(requestId, { url: portal.url, requestId })
  } catch (error) {
    console.error("Stripe portal error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "stripe_failed",
      requestId,
      path: "/api/stripe/create-portal",
      method: "POST",
      category: "portal",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json(requestId, { error: "Unable to create billing portal session", requestId }, 502)
  }
}
