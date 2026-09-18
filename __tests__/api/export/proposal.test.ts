// Mock dependencies
jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { document: { findFirst: jest.fn() } } }))
jest.mock('playwright-core')
jest.mock('docx')

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/export/proposal/[id]/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { chromium } from 'playwright-core'
import { Document, Packer } from 'docx'

// Type cast the mocks
const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockPrismaDocumentFindFirst = prisma.document.findFirst as jest.MockedFunction<typeof prisma.document.findFirst>
const mockChromium = chromium as jest.Mocked<typeof chromium>
const mockDocument = Document as jest.MockedClass<typeof Document>
const mockPacker = Packer as jest.Mocked<typeof Packer>

describe('/api/export/proposal/[id]', () => {
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

  const mockProposal = {
    id: '507f1f77bcf86cd799439011',
    userId: 'user-123',
    type: 'proposal',
    clientName: 'John Doe',
    clientCompany: 'Tech Solutions Inc',
    projectTitle: 'Custom CRM Development',
    content: `# Business Proposal

## Executive Summary
This proposal outlines our approach to developing a custom CRM system.

## Technical Approach
**Technology Stack:**
- React for frontend
- Node.js for backend

## Timeline
**Phase 1:** Requirements gathering
**Phase 2:** Development

## Budget
Total project cost: $50,000`,
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
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
    mockPacker.toBuffer.mockResolvedValue(Buffer.from('mock-docx-content'))
  })

  describe('PDF Export', () => {
    it('should successfully export proposal as PDF', async () => {
      mockAuth.mockResolvedValue(validSession as any)
      mockPrismaDocumentFindFirst.mockResolvedValue(mockProposal as any)

      const request = new NextRequest('http://localhost:3000/api/export/proposal/507f1f77bcf86cd799439011', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/pdf')
      expect(response.headers.get('Content-Disposition')).toContain('Custom_CRM_Development.pdf')
      expect(response.headers.get('X-Request-ID')).toEqual(expect.any(String))

      expect(mockAuth).toHaveBeenCalled()
      expect(mockPrismaDocumentFindFirst).toHaveBeenCalledWith({
        where: {
          id: '507f1f77bcf86cd799439011',
          userId: 'user-123',
          type: 'proposal'
        }
      })
      expect(mockChromium.launch).toHaveBeenCalled()
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: expect.stringContaining('pageNumber'),
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      }))
      expect(mockBrowser.close).toHaveBeenCalled()
    })

    it('should export as PDF by default when no format specified', async () => {
      mockAuth.mockResolvedValue(validSession as any)
      mockPrismaDocumentFindFirst.mockResolvedValue(mockProposal as any)

      const request = new NextRequest('http://localhost:3000/api/export/proposal/507f1f77bcf86cd799439011', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/pdf')
      expect(mockChromium.launch).toHaveBeenCalled()
    })

    it('should properly format HTML content for PDF', async () => {
      mockAuth.mockResolvedValue(validSession as any)
      mockPrismaDocumentFindFirst.mockResolvedValue(mockProposal as any)

      const request = new NextRequest('http://localhost:3000/api/export/proposal/507f1f77bcf86cd799439011', {
        method: 'GET'
      })

      await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) })

      expect(mockPage.setContent).toHaveBeenCalled()
      const htmlContent = mockPage.setContent.mock.calls[0][0]
      
      // Verify HTML structure
      expect(htmlContent).toContain('<!DOCTYPE html>')
      expect(htmlContent).toContain('<title>Custom CRM Development</title>')
      expect(htmlContent).toContain('<h1>Business Proposal</h1>')
      expect(htmlContent).toContain('<h2>Executive Summary</h2>')
      expect(htmlContent).toContain('<h2>Technical Approach</h2>')
      expect(htmlContent).toContain('#0e7373')
      expect(htmlContent).toContain('cover-page')
    })
  })

  describe('DOCX Export', () => {
    it('should successfully export proposal as DOCX', async () => {
      mockAuth.mockResolvedValue(validSession as any)
      mockPrismaDocumentFindFirst.mockResolvedValue(mockProposal as any)

      const request = new NextRequest('http://localhost:3000/api/export/proposal/507f1f77bcf86cd799439011?format=docx', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      expect(response.headers.get('Content-Disposition')).toContain('Custom_CRM_Development.docx')

      expect(mockDocument).toHaveBeenCalled()
      expect(mockPacker.toBuffer).toHaveBeenCalled()
      expect(mockChromium.launch).not.toHaveBeenCalled() // DOCX does not require a browser
    })

    it('should create proper DOCX document structure', async () => {
      mockAuth.mockResolvedValue(validSession as any)
      mockPrismaDocumentFindFirst.mockResolvedValue(mockProposal as any)

      const request = new NextRequest('http://localhost:3000/api/export/proposal/507f1f77bcf86cd799439011?format=docx', {
        method: 'GET'
      })

      await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) })

      expect(mockDocument).toHaveBeenCalledWith(expect.objectContaining({
        creator: 'PitchGenie',
        title: 'Custom CRM Development',
        sections: expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({
              page: expect.objectContaining({
                margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
              }),
            }),
            footers: expect.objectContaining({ default: expect.anything() }),
            children: expect.any(Array)
          })
        ])
      }))
    })
  })

  describe('Common Export Functionality', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/export/proposal/507f1f77bcf86cd799439011', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) })
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toBe('Unauthorized')
      expect(mockPrismaDocumentFindFirst).not.toHaveBeenCalled()
    })

    it('should return 404 if proposal not found', async () => {
      mockAuth.mockResolvedValue(validSession as any)
      mockPrismaDocumentFindFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/export/proposal/507f1f77bcf86cd799439099', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) })
      const result = await response.json()

      expect(response.status).toBe(404)
      expect(result.error).toBe('Proposal not found')
    })

    it('should reject a malformed proposal ID before querying Prisma', async () => {
      mockAuth.mockResolvedValue(validSession as any)

      const response = await GET(
        new NextRequest('http://localhost:3000/api/export/proposal/not-an-object-id'),
        { params: Promise.resolve({ id: 'not-an-object-id' }) },
      )
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('Invalid proposal ID')
      expect(mockPrismaDocumentFindFirst).not.toHaveBeenCalled()
    })

    it('should return 404 if user tries to access another users proposal', async () => {
      mockAuth.mockResolvedValue(validSession as any)
      mockPrismaDocumentFindFirst.mockResolvedValue(null) // Prisma returns null due to userId mismatch

      const request = new NextRequest('http://localhost:3000/api/export/proposal/507f1f77bcf86cd799439011', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) })
      const result = await response.json()

      expect(response.status).toBe(404)
      expect(result.error).toBe('Proposal not found')
      expect(mockPrismaDocumentFindFirst).toHaveBeenCalledWith({
        where: {
          id: '507f1f77bcf86cd799439011',
          userId: 'user-123',
          type: 'proposal'
        }
      })
    })

    it('should return 400 for invalid format', async () => {
      mockAuth.mockResolvedValue(validSession as any)
      mockPrismaDocumentFindFirst.mockResolvedValue(mockProposal as any)

      const request = new NextRequest('http://localhost:3000/api/export/proposal/507f1f77bcf86cd799439011?format=invalid', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) })
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('Invalid format')
    })

    it('should handle database errors gracefully', async () => {
      mockAuth.mockResolvedValue(validSession as any)
      mockPrismaDocumentFindFirst.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/export/proposal/507f1f77bcf86cd799439011', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) })
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.error).toBe('Failed to export proposal')
    })

    it('should generate safe filename from project title', async () => {
      const proposalWithSpecialChars = {
        ...mockProposal,
        projectTitle: 'Project @#$%& with Special Chars!!!'
      }

      mockAuth.mockResolvedValue(validSession as any)
      mockPrismaDocumentFindFirst.mockResolvedValue(proposalWithSpecialChars as any)

      const request = new NextRequest('http://localhost:3000/api/export/proposal/507f1f77bcf86cd799439011', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) })

      expect(response.headers.get('Content-Disposition')).toContain('Project_with_Special_Chars.pdf')
    })
  })

  describe('Error Handling', () => {
    it('should handle PDF generation errors gracefully', async () => {
      mockAuth.mockResolvedValue(validSession as any)
      mockPrismaDocumentFindFirst.mockResolvedValue(mockProposal as any)
      mockPage.pdf.mockRejectedValue(new Error('PDF generation failed'))

      const request = new NextRequest('http://localhost:3000/api/export/proposal/507f1f77bcf86cd799439011', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) })
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.error).toBe('Failed to export proposal')
      expect(mockBrowser.close).toHaveBeenCalled() // Ensure cleanup happens
    })

    it('should handle DOCX generation errors gracefully', async () => {
      mockAuth.mockResolvedValue(validSession as any)
      mockPrismaDocumentFindFirst.mockResolvedValue(mockProposal as any)
      mockPacker.toBuffer.mockRejectedValue(new Error('DOCX generation failed'))

      const request = new NextRequest('http://localhost:3000/api/export/proposal/507f1f77bcf86cd799439011?format=docx', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) })
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.error).toBe('Failed to export proposal')
    })

    it('should handle browser launch errors gracefully', async () => {
      mockAuth.mockResolvedValue(validSession as any)
      mockPrismaDocumentFindFirst.mockResolvedValue(mockProposal as any)
      mockChromium.launch.mockRejectedValue(new Error('Browser launch failed'))

      const request = new NextRequest('http://localhost:3000/api/export/proposal/507f1f77bcf86cd799439011', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) })
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.error).toBe('Failed to export proposal')
    })
  })
})
