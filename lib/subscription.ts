import { Prisma } from "@prisma/client"
import {
  STRIPE_PLANS,
  normalizeStripeSubscriptionStatus,
  getPlanForPriceId,
  type PlanType,
  type SubscriptionStatus,
} from "./stripe"
import type Stripe from "stripe"
import { prisma } from "./prisma"

// Check for required environment variable
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required")
}

export interface UserSubscription {
  userId: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripePriceId?: string
  plan: PlanType
  status: SubscriptionStatus
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
  cancelAtPeriodEnd?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UsageRecord {
  userId: string
  month: string // YYYY-MM format
  proposals: number
  pitchDecks: number
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  if (!userId) {
    throw new Error("User ID is required")
  }

  let subscription = await prisma.userSubscription.findUnique({
    where: { userId }
  })

  if (!subscription) {
    // Create default free subscription
    try {
      subscription = await prisma.userSubscription.create({
        data: {
          userId,
          plan: "FREE",
          status: "active",
        }
      })
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error
      subscription = await prisma.userSubscription.findUnique({ where: { userId } })
    }
  }

  if (!subscription) throw new Error("Unable to initialize user subscription")

  return {
    userId: subscription.userId,
    stripeCustomerId: subscription.stripeCustomerId ?? undefined,
    stripeSubscriptionId: subscription.stripeSubscriptionId ?? undefined,
    stripePriceId: subscription.stripePriceId ?? undefined,
    plan: subscription.plan as PlanType,
    status: subscription.status as SubscriptionStatus,
    currentPeriodStart: subscription.currentPeriodStart ?? undefined,
    currentPeriodEnd: subscription.currentPeriodEnd ?? undefined,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? undefined,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  }
}

/**
 * Apply the subscription state received from Stripe without granting access
 * to an unknown price. Webhook delivery is idempotent because this is an
 * ownership-scoped upsert keyed by the local user ID.
 */
export async function syncStripeSubscription(
  userId: string,
  subscription: Stripe.Subscription,
): Promise<PlanType | null> {
  if (!userId) throw new Error("User ID is required")

  const priceId = subscription.items.data[0]?.price?.id ?? null
  const plan = getPlanForPriceId(priceId)
  if (!plan) return null

  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id

  await updateUserSubscription(userId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    plan,
    status: normalizeStripeSubscriptionStatus(subscription.status),
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  })

  return plan
}

export async function updateUserSubscription(userId: string, updates: Partial<UserSubscription>) {
  await prisma.userSubscription.upsert({
    where: { userId },
    update: {
      ...updates,
      updatedAt: new Date(),
    },
    create: {
      userId,
      ...updates,
      plan: updates.plan || "FREE",
      status: updates.status || "active",
    },
  })
}

export async function getUserUsage(userId: string): Promise<UsageRecord> {
  if (!userId) {
    throw new Error("User ID is required")
  }

  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

  let usage = await prisma.usage.findUnique({
    where: {
      userId_month: {
        userId,
        month: currentMonth,
      }
    }
  })

  if (!usage) {
    try {
      usage = await prisma.usage.create({
        data: {
          userId,
          month: currentMonth,
          proposals: 0,
          pitchDecks: 0,
        }
      })
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error
      usage = await prisma.usage.findUnique({
        where: {
          userId_month: {
            userId,
            month: currentMonth,
          }
        }
      })
    }
  }

  if (!usage) throw new Error("Unable to initialize monthly usage")

  return {
    userId: usage.userId,
    month: usage.month,
    proposals: usage.proposals,
    pitchDecks: usage.pitchDecks,
  }
}

export async function incrementUsage(userId: string, type: "proposals" | "pitchDecks") {
  const currentMonth = new Date().toISOString().slice(0, 7)

  await prisma.usage.upsert({
    where: {
      userId_month: {
        userId,
        month: currentMonth,
      }
    },
    update: {
      [type]: {
        increment: 1,
      }
    },
    create: {
      userId,
      month: currentMonth,
      proposals: type === "proposals" ? 1 : 0,
      pitchDecks: type === "pitchDecks" ? 1 : 0,
    },
  })
}

type UsageType = "proposals" | "pitchDecks"

function usageField(type: UsageType): "proposals" | "pitchDecks" {
  return type
}

function usageCreateData(userId: string, month: string, type: UsageType) {
  return type === "proposals"
    ? { userId, month, proposals: 1, pitchDecks: 0 }
    : { userId, month, proposals: 0, pitchDecks: 1 }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/**
 * Reserve one generation atomically when the shared MongoDB mode is enabled.
 * The conditional update prevents concurrent instances from exceeding a
 * finite plan limit. Call releaseUsage when the generation fails after a
 * reservation; successful generations keep the reservation as their usage.
 */
export async function reserveUsage(userId: string, type: UsageType): Promise<boolean> {
  if (!userId) throw new Error("User ID is required")

  const subscription = await getUserSubscription(userId)
  const planKey = subscription?.status === "active" ? subscription.plan : "FREE"
  const plan = STRIPE_PLANS[planKey] || STRIPE_PLANS.FREE
  const limit = plan.limits[type]
  const month = new Date().toISOString().slice(0, 7)
  const field = usageField(type)

  if (limit === -1) {
    await prisma.usage.upsert({
      where: { userId_month: { userId, month } },
      update: { [field]: { increment: 1 } },
      create: usageCreateData(userId, month, type),
    })
    return true
  }

  const updated = await prisma.usage.updateMany({
    where: {
      userId,
      month,
      [field]: { lt: limit },
    } as Prisma.UsageWhereInput,
    data: { [field]: { increment: 1 } } as Prisma.UsageUpdateManyMutationInput,
  })
  if (updated.count > 0) return true

  try {
    await prisma.usage.create({ data: usageCreateData(userId, month, type) })
    return true
  } catch (error) {
    // A concurrent instance may have created the first monthly row. Only
    // retry that expected unique-key race; surface other database failures.
    if (!isUniqueConstraintError(error)) throw error
  }

  const retried = await prisma.usage.updateMany({
    where: {
      userId,
      month,
      [field]: { lt: limit },
    } as Prisma.UsageWhereInput,
    data: { [field]: { increment: 1 } } as Prisma.UsageUpdateManyMutationInput,
  })
  return retried.count > 0
}

/** Release a reservation after a failed generation without allowing negatives. */
export async function releaseUsage(userId: string, type: UsageType): Promise<void> {
  if (!userId) throw new Error("User ID is required")

  const month = new Date().toISOString().slice(0, 7)
  const field = usageField(type)
  await prisma.usage.updateMany({
    where: {
      userId,
      month,
      [field]: { gt: 0 },
    } as Prisma.UsageWhereInput,
    data: { [field]: { decrement: 1 } } as Prisma.UsageUpdateManyMutationInput,
  })
}

export async function canUserGenerate(userId: string, type: "proposals" | "pitchDecks"): Promise<boolean> {
  const subscription = await getUserSubscription(userId)
  const usage = await getUserUsage(userId)

  const planKey = subscription?.status === "active" ? subscription.plan : "FREE"
  const plan = STRIPE_PLANS[planKey]
  const limit = plan.limits[type]

  // Unlimited usage
  if (limit === -1) return true

  // Check if under limit
  return usage[type] < limit
}
