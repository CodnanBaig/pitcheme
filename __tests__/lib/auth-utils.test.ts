import { hashPassword, verifyPassword } from '@/lib/auth-utils'
import bcrypt from 'bcryptjs'

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>

describe('Auth Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('hashPassword', () => {
    it('should hash password with correct salt rounds', async () => {
      const password = 'testPassword123'
      const hashedPassword = 'hashedPassword123'

      mockedBcrypt.hash.mockResolvedValue(hashedPassword)

      const result = await hashPassword(password)

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 12)
      expect(result).toBe(hashedPassword)
    })

    it('should handle bcrypt hash errors', async () => {
      const password = 'testPassword123'
      const error = new Error('Hashing failed')

      mockedBcrypt.hash.mockRejectedValue(error)

      await expect(hashPassword(password)).rejects.toThrow('Hashing failed')
    })
  })

  describe('verifyPassword', () => {
    it('should return true for valid password', async () => {
      const password = 'testPassword123'
      const hashedPassword = 'hashedPassword123'

      mockedBcrypt.compare.mockResolvedValue(true)

      const result = await verifyPassword(password, hashedPassword)

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword)
      expect(result).toBe(true)
    })

    it('should return false for invalid password', async () => {
      const password = 'wrongPassword'
      const hashedPassword = 'hashedPassword123'

      mockedBcrypt.compare.mockResolvedValue(false)

      const result = await verifyPassword(password, hashedPassword)

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword)
      expect(result).toBe(false)
    })

    it('should handle bcrypt compare errors', async () => {
      const password = 'testPassword123'
      const hashedPassword = 'hashedPassword123'
      const error = new Error('Comparison failed')

      mockedBcrypt.compare.mockRejectedValue(error)

      await expect(verifyPassword(password, hashedPassword)).rejects.toThrow('Comparison failed')
    })
  })

  describe('Integration Tests', () => {
    it('should hash and verify password correctly (with real bcrypt)', async () => {
      // Temporarily unmock bcrypt for integration test
      jest.unmock('bcryptjs')
      const realBcrypt = require('bcryptjs')
      
      const password = 'testPassword123'
      const hashedPassword = await realBcrypt.hash(password, 12)
      
      expect(typeof hashedPassword).toBe('string')
      expect(hashedPassword).not.toBe(password)
      
      const isValid = await realBcrypt.compare(password, hashedPassword)
      expect(isValid).toBe(true)
      
      const isInvalid = await realBcrypt.compare('wrongPassword', hashedPassword)
      expect(isInvalid).toBe(false)
    })
  })
})