import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'util'

// Polyfill for Node.js
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Node 18+ provides the Web Request/Response implementations that NextRequest
// and NextResponse expect. Do not replace them with partial test doubles.
global.fetch = jest.fn()

// Mock environment variables for testing
process.env.NEXTAUTH_SECRET = 'test-secret-for-local-verification-only-32-chars'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.DATABASE_URL = 'mongodb://127.0.0.1:27017/pitchgenie-test?replicaSet=rs0'
process.env.OPENROUTER_API_KEY = 'test-openrouter-key'
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
  notFound: jest.fn(),
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
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    document: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    documentVersion: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    userSubscription: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    usage: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    $runCommandRaw: jest.fn(),
  },
}))

// Global test setup
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Component tests that opt into jsdom still get a stable matchMedia mock.
if (typeof window !== 'undefined') {
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
}
