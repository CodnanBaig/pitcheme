// Stripe integration disabled. Keep plan metadata only.
export const stripe = null as unknown as never

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
    priceId: null,
    features: ["Unlimited proposals", "Unlimited pitch decks", "Premium templates", "Priority support"],
    limits: {
      proposals: -1, // unlimited
      pitchDecks: -1, // unlimited
    },
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: 49,
    priceId: null,
    features: ["Everything in Pro", "Custom branding", "Team collaboration", "Advanced analytics", "Dedicated support"],
    limits: {
      proposals: -1, // unlimited
      pitchDecks: -1, // unlimited
    },
  },
} as const

export type PlanType = keyof typeof STRIPE_PLANS
