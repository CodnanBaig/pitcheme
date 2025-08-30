import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'util'

// Polyfill for Node.js
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock Request and Response for Node.js
class MockRequest {
  constructor(url, options = {}) {
    this.url = url
    this.method = options.method || 'GET'
    this.headers = new Map(Object.entries(options.headers || {}))
    this._body = options.body
  }
  
  async json() {
    return JSON.parse(this._body)
  }
  
  async text() {
    return this._body
  }
}

class MockResponse {
  constructor(body, options = {}) {
    this.body = body
    this.status = options.status || 200
    this.headers = new Map(Object.entries(options.headers || {}))
  }
  
  async json() {
    return JSON.parse(this.body)
  }
  
  async text() {
    return this.body
  }
}

global.Request = MockRequest
global.Response = MockResponse
global.fetch = jest.fn()

// Mock environment variables for testing
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.DATABASE_URL = 'file:./test.db'
process.env.STRIPE_SECRET_KEY = 'sk_test_123456789'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
process.env.STRIPE_PRO_PRICE_ID = 'price_test_pro'
process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_test_enterprise'

// Mock Next.js modules
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/test',
}))

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      },
    },
    status: 'authenticated',
  }),
  SessionProvider: ({ children }) => children,
  signIn: jest.fn(),
  signOut: jest.fn(),
}))

// Mock Prisma
jest.mock('./lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  document: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  userSubscription: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  usage: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}))

// Global test setup
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})