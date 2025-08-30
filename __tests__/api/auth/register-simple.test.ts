import { NextRequest } from 'next/server'

// Mock Prisma first before importing
jest.mock('@/lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}))

// Mock auth utils
jest.mock('@/lib/auth-utils', () => ({
  hashPassword: jest.fn(),
}))

import { POST } from '@/app/api/auth/register/route'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth-utils'

const mockedPrisma = prisma as jest.Mocked<typeof prisma>
const mockedHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>

describe('/api/auth/register - Simple Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

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

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(201)
    expect(result.message).toBe('User created successfully')
    expect(result.user.email).toBe(userData.email)
    expect(result.user.password).toBeUndefined()
  })

  it('should return 400 if email is missing', async () => {
    const userData = {
      password: 'password123',
      name: 'Test User',
    }

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })

    const response = await POST(request)
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

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(400)
    expect(result.error).toBe('User with this email already exists')
  })

  it('should handle database errors gracefully', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    }

    mockedPrisma.user.findUnique.mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(500)
    expect(result.error).toBe('Internal server error')
  })
})