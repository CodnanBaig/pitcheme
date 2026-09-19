/** @jest-environment node */

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NOT_FOUND")
  }),
}))
jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findFirst: jest.fn() },
    documentShare: { updateMany: jest.fn() },
  },
}))
jest.mock("@/lib/share-token", () => ({
  verifyDocumentShareToken: jest.fn(),
  isPersistentDocumentShareToken: jest.fn(() => true),
  hashDocumentShareToken: jest.fn(() => "a".repeat(64)),
}))
jest.mock("@/lib/sanitize-html", () => ({
  sanitizeGeneratedHtml: jest.fn((value: string) => `<safe>${value}</safe>`),
}))

import SharedDocumentPage from "@/app/share/[token]/page"
import { prisma } from "@/lib/prisma"
import { sanitizeGeneratedHtml } from "@/lib/sanitize-html"
import { verifyDocumentShareToken } from "@/lib/share-token"

const mockFindFirst = prisma.document.findFirst as jest.MockedFunction<typeof prisma.document.findFirst>
const mockUpdateShare = prisma.documentShare.updateMany as jest.MockedFunction<typeof prisma.documentShare.updateMany>
const mockVerify = verifyDocumentShareToken as jest.MockedFunction<typeof verifyDocumentShareToken>
const mockSanitize = sanitizeGeneratedHtml as jest.MockedFunction<typeof sanitizeGeneratedHtml>

function findElement(node: unknown, predicate: (value: Record<string, unknown>) => boolean): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, predicate)
      if (match) return match
    }
    return null
  }

  const value = node as Record<string, unknown>
  if (predicate(value)) return value
  return findElement((value.props as Record<string, unknown> | undefined)?.children, predicate)
}

describe("shared document page", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateShare.mockResolvedValue({ count: 1 } as any)
  })

  it("rejects invalid or expired tokens before querying document data", async () => {
    mockVerify.mockReturnValue(null)

    await expect(SharedDocumentPage({ params: Promise.resolve({ token: "invalid" }) })).rejects.toThrow("NOT_FOUND")
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it("rejects revoked or missing persistent share records before querying document data", async () => {
    mockVerify.mockReturnValue({ documentId: "507f1f77bcf86cd799439011", expiresAt: Date.now() + 60_000 })
    mockUpdateShare.mockResolvedValue({ count: 0 } as any)

    await expect(SharedDocumentPage({ params: Promise.resolve({ token: "revoked-token" }) })).rejects.toThrow("NOT_FOUND")
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it("renders proposal content only after the signed token resolves to a document", async () => {
    mockVerify.mockReturnValue({ documentId: "507f1f77bcf86cd799439011", expiresAt: Date.now() + 60_000 })
    mockFindFirst.mockResolvedValue({
      type: "proposal",
      clientName: "Acme",
      clientCompany: "Acme Co",
      projectTitle: "Operating model",
      content: "# Outcome\n\nA controlled proposal.",
    } as any)

    const page = await SharedDocumentPage({ params: Promise.resolve({ token: "valid-token" }) })
    const heading = findElement(page, (value) => value.type === "h1")

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "507f1f77bcf86cd799439011" },
      select: {
        type: true,
        clientName: true,
        clientCompany: true,
        projectTitle: true,
        content: true,
      },
    })
    expect(mockUpdateShare).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        documentId: "507f1f77bcf86cd799439011",
        OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }],
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: { gt: expect.any(Date) },
      }),
      data: { accessCount: { increment: 1 }, lastAccessedAt: expect.any(Date) },
    }))
    expect(heading?.props).toMatchObject({ children: "Operating model" })
    expect(mockSanitize).not.toHaveBeenCalled()
  })

  it("sanitizes pitch-deck markup before it reaches the HTML boundary", async () => {
    mockVerify.mockReturnValue({ documentId: "507f1f77bcf86cd799439011", expiresAt: Date.now() + 60_000 })
    mockFindFirst.mockResolvedValue({
      type: "pitch-deck",
      clientName: "Acme",
      clientCompany: null,
      projectTitle: "Investor deck",
      content: '<div class="slide"><h1>Problem</h1><script>alert(1)</script></div>',
    } as any)

    const page = await SharedDocumentPage({ params: Promise.resolve({ token: "valid-token" }) })
    const renderedHtml = findElement(page, (value) => {
      const props = value.props as Record<string, unknown> | undefined
      return value.type === "div"
        && props?.className === "shared-deck"
        && Boolean(props && "dangerouslySetInnerHTML" in props)
    })

    expect(mockSanitize).toHaveBeenCalledWith('<div class="slide"><h1>Problem</h1><script>alert(1)</script></div>')
    expect(renderedHtml?.props).toMatchObject({ dangerouslySetInnerHTML: { __html: '<safe><div class="slide"><h1>Problem</h1><script>alert(1)</script></div></safe>' } })
  })
})
