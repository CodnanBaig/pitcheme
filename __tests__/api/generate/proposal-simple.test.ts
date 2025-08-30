// Simple mock approach to avoid hoisting issues
jest.mock('@/auth')
jest.mock('@/lib/subscription')
jest.mock('@/lib/prisma')
jest.mock('@/lib/ai-service')

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/generate/proposal/route'
import { auth } from '@/auth'
import { canUserGenerate, incrementUsage } from '@/lib/subscription'
import { prisma } from '@/lib/prisma'
import { aiService } from '@/lib/ai-service'

// Type cast the mocks
const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockCanUserGenerate = canUserGenerate as jest.MockedFunction<typeof canUserGenerate>
const mockIncrementUsage = incrementUsage as jest.MockedFunction<typeof incrementUsage>
const mockPrismaDocumentCreate = prisma.document.create as jest.MockedFunction<typeof prisma.document.create>
const mockAIServiceGenerateProposal = aiService.generateProposal as jest.MockedFunction<typeof aiService.generateProposal>

describe('/api/generate/proposal - Simple Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const validRequestData = {
    field: 'technology',
    clientName: 'John Doe',
    clientCompany: 'Tech Solutions Inc',
    projectTitle: 'Custom CRM Development',
    projectDescription: 'Build a custom CRM system for managing customer relationships',
    goals: 'Improve customer retention and sales efficiency',
    budget: '$50,000',
    timeline: '3 months',
    services: ['Development', 'Testing', 'Deployment'],
    fieldSpecificData: {
      technologies: 'React, Node.js, MongoDB',
      integrations: 'Salesforce, Slack'
    },
    modelPreference: 'primary'
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
    content: '# Business Proposal\n\n## Executive Summary\n\nDetailed proposal content...',
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    tokensUsed: 2000,
    generationTime: 3000
  }

  it('should successfully generate a proposal', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGenerateProposal.mockResolvedValue(mockAIResponse as any)
    mockPrismaDocumentCreate.mockResolvedValue({
      id: 'prop_123_abc',
      userId: validSession.user.id,
      type: 'proposal',
      content: mockAIResponse.content
    } as any)

    const request = new NextRequest('http://localhost:3000/api/generate/proposal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validRequestData),
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.message).toBe('Proposal generated successfully')
    expect(result.id).toMatch(/^prop_\d+_[a-z0-9]+$/)
    expect(result.metadata.field).toBe('technology')
    expect(result.metadata.model).toBe(mockAIResponse.model)

    expect(mockAuth).toHaveBeenCalled()
    expect(mockCanUserGenerate).toHaveBeenCalledWith(validSession.user.id, 'proposals')
    expect(mockAIServiceGenerateProposal).toHaveBeenCalled()
    expect(mockPrismaDocumentCreate).toHaveBeenCalled()
    expect(mockIncrementUsage).toHaveBeenCalledWith(validSession.user.id, 'proposals')
  })

  it('should return 401 if user is not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/generate/proposal', {
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

    const request = new NextRequest('http://localhost:3000/api/generate/proposal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validRequestData),
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(403)
    expect(result.error).toBe('Usage limit reached. Please upgrade your plan to generate more proposals.')
    expect(mockAIServiceGenerateProposal).not.toHaveBeenCalled()
  })

  it('should handle AI service failure gracefully', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGenerateProposal.mockResolvedValue({
      success: false,
      error: 'AI service timeout',
      content: '',
      model: '',
      tokensUsed: 0,
      generationTime: 0
    } as any)

    const request = new NextRequest('http://localhost:3000/api/generate/proposal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validRequestData),
    })

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(500)
    expect(result.error).toBe('Failed to generate proposal')
    expect(mockPrismaDocumentCreate).not.toHaveBeenCalled()
    expect(mockIncrementUsage).not.toHaveBeenCalled()
  })

  it('should handle services as single string or array', async () => {
    const singleServiceData = {
      ...validRequestData,
      services: 'Development'
    }

    mockAuth.mockResolvedValue(validSession as any)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGenerateProposal.mockResolvedValue(mockAIResponse as any)
    mockPrismaDocumentCreate.mockResolvedValue({
      id: 'prop_123_abc',
      userId: validSession.user.id,
      type: 'proposal',
      content: mockAIResponse.content
    } as any)

    const request = new NextRequest('http://localhost:3000/api/generate/proposal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(singleServiceData),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockAIServiceGenerateProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        services: ['Development']
      })
    )
  })

  it('should use default values for missing optional fields', async () => {
    const minimalRequestData = {
      clientName: 'Jane Smith',
      projectDescription: 'Basic project description',
      goals: 'Project goals'
    }

    mockAuth.mockResolvedValue(validSession as any)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGenerateProposal.mockResolvedValue(mockAIResponse as any)
    mockPrismaDocumentCreate.mockResolvedValue({
      id: 'prop_123_abc',
      userId: validSession.user.id,
      type: 'proposal',
      content: mockAIResponse.content
    } as any)

    const request = new NextRequest('http://localhost:3000/api/generate/proposal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(minimalRequestData),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockAIServiceGenerateProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        field: 'technology', // default value
        projectTitle: 'Custom Project', // default value
        timeline: 'To be determined', // default value
        services: [], // filtered empty array
        fieldSpecificData: {} // default empty object
      })
    )
  })
})