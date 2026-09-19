// Mock dependencies
jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { document: { findFirst: jest.fn() } } }))
jest.mock('playwright-core')

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/export/pitch-deck/[id]/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { chromium } from 'playwright-core'

// Type cast the mocks
const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockPrismaDocumentFindFirst = prisma.document.findFirst as jest.MockedFunction<typeof prisma.document.findFirst>
const mockChromium = chromium as jest.Mocked<typeof chromium>

describe('/api/export/pitch-deck/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const validSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User'
    }
  }

  const mockPitchDeck = {
    id: '507f1f77bcf86cd799439012',
    userId: 'user-123',
    type: 'pitch-deck',
    clientName: 'TechCorp',
    projectTitle: 'Revolutionary Platform',
    content: `## Slide 1: Problem
**The Problem**
• Existing solutions are inefficient
• Market needs innovation

## Slide 2: Solution
**Our Solution**
• AI-powered platform
• Streamlined workflow`,
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
    clientCompany: null,
    metadata: null
  }

  const mockBrowser = {
    newPage: jest.fn(),
    close: jest.fn()
  }

  const mockPage = {
    setContent: jest.fn(),
    pdf: jest.fn()
  }

  beforeEach(() => {
    mockChromium.launch.mockResolvedValue(mockBrowser as any)
    mockBrowser.newPage.mockResolvedValue(mockPage as any)
    mockPage.pdf.mockResolvedValue(Buffer.from('mock-pdf-content'))
  })

  it('should successfully export pitch deck as PDF', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(mockPitchDeck as any)

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/507f1f77bcf86cd799439012', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439012' }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toContain('TechCorp_pitch_deck.pdf')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Request-ID')).toEqual(expect.any(String))

    expect(mockAuth).toHaveBeenCalled()
    expect(mockPrismaDocumentFindFirst).toHaveBeenCalledWith({
      where: {
        id: '507f1f77bcf86cd799439012',
        userId: 'user-123',
        type: 'pitch-deck'
      }
    })
    expect(mockChromium.launch).toHaveBeenCalledWith({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 10_000,
    })
    expect(mockPage.setContent).toHaveBeenCalled()
    expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
      format: 'A4',
      landscape: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: expect.stringContaining('pageNumber'),
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      }
    }))
    expect(mockBrowser.close).toHaveBeenCalled()
  })

  it('returns a bounded cancellation response before launching Chromium', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(mockPitchDeck as any)
    const controller = new AbortController()
    controller.abort()

    const response = await GET(
      new NextRequest('http://localhost:3000/api/export/pitch-deck/507f1f77bcf86cd799439012', {
        method: 'GET',
        signal: controller.signal,
      }),
      { params: Promise.resolve({ id: '507f1f77bcf86cd799439012' }) },
    )

    expect(response.status).toBe(499)
    expect((await response.json()).error).toBe('Export request cancelled')
    expect(mockChromium.launch).not.toHaveBeenCalled()
  })

  it('rejects unsupported formats before querying Prisma or launching Chromium', async () => {
    mockAuth.mockResolvedValue(validSession as any)

    const response = await GET(
      new NextRequest('http://localhost:3000/api/export/pitch-deck/507f1f77bcf86cd799439012?format=docx'),
      { params: Promise.resolve({ id: '507f1f77bcf86cd799439012' }) },
    )

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('Invalid format')
    expect(mockPrismaDocumentFindFirst).not.toHaveBeenCalled()
    expect(mockChromium.launch).not.toHaveBeenCalled()
  })

  it('should return 401 if user is not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/507f1f77bcf86cd799439012', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439012' }) })
    const result = await response.json()

    expect(response.status).toBe(401)
    expect(result.error).toBe('Unauthorized')
    expect(mockPrismaDocumentFindFirst).not.toHaveBeenCalled()
    expect(mockChromium.launch).not.toHaveBeenCalled()
  })

  it('should return 404 if pitch deck not found', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/507f1f77bcf86cd799439099', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) })
    const result = await response.json()

    expect(response.status).toBe(404)
    expect(result.error).toBe('Pitch deck not found')
    expect(mockChromium.launch).not.toHaveBeenCalled()
  })

  it('should reject a malformed pitch deck ID before querying Prisma', async () => {
    mockAuth.mockResolvedValue(validSession as any)

    const response = await GET(
      new NextRequest('http://localhost:3000/api/export/pitch-deck/not-an-object-id'),
      { params: Promise.resolve({ id: 'not-an-object-id' }) },
    )
    const result = await response.json()

    expect(response.status).toBe(400)
    expect(result.error).toBe('Invalid pitch deck ID')
    expect(mockPrismaDocumentFindFirst).not.toHaveBeenCalled()
  })

  it('should return 404 if user tries to access another users pitch deck', async () => {
    const otherUsersPitchDeck = {
      ...mockPitchDeck,
      userId: 'other-user-456'
    }

    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(null) // Prisma returns null due to userId mismatch

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/507f1f77bcf86cd799439012', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439012' }) })
    const result = await response.json()

    expect(response.status).toBe(404)
    expect(result.error).toBe('Pitch deck not found')
    expect(mockPrismaDocumentFindFirst).toHaveBeenCalledWith({
      where: {
        id: '507f1f77bcf86cd799439012',
        userId: 'user-123',
        type: 'pitch-deck'
      }
    })
  })

  it('should handle browser launch errors gracefully', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(mockPitchDeck as any)
    mockChromium.launch.mockRejectedValue(new Error('Browser launch failed'))

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/507f1f77bcf86cd799439012', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439012' }) })
    const result = await response.json()

    expect(response.status).toBe(500)
    expect(result.error).toBe('Failed to export pitch deck')
  })

  it('should handle PDF generation errors gracefully', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(mockPitchDeck as any)
    mockPage.pdf.mockRejectedValue(new Error('PDF generation failed'))

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/507f1f77bcf86cd799439012', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439012' }) })
    const result = await response.json()

    expect(response.status).toBe(500)
    expect(result.error).toBe('Failed to export pitch deck')
    expect(mockBrowser.close).toHaveBeenCalled() // Ensure cleanup happens
  })

  it('should properly format HTML content for PDF', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(mockPitchDeck as any)

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/507f1f77bcf86cd799439012', {
      method: 'GET'
    })

    await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439012' }) })

    expect(mockPage.setContent).toHaveBeenCalled()
    const htmlContent = mockPage.setContent.mock.calls[0][0]
    
    // Verify HTML structure
    expect(htmlContent).toContain('<!DOCTYPE html>')
    expect(htmlContent).toContain('<title>TechCorp Pitch Deck</title>')
    expect(htmlContent).toContain('title-slide')
    expect(htmlContent).toContain('TechCorp')
    expect(htmlContent).toContain('Revolutionary Platform')
    expect(htmlContent).toContain('The Problem')
    expect(htmlContent).toContain('Our Solution')
    expect(htmlContent).toContain('pitch-deck-slides')
    expect(htmlContent).toContain('#0D1B2A')
    expect(htmlContent).toContain('#18A6A6')
  })

  it('should generate safe filename from startup name', async () => {
    const pitchDeckWithSpecialChars = {
      ...mockPitchDeck,
      clientName: 'Tech & AI Corp!!! @#$%'
    }

    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(pitchDeckWithSpecialChars as any)

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/507f1f77bcf86cd799439012', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439012' }) })

    expect(response.headers.get('Content-Disposition')).toContain('Tech_AI_Corp_pitch_deck.pdf')
  })

  it('should handle database errors gracefully', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockRejectedValue(new Error('Database connection failed'))

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/507f1f77bcf86cd799439012', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439012' }) })
    const result = await response.json()

    expect(response.status).toBe(500)
    expect(result.error).toBe('Failed to export pitch deck')
  })
})
