import { NextRequest, NextResponse } from 'next/server'
import { createMocks } from 'node-mocks-http'
import { POST } from '@/app/api/auth/register/route'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth-utils'
import { resetRateLimits } from '@/lib/rate-limit'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))

// Mock auth utils
jest.mock('@/lib/auth-utils', () => ({
  hashPassword: jest.fn(),
}))

const mockedPrisma = prisma as jest.Mocked<typeof prisma>
const mockedHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>

describe('/api/auth/register', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    jest.clearAllMocks()
    resetRateLimits()
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    resetRateLimits()
  })

  describe('POST /api/auth/register', () => {
    it('should successfully register a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      }

      mockedPrisma.user.findUnique.mockResolvedValue(null)
      mockedHashPassword.mockResolvedValue('hashedPassword123')
      mockedPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: userData.email,
        name: userData.name,
        password: 'hashedPassword123',
        image: null,
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const { req } = createMocks({
        method: 'POST',
        body: userData,
      })

      // Convert the request to NextRequest format
      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const response = await POST(request as any)
      const result = await response.json()

      expect(response.status).toBe(201)
      expect(response.headers.get('X-Request-ID')).toEqual(expect.any(String))
      expect(result.message).toBe('User created successfully')
      expect(result.user).toEqual({
        id: 'user-1',
        email: userData.email,
        name: userData.name,
        image: null,
        emailVerified: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
      expect(result.user.password).toBeUndefined()
    })

    it('should return 400 if email is missing', async () => {
      const userData = {
        password: 'password123',
        name: 'Test User',
      }

      const request = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const response = await POST(request as any)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('Email and password are required')
    })

    it('should return 400 if password is missing', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
      }

      const request = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const response = await POST(request as any)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('Email and password are required')
    })

    it('should return 400 if user already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
      }

      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: userData.email,
        name: userData.name,
        password: 'existingPassword',
        image: null,
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const response = await POST(request as any)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('User with this email already exists')
    })

    it('should return a conflict when the unique email index wins a registration race', async () => {
      const userData = {
        email: 'racing@example.com',
        password: 'password123',
      }

      mockedPrisma.user.findUnique.mockResolvedValue(null)
      mockedHashPassword.mockResolvedValue('hashedPassword123')
      mockedPrisma.user.create.mockRejectedValue({ code: 'P2002' })

      const request = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      })

      const response = await POST(request as any)
      const result = await response.json()

      expect(response.status).toBe(409)
      expect(result).toMatchObject({
        error: 'User with this email already exists',
        requestId: expect.any(String),
      })
    })

    it('should handle database errors gracefully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      }

      mockedPrisma.user.findUnique.mockRejectedValue(new Error('Database error'))

      const request = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const response = await POST(request as any)
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.error).toBe('Internal server error')
    })

    it('should enforce an email bucket even when the client address changes', async () => {
      process.env.NODE_ENV = 'production'
      const userData = {
        email: 'limited@example.com',
        password: 'password123',
      }

      mockedPrisma.user.findUnique.mockResolvedValue(null)
      mockedHashPassword.mockResolvedValue('hashedPassword123')
      mockedPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: userData.email,
        name: null,
        password: 'hashedPassword123',
        image: null,
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await POST(new NextRequest('http://localhost:3000/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': `203.0.113.${attempt + 1}`,
          },
          body: JSON.stringify(userData),
        }))
        expect(response.status).toBe(201)
      }

      const blocked = await POST(new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.99',
        },
        body: JSON.stringify(userData),
      }))

      expect(blocked.status).toBe(429)
      expect((await blocked.json()).error).toContain('Too many registration attempts')
    })

    it('should handle invalid JSON in request body', async () => {
      const request = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const response = await POST(request as any)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('Invalid JSON request body')
    })

    it('should reject an oversized request body before touching the database', async () => {
      const request = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'large@example.com', password: 'password123', name: 'x'.repeat(9000) }),
      })

      const response = await POST(request as any)

      expect(response.status).toBe(413)
      expect((await response.json()).error).toBe('Request body is too large')
      expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('should register user without name', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
      }

      mockedPrisma.user.findUnique.mockResolvedValue(null)
      mockedHashPassword.mockResolvedValue('hashedPassword123')
      mockedPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: userData.email,
        name: null,
        password: 'hashedPassword123',
        image: null,
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const response = await POST(request as any)
      const result = await response.json()

      expect(response.status).toBe(201)
      expect(result.user.name).toBeNull()
    })
  })
})
