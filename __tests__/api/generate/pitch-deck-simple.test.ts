// Keep API tests independent from the real database and model providers.
jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/subscription', () => ({ canUserGenerate: jest.fn(), incrementUsage: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    document: { create: jest.fn() },
    documentVersion: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/ai-service', () => ({ aiService: { generatePitchDeck: jest.fn() } }))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/generate/pitch-deck/route'
import { auth } from '@/auth'
import { canUserGenerate, incrementUsage } from '@/lib/subscription'
import { prisma } from '@/lib/prisma'
import { aiService } from '@/lib/ai-service'

// Type cast the mocks
const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockCanUserGenerate = canUserGenerate as jest.MockedFunction<typeof canUserGenerate>
const mockIncrementUsage = incrementUsage as jest.MockedFunction<typeof incrementUsage>
const mockPrismaDocumentCreate = prisma.document.create as jest.MockedFunction<typeof prisma.document.create>
const mockPrismaDocumentVersionCreate = prisma.documentVersion.create as jest.MockedFunction<typeof prisma.documentVersion.create>
const mockPrismaTransaction = prisma.$transaction as unknown as jest.Mock
const mockAIServiceGeneratePitchDeck = aiService.generatePitchDeck as jest.MockedFunction<typeof aiService.generatePitchDeck>

describe('/api/generate/pitch-deck - Simple Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrismaTransaction.mockImplementation(async (callback: (transaction: typeof prisma) => unknown) => callback(prisma))
    mockPrismaDocumentVersionCreate.mockResolvedValue({} as never)
  })

  const validRequestData = {
    field: 'technology',
    startupName: 'TechCorp',
    tagline: 'Revolutionizing the future',
    problem: 'Existing solutions are inefficient',
    solution: 'Our AI-powered platform',
    market: 'Global tech market worth $1T',
    businessModel: 'SaaS subscription',
    traction: 'Growing user base',
    team: 'Experienced founders',
    competition: 'Limited direct competitors',
    fundingAsk: '$1M seed round',
    useOfFunds: 'Product development and marketing',
    industry: 'Technology',
    fieldSpecificData: {
      techStack: 'React, Node.js',
      scalability: 'Cloud-native architecture'
    },
    modelPreference: 'primary',
    visualMode: false
  }

  const validSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User'
    }
  }

  const mockAIResponse = {
    success: true,
    content: '# Pitch Deck\n\n## Slide 1: Problem\n\nDetailed pitch deck content...',
    model: 'qwen/qwen3.8-27b:free',
    tokensUsed: 1500,
    generationTime: 2500
  }

  it('should successfully generate a pitch deck', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGeneratePitchDeck.mockResolvedValue(mockAIResponse as any)
    mockPrismaDocumentCreate.mockResolvedValue({
      id: '507f1f77bcf86cd799439012',
      userId: validSession.user.id,
      type: 'pitch-deck',
      content: mockAIResponse.content
    } as any)

    const request = new NextRequest('http://localhost:3000/api/generate/pitch-deck', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validRequestData),
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.message).toBe('Pitch deck generated successfully')
    expect(result.id).toBe('507f1f77bcf86cd799439012')
    expect(result.metadata.field).toBe('technology')
    expect(result.metadata.model).toBe(mockAIResponse.model)

    expect(mockAuth).toHaveBeenCalled()
    expect(mockCanUserGenerate).toHaveBeenCalledWith(validSession.user.id, 'pitchDecks')
    expect(mockAIServiceGeneratePitchDeck).toHaveBeenCalled()
    expect(mockPrismaDocumentCreate).toHaveBeenCalled()
    expect(mockIncrementUsage).toHaveBeenCalledWith(validSession.user.id, 'pitchDecks')
  })

  it('should return 401 if user is not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/generate/pitch-deck', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validRequestData),
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(401)
    expect(result.error).toBe('Unauthorized')
    expect(mockCanUserGenerate).not.toHaveBeenCalled()
  })

  it('should return 403 if user has reached usage limit', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockCanUserGenerate.mockResolvedValue(false)

    const request = new NextRequest('http://localhost:3000/api/generate/pitch-deck', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validRequestData),
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(403)
    expect(result.error).toBe('Usage limit reached. Please upgrade your plan to generate more pitch decks.')
    expect(mockAIServiceGeneratePitchDeck).not.toHaveBeenCalled()
  })

  it('should handle AI service failure gracefully', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGeneratePitchDeck.mockResolvedValue({
      success: false,
      error: 'AI service unavailable',
      content: '',
      model: '',
      tokensUsed: 0,
      generationTime: 0
    } as any)

    const request = new NextRequest('http://localhost:3000/api/generate/pitch-deck', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validRequestData),
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(500)
    expect(result.error).toBe('Failed to generate pitch deck')
    expect(mockPrismaDocumentCreate).not.toHaveBeenCalled()
    expect(mockIncrementUsage).not.toHaveBeenCalled()
  })

  it('should handle visual mode correctly', async () => {
    const visualRequestData = {
      ...validRequestData,
      visualMode: true
    }

    mockAuth.mockResolvedValue(validSession as any)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGeneratePitchDeck.mockResolvedValue({
      ...mockAIResponse,
      model: 'google/gemini-2.5-flash-image-preview:free'
    } as any)
    mockPrismaDocumentCreate.mockResolvedValue({
      id: '507f1f77bcf86cd799439012',
      userId: validSession.user.id,
      type: 'pitch-deck',
      content: mockAIResponse.content
    } as any)

    const request = new NextRequest('http://localhost:3000/api/generate/pitch-deck', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(visualRequestData),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockAIServiceGeneratePitchDeck).toHaveBeenCalledWith(
      expect.objectContaining({
        modelPreference: 'visual',
        visualMode: true
      })
    )
  })
})
