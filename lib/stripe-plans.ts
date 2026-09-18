export const STRIPE_PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    priceId: null,
    features: ["5 proposals/month", "3 pitch decks/month", "Basic templates"],
    limits: {
      proposals: 5,
      pitchDecks: 3,
    },
  },
  PRO: {
    name: "Pro",
    price: 19,
    priceId: process.env.STRIPE_PRO_PRICE_ID || null,
    features: ["Unlimited proposals", "Unlimited pitch decks", "Premium templates", "Priority support"],
    limits: {
      proposals: -1,
      pitchDecks: -1,
    },
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: 49,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || null,
    features: ["Everything in Pro", "Custom branding", "Team collaboration", "Advanced analytics", "Dedicated support"],
    limits: {
      proposals: -1,
      pitchDecks: -1,
    },
  },
} as const

export type PlanType = keyof typeof STRIPE_PLANS
export type PaidPlanType = Exclude<PlanType, "FREE">
