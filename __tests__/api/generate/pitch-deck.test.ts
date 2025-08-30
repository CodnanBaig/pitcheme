// Mock functions need to be declared before the mock modules
const mockAuth = jest.fn()
const mockCanUserGenerate = jest.fn()
const mockIncrementUsage = jest.fn()
const mockPrismaDocumentCreate = jest.fn()
const mockAIServiceGeneratePitchDeck = jest.fn()

// Mock dependencies
jest.mock('@/auth', () => ({
  auth: mockAuth,
}))

jest.mock('@/lib/subscription', () => ({
  canUserGenerate: mockCanUserGenerate,
  incrementUsage: mockIncrementUsage,
}))

jest.mock('@/lib/prisma', () => ({
  document: {
    create: mockPrismaDocumentCreate,
  },
}))

jest.mock('@/lib/ai-service', () => ({
  aiService: {
    generatePitchDeck: mockAIServiceGeneratePitchDeck,
  },
}))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/generate/pitch-deck/route'

describe('/api/generate/pitch-deck', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    tokensUsed: 1500,
    generationTime: 2500
  }

  it('should successfully generate a pitch deck', async () => {
    mockAuth.mockResolvedValue(validSession)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGeneratePitchDeck.mockResolvedValue(mockAIResponse)
    mockPrismaDocumentCreate.mockResolvedValue({
      id: 'deck_123_abc',
      userId: validSession.user.id,
      type: 'pitch-deck',
      content: mockAIResponse.content
    })

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
    expect(result.id).toMatch(/^deck_\d+_[a-z0-9]+$/)
    expect(result.metadata).toEqual({
      field: 'technology',
      model: mockAIResponse.model,
      tokensUsed: mockAIResponse.tokensUsed,
      generationTime: mockAIResponse.generationTime
    })

    expect(mockAuth).toHaveBeenCalled()
    expect(mockCanUserGenerate).toHaveBeenCalledWith(validSession.user.id, 'pitchDecks')
    expect(mockAIServiceGeneratePitchDeck).toHaveBeenCalledWith({
      field: 'technology',
      startupName: 'TechCorp',
      tagline: 'Revolutionizing the future',
      problem: 'Existing solutions are inefficient',
      solution: 'Our AI-powered platform',
      market: 'Global tech market worth $1T',
      businessModel: 'SaaS subscription',
      team: 'Experienced founders',
      funding: '$1M seed round',
      fieldSpecificData: {
        techStack: 'React, Node.js',
        scalability: 'Cloud-native architecture',
        traction: 'Growing user base',
        competition: 'Limited direct competitors',
        useOfFunds: 'Product development and marketing',
        industry: 'Technology'
      },
      modelPreference: 'primary',
      visualMode: false
    })
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
    mockAuth.mockResolvedValue(validSession)
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
    mockAuth.mockResolvedValue(validSession)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGeneratePitchDeck.mockResolvedValue({
      success: false,
      error: 'AI service unavailable',
      content: '',
      model: '',
      tokensUsed: 0,
      generationTime: 0
    })

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

    mockAuth.mockResolvedValue(validSession)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGeneratePitchDeck.mockResolvedValue({
      ...mockAIResponse,
      model: 'google/gemini-2.5-flash-image-preview:free'
    })
    mockPrismaDocumentCreate.mockResolvedValue({
      id: 'deck_123_abc',
      userId: validSession.user.id,
      type: 'pitch-deck',
      content: mockAIResponse.content
    })

    const request = new NextRequest('http://localhost:3000/api/generate/pitch-deck', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(visualRequestData),
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(mockAIServiceGeneratePitchDeck).toHaveBeenCalledWith(
      expect.objectContaining({
        modelPreference: 'visual',
        visualMode: true
      })
    )
  })

  it('should handle field-specific data correctly', async () => {
    const healthcareRequestData = {
      ...validRequestData,
      field: 'healthcare',
      fieldSpecificData: {
        regulatoryCompliance: 'FDA approved',
        clinicalTrials: 'Phase II completed',
        medicalDeviceClass: 'Class II'
      }
    }

    mockAuth.mockResolvedValue(validSession)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGeneratePitchDeck.mockResolvedValue(mockAIResponse)
    mockPrismaDocumentCreate.mockResolvedValue({
      id: 'deck_123_abc',
      userId: validSession.user.id,
      type: 'pitch-deck',
      content: mockAIResponse.content
    })

    const request = new NextRequest('http://localhost:3000/api/generate/pitch-deck', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(healthcareRequestData),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockAIServiceGeneratePitchDeck).toHaveBeenCalledWith(
      expect.objectContaining({
        field: 'healthcare',
        fieldSpecificData: expect.objectContaining({
          regulatoryCompliance: 'FDA approved',
          clinicalTrials: 'Phase II completed',
          medicalDeviceClass: 'Class II'
        })
      })
    )
  })

  it('should handle database errors gracefully', async () => {
    mockAuth.mockResolvedValue(validSession)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGeneratePitchDeck.mockResolvedValue(mockAIResponse)
    mockPrismaDocumentCreate.mockRejectedValue(new Error('Database connection failed'))

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
  })

  it('should use default values for missing optional fields', async () => {
    const minimalRequestData = {
      startupName: 'MinimalCorp',
      problem: 'Problem statement',
      solution: 'Solution statement',
      market: 'Market analysis'
    }

    mockAuth.mockResolvedValue(validSession)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGeneratePitchDeck.mockResolvedValue(mockAIResponse)
    mockPrismaDocumentCreate.mockResolvedValue({
      id: 'deck_123_abc',
      userId: validSession.user.id,
      type: 'pitch-deck',
      content: mockAIResponse.content
    })

    const request = new NextRequest('http://localhost:3000/api/generate/pitch-deck', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(minimalRequestData),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockAIServiceGeneratePitchDeck).toHaveBeenCalledWith(
      expect.objectContaining({
        field: 'technology', // default value
        fieldSpecificData: expect.any(Object),
        visualMode: false, // default value
        modelPreference: undefined
      })
    )
  })
})