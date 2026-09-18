// Mock dependencies
import { Prisma } from '@prisma/client'

process.env.STRIPE_PRO_PRICE_ID = 'price_test_pro'
process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_test_enterprise'

const mockGetUserSubscription = jest.fn()
const mockUpdateUserSubscription = jest.fn()
const mockGetUsage = jest.fn()
const mockIncrementUsage = jest.fn()
const mockCanUserGenerate = jest.fn()
jest.mock('@/lib/prisma', () => ({
  prisma: {
    userSubscription: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    usage: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { 
  getUserSubscription, 
  updateUserSubscription, 
  getUserUsage, 
  incrementUsage, 
  reserveUsage,
  releaseUsage,
  canUserGenerate,
  syncStripeSubscription,
} from '@/lib/subscription'

const mockPrismaUserSubscriptionFindUnique = prisma.userSubscription.findUnique as jest.MockedFunction<typeof prisma.userSubscription.findUnique>
const mockPrismaUserSubscriptionCreate = prisma.userSubscription.create as jest.MockedFunction<typeof prisma.userSubscription.create>
const mockPrismaUserSubscriptionUpsert = prisma.userSubscription.upsert as jest.MockedFunction<typeof prisma.userSubscription.upsert>
const mockPrismaUsageFindUnique = prisma.usage.findUnique as jest.MockedFunction<typeof prisma.usage.findUnique>
const mockPrismaUsageCreate = prisma.usage.create as jest.MockedFunction<typeof prisma.usage.create>
const mockPrismaUsageUpdateMany = prisma.usage.updateMany as jest.MockedFunction<typeof prisma.usage.updateMany>
const mockPrismaUsageUpsert = prisma.usage.upsert as jest.MockedFunction<typeof prisma.usage.upsert>

describe('Subscription Management', () => {
  function uniqueConstraintError() {
    return new Prisma.PrismaClientKnownRequestError('duplicate key', {
      code: 'P2002',
      clientVersion: 'test',
    })
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getUserSubscription', () => {
    it('should return existing subscription', async () => {
      const mockSubscription = {
        userId: 'user-123',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripePriceId: 'price_123',
        plan: 'PRO',
        status: 'active',
        currentPeriodStart: new Date('2023-01-01'),
        currentPeriodEnd: new Date('2023-02-01'),
        cancelAtPeriodEnd: false,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      }

      mockPrismaUserSubscriptionFindUnique.mockResolvedValue(mockSubscription)

      const result = await getUserSubscription('user-123')

      expect(result).toEqual(mockSubscription)
      expect(mockPrismaUserSubscriptionFindUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' }
      })
    })

    it('should create default free subscription if none exists', async () => {
      const newSubscription = {
        userId: 'user-123',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        plan: 'FREE',
        status: 'active',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: null,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      }

      mockPrismaUserSubscriptionFindUnique.mockResolvedValue(null)
      mockPrismaUserSubscriptionCreate.mockResolvedValue(newSubscription)

      const result = await getUserSubscription('user-123')

      expect(result.plan).toBe('FREE')
      expect(result.status).toBe('active')
      expect(mockPrismaUserSubscriptionCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          plan: 'FREE',
          status: 'active'
        }
      })
    })

    it('should handle database errors gracefully', async () => {
      mockPrismaUserSubscriptionFindUnique.mockRejectedValue(new Error('Database error'))

      await expect(getUserSubscription('user-123')).rejects.toThrow('Database error')
    })

    it('re-reads a subscription after a concurrent initialization race', async () => {
      const subscription = {
        userId: 'user-123',
        plan: 'FREE',
        status: 'active',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      }
      mockPrismaUserSubscriptionFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(subscription as never)
      mockPrismaUserSubscriptionCreate.mockRejectedValue(uniqueConstraintError())

      await expect(getUserSubscription('user-123')).resolves.toMatchObject({ plan: 'FREE' })
      expect(mockPrismaUserSubscriptionFindUnique).toHaveBeenCalledTimes(2)
    })
  })

  describe('updateUserSubscription', () => {
    it('should update existing subscription', async () => {
      const updates = {
        plan: 'PRO' as const,
        status: 'active' as const,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123'
      }

      await updateUserSubscription('user-123', updates)

      expect(mockPrismaUserSubscriptionUpsert).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        update: {
          ...updates,
          updatedAt: expect.any(Date)
        },
        create: {
          userId: 'user-123',
          ...updates,
          plan: 'PRO',
          status: 'active'
        }
      })
    })

    it('should create subscription if it doesnt exist', async () => {
      const updates = {
        plan: 'ENTERPRISE' as const,
        status: 'active' as const
      }

      await updateUserSubscription('user-123', updates)

      expect(mockPrismaUserSubscriptionUpsert).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        update: {
          ...updates,
          updatedAt: expect.any(Date)
        },
        create: {
          userId: 'user-123',
          ...updates,
          plan: 'ENTERPRISE',
          status: 'active'
        }
      })
    })

    it('should use default values when creating new subscription', async () => {
      await updateUserSubscription('user-123', {})

      expect(mockPrismaUserSubscriptionUpsert).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        update: {
          updatedAt: expect.any(Date)
        },
        create: {
          userId: 'user-123',
          plan: 'FREE',
          status: 'active'
        }
      })
    })
  })

  describe('Stripe synchronization', () => {
    const subscription = {
      id: 'sub_test',
      customer: 'cus_test',
      status: 'active',
      items: { data: [{ price: { id: 'price_test_pro' } }] },
      current_period_start: 1_735_689_600,
      current_period_end: 1_738_368_000,
      cancel_at_period_end: false,
    }

    it('maps a known Stripe price to the paid plan and persists the state', async () => {
      await expect(syncStripeSubscription('user-123', subscription as never)).resolves.toBe('PRO')

      expect(mockPrismaUserSubscriptionUpsert).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        update: expect.objectContaining({
          stripeCustomerId: 'cus_test',
          stripeSubscriptionId: 'sub_test',
          stripePriceId: 'price_test_pro',
          plan: 'PRO',
          status: 'active',
          cancelAtPeriodEnd: false,
          updatedAt: expect.any(Date),
        }),
        create: expect.objectContaining({
          userId: 'user-123',
          plan: 'PRO',
          status: 'active',
        }),
      })
    })

    it('does not grant access for an unknown Stripe price', async () => {
      await expect(syncStripeSubscription('user-123', {
        ...subscription,
        items: { data: [{ price: { id: 'price_unknown' } }] },
      } as never)).resolves.toBeNull()

      expect(mockPrismaUserSubscriptionUpsert).not.toHaveBeenCalled()
    })

    it('persists cancellation while leaving access inactive', async () => {
      await expect(syncStripeSubscription('user-123', {
        ...subscription,
        status: 'canceled',
        cancel_at_period_end: true,
      } as never)).resolves.toBe('PRO')

      expect(mockPrismaUserSubscriptionUpsert).toHaveBeenCalledWith(expect.objectContaining({
        update: expect.objectContaining({
          plan: 'PRO',
          status: 'canceled',
          cancelAtPeriodEnd: true,
        }),
      }))
    })
  })

  describe('getUserUsage', () => {
    const currentMonth = new Date().toISOString().slice(0, 7)

    it('should return existing usage record', async () => {
      const mockUsage = {
        userId: 'user-123',
        month: currentMonth,
        proposals: 3,
        pitchDecks: 2
      }

      mockPrismaUsageFindUnique.mockResolvedValue(mockUsage)

      const result = await getUserUsage('user-123')

      expect(result).toEqual(mockUsage)
      expect(mockPrismaUsageFindUnique).toHaveBeenCalledWith({
        where: {
          userId_month: {
            userId: 'user-123',
            month: currentMonth
          }
        }
      })
    })

    it('should create new usage record if none exists', async () => {
      const newUsage = {
        userId: 'user-123',
        month: currentMonth,
        proposals: 0,
        pitchDecks: 0
      }

      mockPrismaUsageFindUnique.mockResolvedValue(null)
      mockPrismaUsageCreate.mockResolvedValue(newUsage)

      const result = await getUserUsage('user-123')

      expect(result).toEqual(newUsage)
      expect(mockPrismaUsageCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          month: currentMonth,
          proposals: 0,
          pitchDecks: 0
        }
      })
    })

    it('re-reads usage after a concurrent monthly initialization race', async () => {
      const usage = { userId: 'user-123', month: currentMonth, proposals: 1, pitchDecks: 0 }
      mockPrismaUsageFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(usage)
      mockPrismaUsageCreate.mockRejectedValue(uniqueConstraintError())

      await expect(getUserUsage('user-123')).resolves.toEqual(usage)
      expect(mockPrismaUsageFindUnique).toHaveBeenCalledTimes(2)
    })
  })

  describe('incrementUsage', () => {
    const currentMonth = new Date().toISOString().slice(0, 7)

    it('should increment proposal usage', async () => {
      await incrementUsage('user-123', 'proposals')

      expect(mockPrismaUsageUpsert).toHaveBeenCalledWith({
        where: {
          userId_month: {
            userId: 'user-123',
            month: currentMonth
          }
        },
        update: {
          proposals: {
            increment: 1
          }
        },
        create: {
          userId: 'user-123',
          month: currentMonth,
          proposals: 1,
          pitchDecks: 0
        }
      })
    })

    it('should increment pitch deck usage', async () => {
      await incrementUsage('user-123', 'pitchDecks')

      expect(mockPrismaUsageUpsert).toHaveBeenCalledWith({
        where: {
          userId_month: {
            userId: 'user-123',
            month: currentMonth
          }
        },
        update: {
          pitchDecks: {
            increment: 1
          }
        },
        create: {
          userId: 'user-123',
          month: currentMonth,
          proposals: 0,
          pitchDecks: 1
        }
      })
    })
  })

  describe('canUserGenerate', () => {
    it('should allow generation for unlimited plan', async () => {
      mockPrismaUserSubscriptionFindUnique.mockResolvedValue({
        userId: 'user-123',
        plan: 'PRO',
        status: 'active',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      } as never)
      mockPrismaUsageFindUnique.mockResolvedValue({
        userId: 'user-123',
        month: new Date().toISOString().slice(0, 7),
        proposals: 100,
        pitchDecks: 50,
      })

      await expect(canUserGenerate('user-123', 'proposals')).resolves.toBe(true)
    })

    it('should block generation when limit exceeded for free plan', async () => {
      mockPrismaUserSubscriptionFindUnique.mockResolvedValue({
        userId: 'user-123',
        plan: 'FREE',
        status: 'active',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      } as never)
      mockPrismaUsageFindUnique.mockResolvedValue({
        userId: 'user-123',
        month: new Date().toISOString().slice(0, 7),
        proposals: 5,
        pitchDecks: 0,
      })

      await expect(canUserGenerate('user-123', 'proposals')).resolves.toBe(false)
    })

    it('should allow generation when under limit for free plan', async () => {
      mockPrismaUserSubscriptionFindUnique.mockResolvedValue({
        userId: 'user-123',
        plan: 'FREE',
        status: 'active',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      } as never)
      mockPrismaUsageFindUnique.mockResolvedValue({
        userId: 'user-123',
        month: new Date().toISOString().slice(0, 7),
        proposals: 4,
        pitchDecks: 0,
      })

      await expect(canUserGenerate('user-123', 'proposals')).resolves.toBe(true)
    })

    it('treats a canceled paid plan as free for usage access', async () => {
      mockPrismaUserSubscriptionFindUnique.mockResolvedValue({
        userId: 'user-123',
        plan: 'PRO',
        status: 'canceled',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      } as never)
      mockPrismaUsageFindUnique.mockResolvedValue({
        userId: 'user-123',
        month: new Date().toISOString().slice(0, 7),
        proposals: 5,
        pitchDecks: 0,
      })

      await expect(canUserGenerate('user-123', 'proposals')).resolves.toBe(false)
    })
  })

  describe('shared usage reservations', () => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    const freeSubscription = {
      userId: 'user-123',
      plan: 'FREE',
      status: 'active',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    }

    it('reserves a finite-plan generation with a conditional update', async () => {
      mockPrismaUserSubscriptionFindUnique.mockResolvedValue(freeSubscription as never)
      mockPrismaUsageUpdateMany.mockResolvedValue({ count: 1 })

      await expect(reserveUsage('user-123', 'proposals')).resolves.toBe(true)

      expect(mockPrismaUsageUpdateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          month: currentMonth,
          proposals: { lt: 5 },
        },
        data: { proposals: { increment: 1 } },
      })
      expect(mockPrismaUsageCreate).not.toHaveBeenCalled()
    })

    it('releases a reservation without allowing a negative counter', async () => {
      mockPrismaUsageUpdateMany.mockResolvedValue({ count: 1 })

      await releaseUsage('user-123', 'pitchDecks')

      expect(mockPrismaUsageUpdateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          month: currentMonth,
          pitchDecks: { gt: 0 },
        },
        data: { pitchDecks: { decrement: 1 } },
      })
    })
  })
})
