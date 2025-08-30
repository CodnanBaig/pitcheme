// Mock dependencies
jest.mock('@/auth')
jest.mock('@/lib/prisma')
jest.mock('puppeteer')

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/export/pitch-deck/[id]/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import puppeteer from 'puppeteer'

// Type cast the mocks
const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockPrismaDocumentFindFirst = prisma.document.findFirst as jest.MockedFunction<typeof prisma.document.findFirst>
const mockPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>

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
    id: 'deck_123_abc',
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
    mockPuppeteer.launch.mockResolvedValue(mockBrowser as any)
    mockBrowser.newPage.mockResolvedValue(mockPage as any)
    mockPage.pdf.mockResolvedValue(Buffer.from('mock-pdf-content'))
  })

  it('should successfully export pitch deck as PDF', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(mockPitchDeck as any)

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/deck_123_abc', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: 'deck_123_abc' }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toContain('TechCorp_pitch_deck.pdf')

    expect(mockAuth).toHaveBeenCalled()
    expect(mockPrismaDocumentFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'deck_123_abc',
        userId: 'user-123',
        type: 'pitch-deck'
      }
    })
    expect(mockPuppeteer.launch).toHaveBeenCalledWith({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    expect(mockPage.setContent).toHaveBeenCalled()
    expect(mockPage.pdf).toHaveBeenCalledWith({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      }
    })
    expect(mockBrowser.close).toHaveBeenCalled()
  })

  it('should return 401 if user is not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/deck_123_abc', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: 'deck_123_abc' }) })
    const result = await response.json()

    expect(response.status).toBe(401)
    expect(result.error).toBe('Unauthorized')
    expect(mockPrismaDocumentFindFirst).not.toHaveBeenCalled()
    expect(mockPuppeteer.launch).not.toHaveBeenCalled()
  })

  it('should return 404 if pitch deck not found', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/nonexistent', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) })
    const result = await response.json()

    expect(response.status).toBe(404)
    expect(result.error).toBe('Pitch deck not found')
    expect(mockPuppeteer.launch).not.toHaveBeenCalled()
  })

  it('should return 404 if user tries to access another users pitch deck', async () => {
    const otherUsersPitchDeck = {
      ...mockPitchDeck,
      userId: 'other-user-456'
    }

    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(null) // Prisma returns null due to userId mismatch

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/deck_123_abc', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: 'deck_123_abc' }) })
    const result = await response.json()

    expect(response.status).toBe(404)
    expect(result.error).toBe('Pitch deck not found')
    expect(mockPrismaDocumentFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'deck_123_abc',
        userId: 'user-123',
        type: 'pitch-deck'
      }
    })
  })

  it('should handle puppeteer errors gracefully', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(mockPitchDeck as any)
    mockPuppeteer.launch.mockRejectedValue(new Error('Puppeteer launch failed'))

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/deck_123_abc', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: 'deck_123_abc' }) })
    const result = await response.json()

    expect(response.status).toBe(500)
    expect(result.error).toBe('Failed to export pitch deck')
  })

  it('should handle PDF generation errors gracefully', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(mockPitchDeck as any)
    mockPage.pdf.mockRejectedValue(new Error('PDF generation failed'))

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/deck_123_abc', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: 'deck_123_abc' }) })
    const result = await response.json()

    expect(response.status).toBe(500)
    expect(result.error).toBe('Failed to export pitch deck')
    expect(mockBrowser.close).toHaveBeenCalled() // Ensure cleanup happens
  })

  it('should properly format HTML content for PDF', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(mockPitchDeck as any)

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/deck_123_abc', {
      method: 'GET'
    })

    await GET(request, { params: Promise.resolve({ id: 'deck_123_abc' }) })

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
  })

  it('should generate safe filename from startup name', async () => {
    const pitchDeckWithSpecialChars = {
      ...mockPitchDeck,
      clientName: 'Tech & AI Corp!!! @#$%'
    }

    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockResolvedValue(pitchDeckWithSpecialChars as any)

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/deck_123_abc', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: 'deck_123_abc' }) })

    expect(response.headers.get('Content-Disposition')).toContain('Tech___AI_Corp____pitch_deck.pdf')
  })

  it('should handle database errors gracefully', async () => {
    mockAuth.mockResolvedValue(validSession as any)
    mockPrismaDocumentFindFirst.mockRejectedValue(new Error('Database connection failed'))

    const request = new NextRequest('http://localhost:3000/api/export/pitch-deck/deck_123_abc', {
      method: 'GET'
    })

    const response = await GET(request, { params: Promise.resolve({ id: 'deck_123_abc' }) })
    const result = await response.json()

    expect(response.status).toBe(500)
    expect(result.error).toBe('Failed to export pitch deck')
  })
})