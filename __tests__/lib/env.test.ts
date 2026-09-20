import { assertRuntimeEnvironment, getRuntimeEnvironmentStatus } from "@/lib/env"

describe("runtime environment validation", () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalOpenRouterKey = process.env.OPENROUTER_API_KEY
  const originalNextAuthUrl = process.env.NEXTAUTH_URL
  const originalNextAuthSecret = process.env.NEXTAUTH_SECRET
  const originalDatabaseUrl = process.env.DATABASE_URL
  const originalE2eMode = process.env.E2E_TEST_MODE
  const originalPortfolioDemoMode = process.env.PORTFOLIO_DEMO_MODE
  const originalBrandLabFlag = process.env.BRAND_LAB_ENABLED
  const originalStripeFlag = process.env.STRIPE_BILLING_ENABLED
  const originalStripeSecret = process.env.STRIPE_SECRET_KEY
  const originalStripeWebhook = process.env.STRIPE_WEBHOOK_SECRET
  const originalStripeProPrice = process.env.STRIPE_PRO_PRICE_ID
  const originalStripeEnterprisePrice = process.env.STRIPE_ENTERPRISE_PRICE_ID
  const originalRateLimitStore = process.env.RATE_LIMIT_STORE
  const originalHealthcheckExternal = process.env.HEALTHCHECK_EXTERNAL_SERVICES
  const originalHealthcheckModelCatalog = process.env.HEALTHCHECK_MODEL_CATALOG
  const originalHealthcheckExport = process.env.HEALTHCHECK_EXPORT_RUNTIME
  const originalHealthcheckIndexes = process.env.HEALTHCHECK_DATABASE_INDEXES
  const originalAiCostRate = process.env.AI_COST_PER_MILLION_TOKENS
  const originalSmtpPort = process.env.EMAIL_SERVER_PORT
  const originalPrimaryModel = process.env.OPENROUTER_PRIMARY_MODEL
  const originalErrorMonitoringUrl = process.env.ERROR_MONITORING_WEBHOOK_URL

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    if (originalOpenRouterKey === undefined) {
      delete process.env.OPENROUTER_API_KEY
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenRouterKey
    }
    for (const [name, value] of [
      ["DATABASE_URL", originalDatabaseUrl],
      ["NEXTAUTH_URL", originalNextAuthUrl],
      ["NEXTAUTH_SECRET", originalNextAuthSecret],
      ["E2E_TEST_MODE", originalE2eMode],
      ["PORTFOLIO_DEMO_MODE", originalPortfolioDemoMode],
      ["BRAND_LAB_ENABLED", originalBrandLabFlag],
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
    for (const [name, value] of [
      ["RATE_LIMIT_STORE", originalRateLimitStore],
      ["HEALTHCHECK_EXTERNAL_SERVICES", originalHealthcheckExternal],
      ["HEALTHCHECK_MODEL_CATALOG", originalHealthcheckModelCatalog],
      ["HEALTHCHECK_EXPORT_RUNTIME", originalHealthcheckExport],
      ["HEALTHCHECK_DATABASE_INDEXES", originalHealthcheckIndexes],
      ["AI_COST_PER_MILLION_TOKENS", originalAiCostRate],
      ["EMAIL_SERVER_PORT", originalSmtpPort],
      ["OPENROUTER_PRIMARY_MODEL", originalPrimaryModel],
      ["ERROR_MONITORING_WEBHOOK_URL", originalErrorMonitoringUrl],
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
    process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/pitchgenie?replicaSet=rs0"
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

  it("accepts explicit portfolio demo mode without provider credentials", () => {
    process.env.NODE_ENV = "production"
    process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/pitchgenie?replicaSet=rs0"
    process.env.NEXTAUTH_URL = "https://pitchgenie.example.com"
    process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
    process.env.PORTFOLIO_DEMO_MODE = "true"
    process.env.HEALTHCHECK_EXPORT_RUNTIME = "true"
    process.env.HEALTHCHECK_DATABASE_INDEXES = "true"
    process.env.RATE_LIMIT_STORE = "mongodb"
    delete process.env.OPENROUTER_API_KEY

    const status = getRuntimeEnvironmentStatus()

    expect(status).toMatchObject({ ok: true, errors: [] })
    expect(status.warnings).toContain(
      "Portfolio demo mode uses deterministic generation instead of an external AI provider",
    )
  })

  it("allows a local callback URL only in explicit E2E mode", () => {
    process.env.NODE_ENV = "production"
    process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/pitchgenie?replicaSet=rs0"
    process.env.NEXTAUTH_URL = "http://127.0.0.1:3200"
    process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
    process.env.OPENROUTER_API_KEY = "configured-provider-key"
    process.env.E2E_TEST_MODE = "true"
    process.env.HEALTHCHECK_EXPORT_RUNTIME = "true"
    process.env.HEALTHCHECK_DATABASE_INDEXES = "true"
    process.env.RATE_LIMIT_STORE = "mongodb"

    const status = getRuntimeEnvironmentStatus()

    expect(status.ok).toBe(true)
    expect(status.errors).not.toContain("NEXTAUTH_URL must use https:// in production")
  })

  it("does not allow E2E mode to weaken HTTPS for non-local callback URLs", () => {
    process.env.NODE_ENV = "production"
    process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/pitchgenie?replicaSet=rs0"
    process.env.NEXTAUTH_URL = "http://e2e.example.com"
    process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
    process.env.OPENROUTER_API_KEY = "configured-provider-key"
    process.env.E2E_TEST_MODE = "true"
    process.env.HEALTHCHECK_EXPORT_RUNTIME = "true"
    process.env.HEALTHCHECK_DATABASE_INDEXES = "true"
    process.env.RATE_LIMIT_STORE = "mongodb"

    const status = getRuntimeEnvironmentStatus()

    expect(status.ok).toBe(false)
    expect(status.errors).toContain("NEXTAUTH_URL must use https:// in production")
  })

  it("rejects malformed callback URLs before production startup", () => {
    process.env.NODE_ENV = "production"
    process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/pitchgenie?replicaSet=rs0"
    process.env.NEXTAUTH_URL = "not-a-url"
    process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
    process.env.OPENROUTER_API_KEY = "configured-provider-key"
    process.env.HEALTHCHECK_EXPORT_RUNTIME = "true"
    process.env.HEALTHCHECK_DATABASE_INDEXES = "true"
    process.env.RATE_LIMIT_STORE = "mongodb"

    const status = getRuntimeEnvironmentStatus()

    expect(status.ok).toBe(false)
    expect(status.errors).toContain("NEXTAUTH_URL must be an absolute http(s) URL")
  })

  it("rejects deterministic E2E fixtures on a real production URL", () => {
    process.env.NODE_ENV = "production"
    process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/pitchgenie?replicaSet=rs0"
    process.env.NEXTAUTH_URL = "https://pitchgenie.example.com"
    process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
    process.env.OPENROUTER_API_KEY = "configured-provider-key"
    process.env.E2E_TEST_MODE = "true"
    process.env.HEALTHCHECK_EXPORT_RUNTIME = "true"
    process.env.HEALTHCHECK_DATABASE_INDEXES = "true"
    process.env.RATE_LIMIT_STORE = "mongodb"

    const status = getRuntimeEnvironmentStatus()

    expect(status.ok).toBe(false)
    expect(status.errors).toContain("E2E_TEST_MODE must be disabled outside a local E2E callback")
  })

  it("requires complete Stripe configuration when billing is explicitly enabled", () => {
    process.env.NODE_ENV = "production"
    process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/pitchgenie?replicaSet=rs0"
    process.env.NEXTAUTH_URL = "https://pitchgenie.example.com"
    process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
    process.env.OPENROUTER_API_KEY = "configured-provider-key"
    process.env.HEALTHCHECK_EXPORT_RUNTIME = "true"
    process.env.HEALTHCHECK_DATABASE_INDEXES = "true"
    process.env.RATE_LIMIT_STORE = "mongodb"
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

  it("rejects standalone MongoDB URLs in production", () => {
    process.env.NODE_ENV = "production"
    process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/pitchgenie"
    process.env.NEXTAUTH_URL = "https://pitchgenie.example.com"
    process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
    process.env.OPENROUTER_API_KEY = "configured-provider-key"
    process.env.HEALTHCHECK_EXPORT_RUNTIME = "true"
    process.env.HEALTHCHECK_DATABASE_INDEXES = "true"
    process.env.RATE_LIMIT_STORE = "mongodb"

    const status = getRuntimeEnvironmentStatus()

    expect(status.ok).toBe(false)
    expect(status.errors).toContain("DATABASE_URL must target a MongoDB replica set in production")
  })

  it("rejects MongoDB URLs without a host", () => {
    process.env.NODE_ENV = "production"
    process.env.DATABASE_URL = "mongodb://?replicaSet=rs0"
    process.env.NEXTAUTH_URL = "https://pitchgenie.example.com"
    process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
    process.env.OPENROUTER_API_KEY = "configured-provider-key"
    process.env.HEALTHCHECK_EXPORT_RUNTIME = "true"
    process.env.HEALTHCHECK_DATABASE_INDEXES = "true"
    process.env.RATE_LIMIT_STORE = "mongodb"

    const status = getRuntimeEnvironmentStatus()

    expect(status.ok).toBe(false)
    expect(status.errors).toContain("DATABASE_URL must be a valid MongoDB connection string")
  })

  it("requires the shared rate-limit store in production", () => {
    process.env.NODE_ENV = "production"
    process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/pitchgenie?replicaSet=rs0"
    process.env.NEXTAUTH_URL = "https://pitchgenie.example.com"
    process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
    process.env.OPENROUTER_API_KEY = "configured-provider-key"
    delete process.env.RATE_LIMIT_STORE

    const status = getRuntimeEnvironmentStatus()

    expect(status.ok).toBe(false)
    expect(status.errors).toContain("RATE_LIMIT_STORE must be mongodb in production")
  })

  it("requires production readiness probes", () => {
    process.env.NODE_ENV = "production"
    process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/pitchgenie?replicaSet=rs0"
    process.env.NEXTAUTH_URL = "https://pitchgenie.example.com"
    process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
    process.env.OPENROUTER_API_KEY = "configured-provider-key"
    process.env.RATE_LIMIT_STORE = "mongodb"
    delete process.env.HEALTHCHECK_EXPORT_RUNTIME
    delete process.env.HEALTHCHECK_DATABASE_INDEXES

    const status = getRuntimeEnvironmentStatus()

    expect(status.ok).toBe(false)
    expect(status.errors).toEqual(expect.arrayContaining([
      "HEALTHCHECK_EXPORT_RUNTIME must be true in production",
      "HEALTHCHECK_DATABASE_INDEXES must be true in production",
    ]))
  })

  it("rejects malformed operational configuration instead of silently falling back", () => {
    process.env.NODE_ENV = "development"
    process.env.RATE_LIMIT_STORE = "redis"
    process.env.HEALTHCHECK_EXTERNAL_SERVICES = "ture"
    process.env.BRAND_LAB_ENABLED = "enabled"
    process.env.OPENROUTER_PRIMARY_MODEL = "model with spaces"
    process.env.AI_COST_PER_MILLION_TOKENS = "not-a-number"
    process.env.EMAIL_SERVER_PORT = "70000"

    const status = getRuntimeEnvironmentStatus()

    expect(status.ok).toBe(false)
    expect(status.errors).toEqual(expect.arrayContaining([
      "RATE_LIMIT_STORE must be process or mongodb",
      "HEALTHCHECK_EXTERNAL_SERVICES must be true or false",
      "BRAND_LAB_ENABLED must be true or false",
      "OPENROUTER_PRIMARY_MODEL must be a non-whitespace model identifier of 160 characters or fewer",
      "AI_COST_PER_MILLION_TOKENS must be a non-negative number",
      "EMAIL_SERVER_PORT must be an integer between 1 and 65535",
    ]))
  })

  it("validates the optional error-monitoring webhook", () => {
    process.env.NODE_ENV = "development"
    process.env.ERROR_MONITORING_WEBHOOK_URL = "monitoring.example.test/events"

    expect(getRuntimeEnvironmentStatus().errors).toContain(
      "ERROR_MONITORING_WEBHOOK_URL must be an absolute http(s) URL",
    )

    process.env.ERROR_MONITORING_WEBHOOK_URL = "https://monitoring.example.test/events"
    expect(getRuntimeEnvironmentStatus().errors).not.toContain(
      "ERROR_MONITORING_WEBHOOK_URL must be an absolute http(s) URL",
    )

    process.env.NODE_ENV = "production"
    process.env.ERROR_MONITORING_WEBHOOK_URL = "http://monitoring.example.test/events"
    expect(getRuntimeEnvironmentStatus().errors).toContain(
      "ERROR_MONITORING_WEBHOOK_URL must use https:// in production",
    )
  })
})
