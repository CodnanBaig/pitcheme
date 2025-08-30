// Mock functions need to be declared before the mock modules
const mockAuth = jest.fn()
const mockCanUserGenerate = jest.fn()
const mockIncrementUsage = jest.fn()
const mockPrismaDocumentCreate = jest.fn()
const mockAIServiceGenerateProposal = jest.fn()

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
    generateProposal: mockAIServiceGenerateProposal,
  },
}))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/generate/proposal/route'

describe('/api/generate/proposal', () => {
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
    mockAuth.mockResolvedValue(validSession)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGenerateProposal.mockResolvedValue(mockAIResponse)
    mockPrismaDocumentCreate.mockResolvedValue({
      id: 'prop_123_abc',
      userId: validSession.user.id,
      type: 'proposal',
      content: mockAIResponse.content
    })

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
    expect(result.metadata).toEqual({
      field: 'technology',
      model: mockAIResponse.model,
      tokensUsed: mockAIResponse.tokensUsed,
      generationTime: mockAIResponse.generationTime
    })

    expect(mockAuth).toHaveBeenCalled()
    expect(mockCanUserGenerate).toHaveBeenCalledWith(validSession.user.id, 'proposals')
    expect(mockAIServiceGenerateProposal).toHaveBeenCalledWith({
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
    })
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
    mockAuth.mockResolvedValue(validSession)
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
    mockAuth.mockResolvedValue(validSession)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGenerateProposal.mockResolvedValue({
      success: false,
      error: 'AI service timeout',
      content: '',
      model: '',
      tokensUsed: 0,
      generationTime: 0
    })

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

  it('should handle healthcare field-specific data correctly', async () => {
    const healthcareRequestData = {
      ...validRequestData,
      field: 'healthcare',
      fieldSpecificData: {
        complianceStandards: 'HIPAA, FDA 21 CFR Part 11',
        clinicalRequirements: 'EMR integration required',
        patientSafetyProtocols: 'Real-time monitoring'
      }
    }

    mockAuth.mockResolvedValue(validSession)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGenerateProposal.mockResolvedValue(mockAIResponse)
    mockPrismaDocumentCreate.mockResolvedValue({
      id: 'prop_123_abc',
      userId: validSession.user.id,
      type: 'proposal',
      content: mockAIResponse.content
    })

    const request = new NextRequest('http://localhost:3000/api/generate/proposal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(healthcareRequestData),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockAIServiceGenerateProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        field: 'healthcare',
        fieldSpecificData: expect.objectContaining({
          complianceStandards: 'HIPAA, FDA 21 CFR Part 11',
          clinicalRequirements: 'EMR integration required',
          patientSafetyProtocols: 'Real-time monitoring'
        })
      })
    )
  })

  it('should handle services as single string or array', async () => {
    const singleServiceData = {
      ...validRequestData,
      services: 'Development'
    }

    mockAuth.mockResolvedValue(validSession)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGenerateProposal.mockResolvedValue(mockAIResponse)
    mockPrismaDocumentCreate.mockResolvedValue({
      id: 'prop_123_abc',
      userId: validSession.user.id,
      type: 'proposal',
      content: mockAIResponse.content
    })

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

    mockAuth.mockResolvedValue(validSession)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGenerateProposal.mockResolvedValue(mockAIResponse)
    mockPrismaDocumentCreate.mockResolvedValue({
      id: 'prop_123_abc',
      userId: validSession.user.id,
      type: 'proposal',
      content: mockAIResponse.content
    })

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

  it('should handle database errors gracefully', async () => {
    mockAuth.mockResolvedValue(validSession)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGenerateProposal.mockResolvedValue(mockAIResponse)
    mockPrismaDocumentCreate.mockRejectedValue(new Error('Database connection failed'))

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
  })

  it('should store correct metadata in database', async () => {
    mockAuth.mockResolvedValue(validSession)
    mockCanUserGenerate.mockResolvedValue(true)
    mockAIServiceGenerateProposal.mockResolvedValue(mockAIResponse)
    mockPrismaDocumentCreate.mockResolvedValue({
      id: 'prop_123_abc',
      userId: validSession.user.id,
      type: 'proposal',
      content: mockAIResponse.content
    })

    const request = new NextRequest('http://localhost:3000/api/generate/proposal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validRequestData),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockPrismaDocumentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.stringMatching(/^prop_\d+_[a-z0-9]+$/),
        userId: validSession.user.id,
        type: 'proposal',
        clientName: 'John Doe',
        clientCompany: 'Tech Solutions Inc',
        projectTitle: 'Custom CRM Development',
        content: mockAIResponse.content,
        metadata: expect.stringContaining('"field":"technology"')
      })
    })
  })
})