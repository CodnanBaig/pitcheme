export interface RuntimeEnvironmentStatus {
  ok: boolean
  missing: string[]
  errors: string[]
  warnings: string[]
}

const requiredInEveryEnvironment = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"] as const

function hasValue(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

export function getRuntimeEnvironmentStatus(): RuntimeEnvironmentStatus {
  const missing = requiredInEveryEnvironment.filter((name) => !hasValue(name))
  const errors: string[] = []
  const warnings: string[] = []
  const isProduction = process.env.NODE_ENV === "production"

  if (process.env.DATABASE_URL && !/^mongodb(?:\+srv)?:\/\//.test(process.env.DATABASE_URL)) {
    errors.push("DATABASE_URL must use a MongoDB connection string")
  }

  if (isProduction) {
    if (!hasValue("OPENROUTER_API_KEY")) {
      errors.push("OPENROUTER_API_KEY is required in production")
    }

    const isLocalE2ECallback = process.env.E2E_TEST_MODE === "true"
      && /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(process.env.NEXTAUTH_URL || "")
    if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.startsWith("https://") && !isLocalE2ECallback) {
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
