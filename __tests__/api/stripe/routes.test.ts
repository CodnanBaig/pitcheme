jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/rate-limit", () => ({ enforceRateLimit: jest.fn() }))
jest.mock("@/lib/prisma", () => ({
  prisma: {
    userSubscription: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: { sessions: { create: jest.fn() } },
    billingPortal: { sessions: { create: jest.fn() } },
    subscriptions: { retrieve: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
  },
  getStripeConfigurationError: jest.fn(),
  getStripeReturnUrl: jest.fn((path: string) => `https://pitchgenie.example.com${path}`),
  getPriceIdForPlan: jest.fn(() => "price_test_pro"),
  isPaidPlan: jest.fn((value: unknown) => value === "PRO" || value === "ENTERPRISE"),
  normalizeStripeSubscriptionStatus: jest.fn(() => "past_due"),
}))
jest.mock("@/lib/subscription", () => ({
  getUserSubscription: jest.fn(),
  syncStripeSubscription: jest.fn(),
  updateUserSubscription: jest.fn(),
}))
jest.mock("@/lib/stripe-webhook", () => ({
  claimStripeWebhookEvent: jest.fn(),
  markStripeWebhookFailed: jest.fn(),
  markStripeWebhookProcessed: jest.fn(),
}))

import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { enforceRateLimit } from "@/lib/rate-limit"
import {
  stripe,
  getStripeConfigurationError,
} from "@/lib/stripe"
import {
  POST as createCheckout,
} from "@/app/api/stripe/create-checkout/route"
import { POST as createPortal } from "@/app/api/stripe/create-portal/route"
import { POST as stripeWebhook } from "@/app/api/stripe/webhook/route"
import {
  getUserSubscription,
  syncStripeSubscription,
  updateUserSubscription,
} from "@/lib/subscription"
import {
  claimStripeWebhookEvent,
  markStripeWebhookFailed,
  markStripeWebhookProcessed,
} from "@/lib/stripe-webhook"

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockRateLimit = enforceRateLimit as jest.MockedFunction<typeof enforceRateLimit>
const mockStripe = stripe as unknown as {
  checkout: { sessions: { create: jest.Mock } }
  billingPortal: { sessions: { create: jest.Mock } }
  subscriptions: { retrieve: jest.Mock }
  webhooks: { constructEvent: jest.Mock }
}
const mockGetStripeConfigurationError = getStripeConfigurationError as jest.Mock
const mockFindMany = prisma.userSubscription.findMany as jest.Mock
const mockSubscription = getUserSubscription as jest.MockedFunction<typeof getUserSubscription>
const mockSyncSubscription = syncStripeSubscription as jest.MockedFunction<typeof syncStripeSubscription>
const mockUpdateSubscription = updateUserSubscription as jest.MockedFunction<typeof updateUserSubscription>
const mockClaimWebhook = claimStripeWebhookEvent as jest.MockedFunction<typeof claimStripeWebhookEvent>
const mockMarkWebhookFailed = markStripeWebhookFailed as jest.MockedFunction<typeof markStripeWebhookFailed>
const mockMarkWebhookProcessed = markStripeWebhookProcessed as jest.MockedFunction<typeof markStripeWebhookProcessed>

const session = { user: { id: "user-1", email: "owner@example.com" } }
const activeFreeSubscription = {
  userId: "user-1",
  plan: "FREE" as const,
  status: "active" as const,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

function request(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function webhookRequest(signature?: string) {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : undefined,
    body: "raw-payload",
  })
}

describe("Stripe billing APIs", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test"
    mockAuth.mockResolvedValue(session as never)
    mockGetStripeConfigurationError.mockReturnValue(null)
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 })
    mockSubscription.mockResolvedValue(activeFreeSubscription as never)
    mockClaimWebhook.mockResolvedValue({ state: "claimed" })
    mockMarkWebhookFailed.mockResolvedValue(undefined)
    mockMarkWebhookProcessed.mockResolvedValue(undefined)
  })

  it("rejects checkout when the caller is not authenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const response = await createCheckout(request("http://localhost/api/stripe/create-checkout", "POST", { plan: "PRO" }))

    expect(response.status).toBe(401)
    expect((await response.json()).error).toBe("Unauthorized")
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it("rejects unsupported checkout plans before calling Stripe", async () => {
    const response = await createCheckout(request("http://localhost/api/stripe/create-checkout", "POST", { plan: "FREE" }))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain("paid plan")
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it("creates a subscription checkout session with ownership metadata", async () => {
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: "cs_test_123", url: "https://checkout.stripe.test/session" })

    const response = await createCheckout(
      request("http://localhost/api/stripe/create-checkout", "POST", { plan: "PRO" }, { "x-request-id": "checkout-1" }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      url: "https://checkout.stripe.test/session",
      sessionId: "cs_test_123",
      requestId: "checkout-1",
    })
    expect(response.headers.get("X-Request-ID")).toBe("checkout-1")
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription",
      line_items: [{ price: "price_test_pro", quantity: 1 }],
      client_reference_id: "user-1",
      customer_email: "owner@example.com",
      metadata: { userId: "user-1", plan: "PRO" },
      subscription_data: { metadata: { userId: "user-1", plan: "PRO" } },
    }))
  })

  it("does not create a second checkout for an active paid subscription", async () => {
    mockSubscription.mockResolvedValue({ ...activeFreeSubscription, plan: "PRO" } as never)

    const response = await createCheckout(request("http://localhost/api/stripe/create-checkout", "POST", { plan: "PRO" }))

    expect(response.status).toBe(409)
    expect((await response.json()).error).toContain("active paid")
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it("creates a customer portal session for an existing Stripe customer", async () => {
    mockSubscription.mockResolvedValue({ ...activeFreeSubscription, plan: "PRO", stripeCustomerId: "cus_test" } as never)
    mockStripe.billingPortal.sessions.create.mockResolvedValue({ url: "https://billing.stripe.test/session" })

    const response = await createPortal(request("http://localhost/api/stripe/create-portal", "POST"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.url).toBe("https://billing.stripe.test/session")
    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_test",
      return_url: "https://pitchgenie.example.com/billing",
    })
  })

  it("returns a clear response when an account has no billing customer", async () => {
    const response = await createPortal(request("http://localhost/api/stripe/create-portal", "POST"))

    expect(response.status).toBe(409)
    expect((await response.json()).error).toContain("billing customer")
  })

  it("rejects webhook requests without a Stripe signature", async () => {
    const response = await stripeWebhook(webhookRequest())

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain("Missing Stripe signature")
  })

  it("verifies and synchronizes subscription webhook events", async () => {
    const subscription = {
      id: "sub_test",
      customer: "cus_test",
      status: "active",
      metadata: { userId: "user-1" },
      items: { data: [{ price: { id: "price_test_pro" } }] },
      current_period_start: 1_735_689_600,
      current_period_end: 1_738_368_000,
      cancel_at_period_end: false,
    }
    mockStripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_test",
      created: 1_735_689_600,
      type: "customer.subscription.updated",
      data: { object: subscription },
    })
    mockSyncSubscription.mockResolvedValue("PRO" as never)
    mockFindMany.mockResolvedValue([{ userId: "user-1" }])

    const response = await stripeWebhook(webhookRequest("t=1,v1=signature"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ received: true, handled: true })
    expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
      "raw-payload",
      "t=1,v1=signature",
      "whsec_test",
    )
    expect(mockSyncSubscription).toHaveBeenCalledWith("user-1", subscription, 1_735_689_600)
    expect(mockClaimWebhook).toHaveBeenCalledWith(expect.objectContaining({
      id: "evt_test",
      type: "customer.subscription.updated",
    }))
    expect(mockMarkWebhookProcessed).toHaveBeenCalledWith("evt_test")
  })

  it("acknowledges duplicate webhook deliveries without reprocessing them", async () => {
    mockClaimWebhook.mockResolvedValue({ state: "duplicate" })
    mockStripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_duplicate",
      created: 1_735_689_600,
      type: "customer.subscription.updated",
      data: { object: {} },
    })

    const response = await stripeWebhook(webhookRequest("duplicate"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ received: true, handled: false, duplicate: true })
    expect(mockSyncSubscription).not.toHaveBeenCalled()
    expect(mockMarkWebhookProcessed).not.toHaveBeenCalled()
  })

  it("returns a retryable response while another delivery is processing", async () => {
    mockClaimWebhook.mockResolvedValue({ state: "in-progress" })
    mockStripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_in_progress",
      created: 1_735_689_600,
      type: "customer.subscription.updated",
      data: { object: {} },
    })

    const response = await stripeWebhook(webhookRequest("in-progress"))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toMatchObject({ received: false, handled: false, retryable: true })
    expect(mockSyncSubscription).not.toHaveBeenCalled()
    expect(mockMarkWebhookProcessed).not.toHaveBeenCalled()
  })

  it("rejects invalid webhook signatures without mutating subscription state", async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("signature mismatch")
    })

    const response = await stripeWebhook(webhookRequest("invalid"))

    expect(response.status).toBe(400)
    expect(mockSyncSubscription).not.toHaveBeenCalled()
    expect(mockUpdateSubscription).not.toHaveBeenCalled()
  })

  it("rejects oversized webhook payloads before signature verification", async () => {
    const request = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "valid" },
      body: "x".repeat(1024 * 1024 + 1),
    })

    const response = await stripeWebhook(request)

    expect(response.status).toBe(413)
    expect((await response.json()).error).toBe("Webhook payload is too large")
    expect(mockStripe.webhooks.constructEvent).not.toHaveBeenCalled()
  })

  it("resolves checkout completion through the subscription lookup", async () => {
    const subscription = {
      id: "sub_checkout",
      customer: "cus_checkout",
      status: "active",
      metadata: { userId: "user-1" },
      items: { data: [{ price: { id: "price_test_pro" } }] },
      current_period_start: 1_735_689_600,
      current_period_end: 1_738_368_000,
      cancel_at_period_end: false,
    }
    mockStripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_checkout",
      created: 1_735_689_600,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_checkout",
          metadata: { userId: "user-1" },
          client_reference_id: "user-1",
          customer: "cus_checkout",
          subscription: "sub_checkout",
        },
      },
    })
    mockStripe.subscriptions.retrieve.mockResolvedValue(subscription)
    mockSyncSubscription.mockResolvedValue("PRO" as never)
    mockFindMany.mockResolvedValue([{ userId: "user-1" }])

    const response = await stripeWebhook(webhookRequest("valid"))

    expect(response.status).toBe(200)
    expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_checkout")
    expect(mockSyncSubscription).toHaveBeenCalledWith("user-1", subscription, 1_735_689_600)
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { stripeCustomerId: "cus_checkout" },
          { stripeSubscriptionId: "sub_checkout" },
        ],
      },
      select: { userId: true },
    })
  })

  it("does not mutate billing state when webhook ownership references conflict", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_conflict",
      created: 1_735_689_600,
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_user_2",
          customer: "cus_user_1",
          metadata: { userId: "user-1" },
          status: "active",
          items: { data: [{ price: { id: "price_test_pro" } }] },
          current_period_start: 1_735_689_600,
          current_period_end: 1_738_368_000,
          cancel_at_period_end: false,
        },
      },
    })
    mockFindMany.mockResolvedValue([{ userId: "user-1" }, { userId: "user-2" }])

    const response = await stripeWebhook(webhookRequest("conflict"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ received: true, handled: false })
    expect(mockSyncSubscription).not.toHaveBeenCalled()
    expect(mockMarkWebhookProcessed).toHaveBeenCalledWith("evt_conflict")
  })

  it("rejects a verified event with an invalid timestamp before claiming it", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_invalid_timestamp",
      created: 0,
      type: "customer.subscription.updated",
      data: { object: {} },
    })

    const response = await stripeWebhook(webhookRequest("invalid-timestamp"))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe("Invalid Stripe webhook event timestamp")
    expect(mockClaimWebhook).not.toHaveBeenCalled()
  })
})
