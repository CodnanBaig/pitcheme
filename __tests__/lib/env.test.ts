import { assertRuntimeEnvironment, getRuntimeEnvironmentStatus } from "@/lib/env"

describe("runtime environment validation", () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalOpenRouterKey = process.env.OPENROUTER_API_KEY
  const originalNextAuthUrl = process.env.NEXTAUTH_URL
  const originalNextAuthSecret = process.env.NEXTAUTH_SECRET
  const originalE2eMode = process.env.E2E_TEST_MODE
  const originalStripeFlag = process.env.STRIPE_BILLING_ENABLED
  const originalStripeSecret = process.env.STRIPE_SECRET_KEY
  const originalStripeWebhook = process.env.STRIPE_WEBHOOK_SECRET
  const originalStripeProPrice = process.env.STRIPE_PRO_PRICE_ID
  const originalStripeEnterprisePrice = process.env.STRIPE_ENTERPRISE_PRICE_ID

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    if (originalOpenRouterKey === undefined) {
      delete process.env.OPENROUTER_API_KEY
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenRouterKey
    }
    for (const [name, value] of [
      ["NEXTAUTH_URL", originalNextAuthUrl],
      ["NEXTAUTH_SECRET", originalNextAuthSecret],
      ["E2E_TEST_MODE", originalE2eMode],
    ] as const) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    for (const [name, value] of [
      ["STRIPE_BILLING_ENABLED", originalStripeFlag],
      ["STRIPE_SECRET_KEY", originalStripeSecret],
      ["STRIPE_WEBHOOK_SECRET", originalStripeWebhook],
      ["STRIPE_PRO_PRICE_ID", originalStripeProPrice],
      ["STRIPE_ENTERPRISE_PRICE_ID", originalStripeEnterprisePrice],
    ] as const) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  })

  it("accepts the base development configuration", () => {
    process.env.NODE_ENV = "development"
    delete process.env.OPENROUTER_API_KEY

    expect(getRuntimeEnvironmentStatus()).toMatchObject({
      ok: true,
      missing: [],
    })
    expect(() => assertRuntimeEnvironment()).not.toThrow()
  })

  it("requires production AI credentials and HTTPS", () => {
    process.env.NODE_ENV = "production"
    process.env.NEXTAUTH_URL = "http://localhost:3000"
    delete process.env.OPENROUTER_API_KEY

    const status = getRuntimeEnvironmentStatus()

    expect(status.ok).toBe(false)
    expect(status.errors).toEqual(expect.arrayContaining([
      "OPENROUTER_API_KEY is required in production",
      "NEXTAUTH_URL must use https:// in production",
    ]))
    expect(() => assertRuntimeEnvironment()).toThrow("Invalid runtime environment")
  })

  it("allows a local callback URL only in explicit E2E mode", () => {
    process.env.NODE_ENV = "production"
    process.env.NEXTAUTH_URL = "http://127.0.0.1:3200"
    process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
    process.env.OPENROUTER_API_KEY = "configured-provider-key"
    process.env.E2E_TEST_MODE = "true"

    const status = getRuntimeEnvironmentStatus()

    expect(status.ok).toBe(true)
    expect(status.errors).not.toContain("NEXTAUTH_URL must use https:// in production")
  })

  it("does not allow E2E mode to weaken HTTPS for non-local callback URLs", () => {
    process.env.NODE_ENV = "production"
    process.env.NEXTAUTH_URL = "http://e2e.example.com"
    process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
    process.env.OPENROUTER_API_KEY = "configured-provider-key"
    process.env.E2E_TEST_MODE = "true"

    const status = getRuntimeEnvironmentStatus()

    expect(status.ok).toBe(false)
    expect(status.errors).toContain("NEXTAUTH_URL must use https:// in production")
  })

  it("requires complete Stripe configuration when billing is explicitly enabled", () => {
    process.env.NODE_ENV = "production"
    process.env.NEXTAUTH_URL = "https://pitchgenie.example.com"
    process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
    process.env.OPENROUTER_API_KEY = "configured-provider-key"
    process.env.STRIPE_BILLING_ENABLED = "true"
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_WEBHOOK_SECRET
    delete process.env.STRIPE_PRO_PRICE_ID
    delete process.env.STRIPE_ENTERPRISE_PRICE_ID

    const incomplete = getRuntimeEnvironmentStatus()
    expect(incomplete.ok).toBe(false)
    expect(incomplete.errors).toContain(
      "Stripe billing is enabled but its secret, webhook, and paid-plan price IDs are incomplete",
    )

    process.env.STRIPE_SECRET_KEY = "sk_test_configured"
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_configured"
    process.env.STRIPE_PRO_PRICE_ID = "price_pro"
    process.env.STRIPE_ENTERPRISE_PRICE_ID = "price_enterprise"

    expect(getRuntimeEnvironmentStatus()).toMatchObject({ ok: true, errors: [] })
  })
})
