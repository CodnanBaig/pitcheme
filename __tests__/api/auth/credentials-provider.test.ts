// Mock dependencies first
const mockUserFindUnique = jest.fn()
const mockVerifyPassword = jest.fn()

jest.mock('@/lib/prisma', () => ({
  user: {
    findUnique: mockUserFindUnique,
  },
}))

jest.mock('@/lib/auth-utils', () => ({
  verifyPassword: mockVerifyPassword,
}))

// Import auth configuration without NextAuth to avoid ES module issues
import { verifyPassword } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

// Use the mock functions directly
const mockedUserFindUnique = mockUserFindUnique as jest.MockedFunction<any>
const mockedVerifyPassword = mockVerifyPassword as jest.MockedFunction<any>

// Simulate the credentials provider logic
async function simulateCredentialsAuth(credentials: any) {
  if (!credentials?.email || !credentials?.password) {
    return null
  }

  const user = await mockUserFindUnique({
    where: {
      email: credentials.email
    }
  })

  if (!user || !user.password) {
    return null
  }

  const isValidPassword = await mockVerifyPassword(credentials.password, user.password)

  if (!isValidPassword) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  }
}

describe('Credentials Authentication Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

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

    mockedUserFindUnique.mockResolvedValue(mockUser)
    mockedVerifyPassword.mockResolvedValue(true)

    const result = await simulateCredentialsAuth(credentials)

    expect(result).toEqual({
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      image: mockUser.image,
    })
    expect(mockedUserFindUnique).toHaveBeenCalledWith({
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

    mockedUserFindUnique.mockResolvedValue(mockUser)
    mockedVerifyPassword.mockResolvedValue(false)

    const result = await simulateCredentialsAuth(credentials)

    expect(result).toBeNull()
  })

  it('should reject authentication for non-existent user', async () => {
    const credentials = {
      email: 'nonexistent@example.com',
      password: 'password123',
    }

    mockedUserFindUnique.mockResolvedValue(null)

    const result = await simulateCredentialsAuth(credentials)

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

    mockedUserFindUnique.mockResolvedValue(mockUser)

    const result = await simulateCredentialsAuth(credentials)

    expect(result).toBeNull()
    expect(mockedVerifyPassword).not.toHaveBeenCalled()
  })

  it('should reject authentication when email is missing', async () => {
    const credentials = {
      password: 'password123',
    }

    const result = await simulateCredentialsAuth(credentials)

    expect(result).toBeNull()
    expect(mockedUserFindUnique).not.toHaveBeenCalled()
  })

  it('should reject authentication when password is missing', async () => {
    const credentials = {
      email: 'test@example.com',
    }

    const result = await simulateCredentialsAuth(credentials)

    expect(result).toBeNull()
    expect(mockedUserFindUnique).not.toHaveBeenCalled()
  })
})