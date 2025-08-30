import { STRIPE_PLANS, PlanType } from '@/lib/stripe'

describe('Stripe Configuration', () => {
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