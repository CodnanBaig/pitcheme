jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findFirst: jest.fn() },
    documentShare: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  },
}))

import { NextRequest } from "next/server"
import { DELETE, GET, POST } from "@/app/api/documents/[id]/share/route"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockFindFirst = prisma.document.findFirst as jest.MockedFunction<typeof prisma.document.findFirst>
const mockCreateShare = prisma.documentShare.create as jest.MockedFunction<typeof prisma.documentShare.create>
const mockFindShares = prisma.documentShare.findMany as jest.MockedFunction<typeof prisma.documentShare.findMany>
const mockUpdateShares = prisma.documentShare.updateMany as jest.MockedFunction<typeof prisma.documentShare.updateMany>

describe("POST /api/documents/[id]/share", () => {
  const documentId = "507f1f77bcf86cd799439011"
  const session = { user: { id: "user-123", email: "owner@example.com" } }

  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue(session as any)
    mockCreateShare.mockResolvedValue({} as any)
  })

  it("requires an authenticated owner", async () => {
    mockAuth.mockResolvedValue(null)

    const response = await POST(
      new NextRequest(`http://localhost:3000/api/documents/${documentId}/share`, { method: "POST" }),
      { params: Promise.resolve({ id: documentId }) },
    )

    expect(response.status).toBe(401)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it("returns a request-correlated error when the session store is unavailable", async () => {
    for (const [method, handler] of [["POST", POST], ["GET", GET], ["DELETE", DELETE]] as const) {
      mockAuth.mockRejectedValueOnce(new Error("session store unavailable"))
      const response = await handler(
        new NextRequest(`http://localhost:3000/api/documents/${documentId}/share`, { method }),
        { params: Promise.resolve({ id: documentId }) },
      )
      const payload = await response.json()

      expect(response.status).toBe(500)
      expect(response.headers.get("X-Request-ID")).toEqual(expect.any(String))
      expect(payload.error).toBe("Authentication check failed")
    }
  })

  it("rejects malformed ids before querying the database", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/documents/not-an-id/share", { method: "POST" }),
      { params: Promise.resolve({ id: "not-an-id" }) },
    )

    expect(response.status).toBe(400)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it("issues a read-only expiring link only for an owned document", async () => {
    mockFindFirst.mockResolvedValue({ id: documentId, type: "proposal" } as any)

    const response = await POST(
      new NextRequest(`http://localhost:3000/api/documents/${documentId}/share`, { method: "POST" }),
      { params: Promise.resolve({ id: documentId }) },
    )
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload).toMatchObject({
      documentType: "proposal",
      expiresInSeconds: 7 * 24 * 60 * 60,
      requestId: expect.any(String),
    })
    expect(payload.sharePath).toMatch(/^\/share\/v2\.[a-f0-9]{24}\.[0-9]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(mockCreateShare).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        documentId,
        userId: "user-123",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      }),
    }))
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: documentId, userId: "user-123" },
      select: { id: true, type: true },
    })
  })

  it("returns not found for a document outside the owner scope", async () => {
    mockFindFirst.mockResolvedValue(null)

    const response = await POST(
      new NextRequest(`http://localhost:3000/api/documents/${documentId}/share`, { method: "POST" }),
      { params: Promise.resolve({ id: documentId }) },
    )

    expect(response.status).toBe(404)
  })

  it("returns owner-scoped link analytics without exposing bearer tokens", async () => {
    const createdAt = new Date("2026-09-18T00:00:00.000Z")
    const expiresAt = new Date("2026-09-25T00:00:00.000Z")
    mockFindFirst.mockResolvedValue({ id: documentId } as any)
    mockFindShares.mockResolvedValue([{
      id: "share-1",
      createdAt,
      expiresAt,
      revokedAt: null,
      accessCount: 3,
      lastAccessedAt: new Date("2026-09-18T01:00:00.000Z"),
    }] as any)

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/documents/${documentId}/share`, { method: "GET" }),
      { params: Promise.resolve({ id: documentId }) },
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({ activeCount: 1, totalViews: 3, requestId: expect.any(String) })
    expect(payload.links[0]).toEqual({
      id: "share-1",
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      revokedAt: null,
      accessCount: 3,
      lastAccessedAt: "2026-09-18T01:00:00.000Z",
    })
    expect(payload.links[0].token).toBeUndefined()
  })

  it("revokes all active owner-scoped links", async () => {
    mockFindFirst.mockResolvedValue({ id: documentId } as any)
    mockUpdateShares.mockResolvedValue({ count: 2 } as any)

    const response = await DELETE(
      new NextRequest(`http://localhost:3000/api/documents/${documentId}/share`, { method: "DELETE" }),
      { params: Promise.resolve({ id: documentId }) },
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({ revokedCount: 2, requestId: expect.any(String) })
    expect(mockUpdateShares).toHaveBeenCalledWith({
      where: {
        documentId,
        userId: "user-123",
        OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }],
      },
      data: { revokedAt: expect.any(Date) },
    })
  })
})
