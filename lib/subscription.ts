import { STRIPE_PLANS, type PlanType } from "./stripe"
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
  status: "active" | "canceled" | "past_due" | "incomplete"
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
    subscription = await prisma.userSubscription.create({
      data: {
        userId,
        plan: "FREE",
        status: "active",
      }
    })
  }

  return {
    userId: subscription.userId,
    stripeCustomerId: subscription.stripeCustomerId || undefined,
    stripeSubscriptionId: subscription.stripeSubscriptionId || undefined,
    stripePriceId: subscription.stripePriceId || undefined,
    plan: subscription.plan as PlanType,
    status: subscription.status as "active" | "canceled" | "past_due" | "incomplete",
    currentPeriodStart: subscription.currentPeriodStart || undefined,
    currentPeriodEnd: subscription.currentPeriodEnd || undefined,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || undefined,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  }
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
    usage = await prisma.usage.create({
      data: {
        userId,
        month: currentMonth,
        proposals: 0,
        pitchDecks: 0,
      }
    })
  }

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

export async function canUserGenerate(userId: string, type: "proposals" | "pitchDecks"): Promise<boolean> {
  const subscription = await getUserSubscription(userId)
  const usage = await getUserUsage(userId)

  const planKey = (subscription?.plan) || "FREE"
  const plan = STRIPE_PLANS[planKey]
  const limit = plan.limits[type]

  // Unlimited usage
  if (limit === -1) return true

  // Check if under limit
  return usage[type] < limit
}
