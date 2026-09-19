import modelConfiguration from "@/config/openrouter-models.json"

export interface RuntimeEnvironmentStatus {
  ok: boolean
  missing: string[]
  errors: string[]
  warnings: string[]
}

const requiredInEveryEnvironment = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"] as const
const booleanEnvironmentFlags = [
  "HEALTHCHECK_EXTERNAL_SERVICES",
  "HEALTHCHECK_MODEL_CATALOG",
  "HEALTHCHECK_EXPORT_RUNTIME",
  "HEALTHCHECK_DATABASE_INDEXES",
  "STRIPE_BILLING_ENABLED",
  "E2E_TEST_MODE",
  "BRAND_LAB_ENABLED",
] as const
const modelEnvironmentOverrides = Object.values(modelConfiguration).map(({ environment }) => environment)

function hasValue(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname)
  } catch {
    return false
  }
}

function isValidMongoDbUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === "mongodb:" || url.protocol === "mongodb+srv:") && Boolean(url.hostname)
  } catch {
    return false
  }
}

export function getRuntimeEnvironmentStatus(): RuntimeEnvironmentStatus {
  const missing = requiredInEveryEnvironment.filter((name) => !hasValue(name))
  const errors: string[] = []
  const warnings: string[] = []
  const isProduction = process.env.NODE_ENV === "production"

  for (const name of booleanEnvironmentFlags) {
    const value = process.env[name]?.trim()
    if (value && value !== "true" && value !== "false") {
      errors.push(`${name} must be true or false`)
    }
  }

  const rateLimitStore = process.env.RATE_LIMIT_STORE?.trim()
  if (rateLimitStore && rateLimitStore !== "process" && rateLimitStore !== "mongodb") {
    errors.push("RATE_LIMIT_STORE must be process or mongodb")
  }
  if (isProduction && rateLimitStore !== "mongodb") {
    errors.push("RATE_LIMIT_STORE must be mongodb in production")
  }
  if (isProduction) {
    for (const name of ["HEALTHCHECK_EXPORT_RUNTIME", "HEALTHCHECK_DATABASE_INDEXES"] as const) {
      if (process.env[name] !== "true") {
        errors.push(`${name} must be true in production`)
      }
    }
  }

  for (const name of modelEnvironmentOverrides) {
    const value = process.env[name]?.trim()
    if (value && (value.length > 160 || /\s/.test(value))) {
      errors.push(`${name} must be a non-whitespace model identifier of 160 characters or fewer`)
    }
  }

  const configuredCostRate = process.env.AI_COST_PER_MILLION_TOKENS?.trim()
  if (configuredCostRate) {
    const costRate = Number(configuredCostRate)
    if (!Number.isFinite(costRate) || costRate < 0) {
      errors.push("AI_COST_PER_MILLION_TOKENS must be a non-negative number")
    }
  }

  const configuredSmtpPort = process.env.EMAIL_SERVER_PORT?.trim()
  if (configuredSmtpPort) {
    const smtpPort = Number(configuredSmtpPort)
    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65_535) {
      errors.push("EMAIL_SERVER_PORT must be an integer between 1 and 65535")
    }
  }

  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl && !/^mongodb(?:\+srv)?:\/\//.test(databaseUrl)) {
    errors.push("DATABASE_URL must use a MongoDB connection string")
  } else if (databaseUrl && !isValidMongoDbUrl(databaseUrl)) {
    errors.push("DATABASE_URL must be a valid MongoDB connection string")
  }

  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim()
  if (nextAuthUrl && !isAbsoluteHttpUrl(nextAuthUrl)) {
    errors.push("NEXTAUTH_URL must be an absolute http(s) URL")
  }

  const errorMonitoringUrl = process.env.ERROR_MONITORING_WEBHOOK_URL?.trim()
  if (errorMonitoringUrl && !isAbsoluteHttpUrl(errorMonitoringUrl)) {
    errors.push("ERROR_MONITORING_WEBHOOK_URL must be an absolute http(s) URL")
  } else if (isProduction && errorMonitoringUrl && !errorMonitoringUrl.startsWith("https://")) {
    errors.push("ERROR_MONITORING_WEBHOOK_URL must use https:// in production")
  }

  if (isProduction && databaseUrl?.startsWith("mongodb://") && !/[?&]replicaSet=/.test(databaseUrl)) {
    errors.push("DATABASE_URL must target a MongoDB replica set in production")
  }

  if (isProduction) {
    if (!hasValue("OPENROUTER_API_KEY")) {
      errors.push("OPENROUTER_API_KEY is required in production")
    }

    const isLocalE2ECallback = process.env.E2E_TEST_MODE === "true"
      && /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(process.env.NEXTAUTH_URL || "")
    if (process.env.E2E_TEST_MODE === "true" && !isLocalE2ECallback) {
      errors.push("E2E_TEST_MODE must be disabled outside a local E2E callback")
    }
    if (nextAuthUrl && isAbsoluteHttpUrl(nextAuthUrl) && !nextAuthUrl.startsWith("https://") && !isLocalE2ECallback) {
      errors.push("NEXTAUTH_URL must use https:// in production")
    }

    if ((process.env.NEXTAUTH_SECRET?.length || 0) < 32) {
      errors.push("NEXTAUTH_SECRET must be at least 32 characters in production")
    }
  }

  const smtpValues = ["EMAIL_SERVER_HOST", "EMAIL_SERVER_USER", "EMAIL_SERVER_PASSWORD"]
  const configuredSmtpValues = smtpValues.filter(hasValue).length
  if (configuredSmtpValues > 0 && configuredSmtpValues < smtpValues.length) {
    warnings.push("SMTP is partially configured; email magic links will remain disabled")
  }

  const stripeValues = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRO_PRICE_ID",
    "STRIPE_ENTERPRISE_PRICE_ID",
  ]
  const configuredStripeValues = stripeValues.filter(hasValue).length
  if (process.env.STRIPE_BILLING_ENABLED === "true") {
    if (configuredStripeValues < stripeValues.length) {
      errors.push("Stripe billing is enabled but its secret, webhook, and paid-plan price IDs are incomplete")
    }
  } else if (configuredStripeValues > 0 && configuredStripeValues < stripeValues.length) {
    warnings.push("Stripe configuration is partial while billing remains disabled")
  }

  return {
    ok: missing.length === 0 && errors.length === 0,
    missing,
    errors,
    warnings,
  }
}

export function assertRuntimeEnvironment(): void {
  const status = getRuntimeEnvironmentStatus()
  if (!status.ok) {
    const details = [
      ...status.missing.map((name) => `${name} is required`),
      ...status.errors,
    ]
    throw new Error(`Invalid runtime environment: ${details.join("; ")}`)
  }
}
