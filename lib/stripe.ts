import Stripe from "stripe"
import { STRIPE_PLANS, type PaidPlanType, type PlanType } from "./stripe-plans"

export { STRIPE_PLANS } from "./stripe-plans"
export type { PaidPlanType, PlanType } from "./stripe-plans"

// Stripe remains opt-in for local development. Set STRIPE_BILLING_ENABLED=true
// only after the secret, webhook, and paid-price IDs are configured in the
// deployment environment.
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null

export function isStripeBillingEnabled(): boolean {
  return process.env.STRIPE_BILLING_ENABLED === "true"
}

export type SubscriptionStatus = "active" | "canceled" | "past_due" | "incomplete"

export function isPaidPlan(value: unknown): value is PaidPlanType {
  return value === "PRO" || value === "ENTERPRISE"
}

export function getPriceIdForPlan(plan: PlanType): string | null {
  return STRIPE_PLANS[plan].priceId
}

export function getPlanForPriceId(priceId: string | null | undefined): PaidPlanType | null {
  if (!priceId) return null
  if (priceId === STRIPE_PLANS.PRO.priceId) return "PRO"
  if (priceId === STRIPE_PLANS.ENTERPRISE.priceId) return "ENTERPRISE"
  return null
}

export function normalizeStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): SubscriptionStatus {
  if (status === "active" || status === "trialing") return "active"
  if (status === "canceled") return "canceled"
  if (status === "incomplete") return "incomplete"
  return "past_due"
}

export function getStripeConfigurationError(): string | null {
  if (!isStripeBillingEnabled()) return "Stripe billing is disabled in this deployment"
  if (!stripe) return "Stripe secret key is not configured"
  if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) return "Stripe webhook secret is not configured"
  if (!STRIPE_PLANS.PRO.priceId || !STRIPE_PLANS.ENTERPRISE.priceId) {
    return "Stripe paid-plan price IDs are not configured"
  }
  if (!process.env.NEXTAUTH_URL?.trim()) return "NEXTAUTH_URL is not configured"
  return null
}

export function getStripeReturnUrl(path: string): string {
  const baseUrl = process.env.NEXTAUTH_URL?.trim()
  if (!baseUrl) throw new Error("NEXTAUTH_URL is not configured")
  return new URL(path, baseUrl).toString()
}
