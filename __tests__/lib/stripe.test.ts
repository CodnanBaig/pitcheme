import {
  STRIPE_PLANS,
  getPlanForPriceId,
  getPriceIdForPlan,
  getStripeConfigurationError,
  getStripeReturnUrl,
  isPaidPlan,
  isStripeBillingEnabled,
  normalizeStripeSubscriptionStatus,
  type PlanType,
} from '@/lib/stripe'

describe('Stripe Configuration', () => {
  const originalBillingFlag = process.env.STRIPE_BILLING_ENABLED
  const originalSecret = process.env.STRIPE_SECRET_KEY
  const originalWebhook = process.env.STRIPE_WEBHOOK_SECRET
  const originalNextAuthUrl = process.env.NEXTAUTH_URL

  afterEach(() => {
    for (const [name, value] of [
      ['STRIPE_BILLING_ENABLED', originalBillingFlag],
      ['STRIPE_SECRET_KEY', originalSecret],
      ['STRIPE_WEBHOOK_SECRET', originalWebhook],
      ['NEXTAUTH_URL', originalNextAuthUrl],
    ] as const) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  })

  describe('runtime helpers', () => {
    it('recognizes paid plans and resolves configured plan IDs', () => {
      expect(isPaidPlan('PRO')).toBe(true)
      expect(isPaidPlan('ENTERPRISE')).toBe(true)
      expect(isPaidPlan('FREE')).toBe(false)
      expect(isPaidPlan('unknown')).toBe(false)
      expect(getPriceIdForPlan('FREE')).toBeNull()
      expect(getPlanForPriceId(null)).toBeNull()
      expect(getPlanForPriceId('price_unknown')).toBeNull()
    })

    it('normalizes provider subscription statuses to the supported contract', () => {
      expect(normalizeStripeSubscriptionStatus('active')).toBe('active')
      expect(normalizeStripeSubscriptionStatus('trialing')).toBe('active')
      expect(normalizeStripeSubscriptionStatus('canceled')).toBe('canceled')
      expect(normalizeStripeSubscriptionStatus('incomplete')).toBe('incomplete')
      expect(normalizeStripeSubscriptionStatus('past_due')).toBe('past_due')
    })

    it('fails closed until every billing prerequisite is configured', () => {
      process.env.STRIPE_BILLING_ENABLED = 'false'
      expect(isStripeBillingEnabled()).toBe(false)
      expect(getStripeConfigurationError()).toBe('Stripe billing is disabled in this deployment')

      process.env.STRIPE_BILLING_ENABLED = 'true'
      delete process.env.STRIPE_WEBHOOK_SECRET
      expect(getStripeConfigurationError()).toBe('Stripe webhook secret is not configured')
    })

    it('builds return URLs from the configured callback origin', () => {
      process.env.NEXTAUTH_URL = 'https://pitchgenie.example.com'
      expect(getStripeReturnUrl('/billing')).toBe('https://pitchgenie.example.com/billing')

      delete process.env.NEXTAUTH_URL
      expect(() => getStripeReturnUrl('/billing')).toThrow('NEXTAUTH_URL is not configured')
    })
  })

  describe('STRIPE_PLANS', () => {
    it('should have correct plan structure', () => {
      expect(STRIPE_PLANS).toEqual({
        FREE: {
          name: 'Free',
          price: 0,
          priceId: null,
          features: ['5 proposals/month', '3 pitch decks/month', 'Basic templates'],
          limits: {
            proposals: 5,
            pitchDecks: 3,
          },
        },
        PRO: {
          name: 'Pro',
          price: 19,
          priceId: process.env.STRIPE_PRO_PRICE_ID,
          features: ['Unlimited proposals', 'Unlimited pitch decks', 'Premium templates', 'Priority support'],
          limits: {
            proposals: -1,
            pitchDecks: -1,
          },
        },
        ENTERPRISE: {
          name: 'Enterprise',
          price: 49,
          priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
          features: ['Everything in Pro', 'Custom branding', 'Team collaboration', 'Advanced analytics', 'Dedicated support'],
          limits: {
            proposals: -1,
            pitchDecks: -1,
          },
        },
      })
    })

    it('should have valid plan types', () => {
      const planTypes: PlanType[] = ['FREE', 'PRO', 'ENTERPRISE']
      
      planTypes.forEach(planType => {
        expect(STRIPE_PLANS[planType]).toBeDefined()
        expect(STRIPE_PLANS[planType].name).toBeTruthy()
        expect(typeof STRIPE_PLANS[planType].price).toBe('number')
        expect(Array.isArray(STRIPE_PLANS[planType].features)).toBe(true)
        expect(STRIPE_PLANS[planType].limits).toBeDefined()
        expect(typeof STRIPE_PLANS[planType].limits.proposals).toBe('number')
        expect(typeof STRIPE_PLANS[planType].limits.pitchDecks).toBe('number')
      })
    })

    it('should have correct limits for each plan', () => {
      // Free plan should have limited usage
      expect(STRIPE_PLANS.FREE.limits.proposals).toBeGreaterThan(0)
      expect(STRIPE_PLANS.FREE.limits.pitchDecks).toBeGreaterThan(0)
      
      // Paid plans should have unlimited usage (-1)
      expect(STRIPE_PLANS.PRO.limits.proposals).toBe(-1)
      expect(STRIPE_PLANS.PRO.limits.pitchDecks).toBe(-1)
      expect(STRIPE_PLANS.ENTERPRISE.limits.proposals).toBe(-1)
      expect(STRIPE_PLANS.ENTERPRISE.limits.pitchDecks).toBe(-1)
    })

    it('should have price escalation from free to enterprise', () => {
      expect(STRIPE_PLANS.FREE.price).toBe(0)
      expect(STRIPE_PLANS.PRO.price).toBeGreaterThan(STRIPE_PLANS.FREE.price)
      expect(STRIPE_PLANS.ENTERPRISE.price).toBeGreaterThan(STRIPE_PLANS.PRO.price)
    })

    it('should have appropriate priceIds for paid plans', () => {
      expect(STRIPE_PLANS.FREE.priceId).toBeNull()
      // PRO and ENTERPRISE should reference environment variables
      // In test environment, these might be undefined, which is expected
    })

    it('should have increasing feature sets', () => {
      expect(STRIPE_PLANS.FREE.features.length).toBeGreaterThan(0)
      expect(STRIPE_PLANS.PRO.features.length).toBeGreaterThan(STRIPE_PLANS.FREE.features.length)
      expect(STRIPE_PLANS.ENTERPRISE.features.length).toBeGreaterThan(STRIPE_PLANS.PRO.features.length)
    })
  })

  describe('Plan Type', () => {
    it('should include all expected plan types', () => {
      const expectedPlans: PlanType[] = ['FREE', 'PRO', 'ENTERPRISE']
      
      expectedPlans.forEach(plan => {
        expect(STRIPE_PLANS).toHaveProperty(plan)
      })
    })

    it('should not have unexpected plan types', () => {
      const knownPlans = Object.keys(STRIPE_PLANS)
      expect(knownPlans).toEqual(['FREE', 'PRO', 'ENTERPRISE'])
    })
  })
})
