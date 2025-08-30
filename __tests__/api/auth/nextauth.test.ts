import { authOptions } from '@/auth'
import { verifyPassword } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
  },
}))

jest.mock('@/lib/auth-utils', () => ({
  verifyPassword: jest.fn(),
}))

const mockedPrisma = prisma as jest.Mocked<typeof prisma>
const mockedVerifyPassword = verifyPassword as jest.MockedFunction<typeof verifyPassword>

describe('NextAuth Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Credentials Provider', () => {
    const credentialsProvider = authOptions.providers[0] as any

    it('should authenticate valid user credentials', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword123',
        image: null,
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      }

      mockedPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockedVerifyPassword.mockResolvedValue(true)

      const result = await credentialsProvider.authorize(credentials)

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        image: mockUser.image,
      })
      expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: credentials.email },
      })
      expect(mockedVerifyPassword).toHaveBeenCalledWith(
        credentials.password,
        mockUser.password
      )
    })

    it('should reject authentication for invalid password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword123',
        image: null,
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword',
      }

      mockedPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockedVerifyPassword.mockResolvedValue(false)

      const result = await credentialsProvider.authorize(credentials)

      expect(result).toBeNull()
    })

    it('should reject authentication for non-existent user', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'password123',
      }

      mockedPrisma.user.findUnique.mockResolvedValue(null)

      const result = await credentialsProvider.authorize(credentials)

      expect(result).toBeNull()
      expect(mockedVerifyPassword).not.toHaveBeenCalled()
    })

    it('should reject authentication for user without password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        password: null,
        image: null,
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      }

      mockedPrisma.user.findUnique.mockResolvedValue(mockUser)

      const result = await credentialsProvider.authorize(credentials)

      expect(result).toBeNull()
      expect(mockedVerifyPassword).not.toHaveBeenCalled()
    })

    it('should reject authentication when email is missing', async () => {
      const credentials = {
        password: 'password123',
      }

      const result = await credentialsProvider.authorize(credentials)

      expect(result).toBeNull()
      expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('should reject authentication when password is missing', async () => {
      const credentials = {
        email: 'test@example.com',
      }

      const result = await credentialsProvider.authorize(credentials)

      expect(result).toBeNull()
      expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      }

      mockedPrisma.user.findUnique.mockRejectedValue(new Error('Database error'))

      await expect(credentialsProvider.authorize(credentials)).rejects.toThrow('Database error')
    })
  })

  describe('Session and JWT Callbacks', () => {
    it('should include user ID in session callback', async () => {
      const session = {
        user: {
          id: 'original-id',
          email: 'test@example.com',
          name: 'Test User',
        },
      }

      const token = {
        id: 'token-user-id',
        email: 'test@example.com',
        name: 'Test User',
      }

      const result = await authOptions.callbacks.session({ session, token })

      expect(result.user.id).toBe('token-user-id')
    })

    it('should handle session callback without token', async () => {
      const session = {
        user: {
          id: 'original-id',
          email: 'test@example.com',
          name: 'Test User',
        },
      }

      const result = await authOptions.callbacks.session({ session, token: null })

      expect(result.user.id).toBe('original-id')
    })

    it('should set user ID in JWT callback when user is present', async () => {
      const token = {
        email: 'test@example.com',
        name: 'Test User',
      }

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      }

      const result = await authOptions.callbacks.jwt({ token, user })

      expect(result.id).toBe('user-123')
    })

    it('should return token unchanged when user is not present', async () => {
      const token = {
        id: 'existing-id',
        email: 'test@example.com',
        name: 'Test User',
      }

      const result = await authOptions.callbacks.jwt({ token, user: null })

      expect(result).toEqual(token)
    })
  })

  describe('Configuration Validation', () => {
    it('should have proper configuration structure', () => {
      expect(authOptions.session.strategy).toBe('jwt')
      expect(authOptions.pages.signIn).toBe('/auth/signin')
      expect(authOptions.pages.signOut).toBe('/auth/signout')
      expect(authOptions.pages.error).toBe('/auth/error')
      expect(authOptions.pages.verifyRequest).toBe('/auth/verify-request')
      expect(authOptions.providers).toHaveLength(1)
      expect(authOptions.providers[0].name).toBe('credentials')
    })

    it('should use environment variables correctly', () => {
      expect(authOptions.secret).toBe(process.env.NEXTAUTH_SECRET)
    })
  })
})