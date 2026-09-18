jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    documentVersion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    generation: {
      updateMany: jest.fn(),
    },
  },
}))

import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { GET as listDocuments } from "@/app/api/documents/route"
import { DELETE, PATCH } from "@/app/api/documents/[id]/route"
import { POST as duplicateDocument } from "@/app/api/documents/[id]/duplicate/route"
import { GET as listVersions } from "@/app/api/documents/[id]/versions/route"
import { POST as restoreVersion } from "@/app/api/documents/[id]/versions/[version]/route"

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockDocument = prisma.document as unknown as {
  findFirst: jest.Mock
  findMany: jest.Mock
  update: jest.Mock
  delete: jest.Mock
  create: jest.Mock
}
const mockDocumentVersion = prisma.documentVersion as unknown as {
  findFirst: jest.Mock
  findMany: jest.Mock
  create: jest.Mock
  deleteMany: jest.Mock
}
const mockGeneration = prisma.generation as unknown as { updateMany: jest.Mock }

const session = { user: { id: "user-1", email: "owner@example.com" } }
const source = {
  id: "507f1f77bcf86cd799439011",
  userId: "user-1",
  type: "proposal",
  clientName: "Acme",
  clientCompany: "Acme Inc",
  projectTitle: "Website proposal",
  content: "# Proposal",
  metadata: '{"model":"test"}',
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
}

function request(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe("document APIs", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue(session as never)
    mockDocumentVersion.findFirst.mockResolvedValue(null)
    mockDocumentVersion.create.mockResolvedValue({})
    mockDocumentVersion.deleteMany.mockResolvedValue({ count: 0 })
    mockGeneration.updateMany.mockResolvedValue({ count: 0 })
  })

  it("lists only the authenticated user's matching documents", async () => {
    mockDocument.findMany.mockResolvedValue([source])

    const response = await listDocuments(
      request("http://localhost:3000/api/documents?q=Acme&type=proposal&sort=oldest", "GET"),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      documents: [{ ...source, createdAt: source.createdAt.toISOString() }],
      page: 1,
      hasMore: false,
    })
    expect(mockDocument.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        type: "proposal",
        OR: [
          { projectTitle: { contains: "Acme" } },
          { clientName: { contains: "Acme" } },
          { clientCompany: { contains: "Acme" } },
        ],
      },
      orderBy: { createdAt: "asc" },
      skip: 0,
      take: 101,
    })
  })

  it("returns bounded pages and a continuation flag", async () => {
    mockDocument.findMany.mockResolvedValue(Array.from({ length: 4 }, (_, index) => ({
      ...source,
      id: `507f1f77bcf86cd7994390${String(index + 20).padStart(2, "0")}`,
    })))

    const response = await listDocuments(
      request("http://localhost:3000/api/documents?limit=3&page=2", "GET"),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.page).toBe(2)
    expect(body.hasMore).toBe(true)
    expect(body.documents).toHaveLength(3)
    expect(mockDocument.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 3, take: 4 }))
  })

  it("updates an owned document and rejects unknown fields", async () => {
    mockDocument.findFirst.mockResolvedValue(source)
    mockDocument.update.mockResolvedValue({ ...source, projectTitle: "Updated" })

    const response = await PATCH(
      request("http://localhost:3000/api/documents/507f1f77bcf86cd799439011", "PATCH", {
        projectTitle: "Updated",
      }),
      { params: Promise.resolve({ id: source.id }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).document.projectTitle).toBe("Updated")
    expect(mockDocument.update).toHaveBeenCalledWith({
      where: { id: source.id },
      data: { projectTitle: "Updated" },
    })

    const invalid = await PATCH(
      request("http://localhost:3000/api/documents/507f1f77bcf86cd799439011", "PATCH", {
        userId: "attacker",
      }),
      { params: Promise.resolve({ id: source.id }) },
    )
    expect(invalid.status).toBe(400)
    expect(mockDocument.update).toHaveBeenCalledTimes(1)
  })

  it("does not create a redundant version for an unchanged save", async () => {
    mockDocument.findFirst.mockResolvedValue(source)

    const response = await PATCH(
      request("http://localhost:3000/api/documents/507f1f77bcf86cd799439011", "PATCH", {
        projectTitle: source.projectTitle,
      }),
      { params: Promise.resolve({ id: source.id }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).document).toEqual({ ...source, createdAt: source.createdAt.toISOString() })
    expect(mockDocumentVersion.create).not.toHaveBeenCalled()
    expect(mockDocument.update).not.toHaveBeenCalled()
  })

  it("does not allow cross-user mutation or deletion", async () => {
    mockDocument.findFirst.mockResolvedValue(null)

    const patchResponse = await PATCH(
      request("http://localhost:3000/api/documents/507f1f77bcf86cd799439099", "PATCH", { content: "Nope" }),
      { params: Promise.resolve({ id: "507f1f77bcf86cd799439099" }) },
    )
    const deleteResponse = await DELETE(
      request("http://localhost:3000/api/documents/507f1f77bcf86cd799439099", "DELETE"),
      { params: Promise.resolve({ id: "507f1f77bcf86cd799439099" }) },
    )

    expect(patchResponse.status).toBe(404)
    expect(deleteResponse.status).toBe(404)
    expect(mockDocument.delete).not.toHaveBeenCalled()
  })

  it("deletes owned documents with snapshots while preserving generation history", async () => {
    mockDocument.findFirst.mockResolvedValue(source)
    mockDocument.delete.mockResolvedValue(source)

    const response = await DELETE(
      request(`http://localhost:3000/api/documents/${source.id}`, "DELETE"),
      { params: Promise.resolve({ id: source.id }) },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ message: "Document deleted" })
    expect(mockDocumentVersion.deleteMany).toHaveBeenCalledWith({
      where: { documentId: source.id, userId: session.user.id },
    })
    expect(mockGeneration.updateMany).toHaveBeenCalledWith({
      where: { documentId: source.id, userId: session.user.id },
      data: { documentId: null },
    })
    expect(mockDocument.delete).toHaveBeenCalledWith({ where: { id: source.id } })
  })

  it("rejects malformed Mongo document IDs before querying", async () => {
    const response = await PATCH(
      request("http://localhost:3000/api/documents/not-an-object-id", "PATCH", { content: "Nope" }),
      { params: Promise.resolve({ id: "not-an-object-id" }) },
    )

    expect(response.status).toBe(400)
    expect(mockDocument.findFirst).not.toHaveBeenCalled()
  })

  it("duplicates an owned document with a clear title", async () => {
    mockDocument.findFirst.mockResolvedValue(source)
    mockDocument.create.mockResolvedValue({ ...source, id: "507f1f77bcf86cd799439012", projectTitle: "Website proposal (Copy)" })

    const response = await duplicateDocument(
      request("http://localhost:3000/api/documents/507f1f77bcf86cd799439011/duplicate", "POST"),
      { params: Promise.resolve({ id: source.id }) },
    )

    expect(response.status).toBe(201)
    expect((await response.json()).document.projectTitle).toBe("Website proposal (Copy)")
    expect(mockDocument.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: source.type,
        clientName: source.clientName,
        clientCompany: source.clientCompany,
        projectTitle: "Website proposal (Copy)",
        content: source.content,
        metadata: source.metadata,
      },
    })
  })

  it("lists and restores ownership-scoped versions", async () => {
    const version = {
      id: "507f1f77bcf86cd799439021",
      documentId: source.id,
      userId: session.user.id,
      version: 1,
      type: source.type,
      clientName: source.clientName,
      clientCompany: source.clientCompany,
      projectTitle: "Original title",
      content: "Original content",
      metadata: source.metadata,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    }
    mockDocument.findFirst.mockResolvedValue(source)
    mockDocumentVersion.findMany.mockResolvedValue([version])
    const listResponse = await listVersions(
      request(`http://localhost:3000/api/documents/${source.id}/versions`, "GET"),
      { params: Promise.resolve({ id: source.id }) },
    )
    expect(listResponse.status).toBe(200)
    expect((await listResponse.json()).versions[0].version).toBe(1)

    mockDocument.findFirst.mockResolvedValueOnce(source)
    mockDocumentVersion.findFirst
      .mockResolvedValueOnce(version)
      .mockResolvedValueOnce({ ...version, version: 2 })
    mockDocument.update.mockResolvedValue({ ...source, projectTitle: "Original title", content: "Original content" })

    const restoreResponse = await restoreVersion(
      request(`http://localhost:3000/api/documents/${source.id}/versions/1`, "POST"),
      { params: Promise.resolve({ id: source.id, version: "1" }) },
    )
    expect(restoreResponse.status).toBe(200)
    expect((await restoreResponse.json()).restoredFrom).toBe(1)
    expect(mockDocument.update).toHaveBeenCalledWith({
      where: { id: source.id },
      data: {
        clientName: source.clientName,
        clientCompany: source.clientCompany,
        projectTitle: "Original title",
        content: "Original content",
        metadata: source.metadata,
      },
    })
    expect(mockDocumentVersion.create).toHaveBeenCalled()
  })
})
