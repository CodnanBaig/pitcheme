import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
  typescript: true,
})

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
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: ["Unlimited proposals", "Unlimited pitch decks", "Premium templates", "Priority support"],
    limits: {
      proposals: -1, // unlimited
      pitchDecks: -1, // unlimited
    },
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: 49,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    features: ["Everything in Pro", "Custom branding", "Team collaboration", "Advanced analytics", "Dedicated support"],
    limits: {
      proposals: -1, // unlimited
      pitchDecks: -1, // unlimited
    },
  },
} as const

export type PlanType = keyof typeof STRIPE_PLANS
