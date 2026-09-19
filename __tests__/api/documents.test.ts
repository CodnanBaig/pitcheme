jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    documentVersion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
    generation: {
      updateMany: jest.fn(),
    },
    documentShare: {
      deleteMany: jest.fn(),
    },
    productEvent: {
      deleteMany: jest.fn(),
    },
  },
}))
jest.mock("@/lib/error-monitoring", () => ({
  sendOperationalErrorTelemetry: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"
import { GET as listDocuments } from "@/app/api/documents/route"
import { DELETE, PATCH } from "@/app/api/documents/[id]/route"
import { POST as duplicateDocument } from "@/app/api/documents/[id]/duplicate/route"
import { GET as listVersions } from "@/app/api/documents/[id]/versions/route"
import { POST as restoreVersion } from "@/app/api/documents/[id]/versions/[version]/route"
import { getDocumentRevision } from "@/lib/document-revision"

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockDocument = prisma.document as unknown as {
  findFirst: jest.Mock
  findMany: jest.Mock
  update: jest.Mock
  updateMany: jest.Mock
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
const mockDocumentShare = prisma.documentShare as unknown as { deleteMany: jest.Mock }
const mockProductEvent = prisma.productEvent as unknown as { deleteMany: jest.Mock }
const mockPrismaTransaction = prisma.$transaction as unknown as jest.Mock
const mockOperationalTelemetry = sendOperationalErrorTelemetry as jest.MockedFunction<typeof sendOperationalErrorTelemetry>

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
    mockPrismaTransaction.mockImplementation(async (callback: (transaction: typeof prisma) => unknown) => callback(prisma))
    mockDocumentVersion.findFirst.mockResolvedValue(null)
    mockDocumentVersion.create.mockResolvedValue({})
    mockDocument.updateMany.mockResolvedValue({ count: 1 })
    mockDocumentVersion.deleteMany.mockResolvedValue({ count: 0 })
    mockGeneration.updateMany.mockResolvedValue({ count: 0 })
    mockDocumentShare.deleteMany.mockResolvedValue({ count: 0 })
    mockProductEvent.deleteMany.mockResolvedValue({ count: 0 })
  })

  it("lists only the authenticated user's matching documents", async () => {
    mockDocument.findMany.mockResolvedValue([{
      id: source.id,
      type: source.type,
      clientName: source.clientName,
      projectTitle: source.projectTitle,
      createdAt: source.createdAt,
    }])

    const response = await listDocuments(
      request("http://localhost:3000/api/documents?q=Acme&type=proposal&sort=oldest", "GET"),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("X-Request-ID")).toEqual(expect.any(String))
    expect(await response.json()).toEqual({
      documents: [{
        id: source.id,
        type: source.type,
        clientName: source.clientName,
        projectTitle: source.projectTitle,
        createdAt: source.createdAt.toISOString(),
      }],
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
      select: {
        id: true,
        type: true,
        clientName: true,
        projectTitle: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      skip: 0,
      take: 101,
    })
  })

  it("returns a request-correlated error when the session store is unavailable", async () => {
    mockAuth.mockRejectedValueOnce(new Error("session store unavailable"))

    const response = await listDocuments(request("http://localhost:3000/api/documents", "GET"))
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(response.headers.get("X-Request-ID")).toEqual(expect.any(String))
    expect(payload).toEqual({
      error: "Authentication check failed",
      requestId: expect.any(String),
    })
    expect(mockDocument.findMany).not.toHaveBeenCalled()
  })

  it("forwards bounded telemetry when document listing fails", async () => {
    mockDocument.findMany.mockRejectedValueOnce(new Error("private document content"))

    const response = await listDocuments(request("http://localhost:3000/api/documents", "GET"))
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({ error: "Unable to load documents", requestId: expect.any(String) })
    expect(mockOperationalTelemetry).toHaveBeenCalledWith({
      event: "route_failed",
      requestId: expect.any(String),
      path: "/api/documents",
      method: "GET",
      category: "document-list",
      error: "Error",
    })
    expect(JSON.stringify(mockOperationalTelemetry.mock.calls[0][0])).not.toContain("private document content")
  })

  it("keeps every owner-scoped document handler inside the auth error boundary", async () => {
    const calls = [
      () => PATCH(request(`http://localhost:3000/api/documents/${source.id}`, "PATCH", { content: "# Updated" }), { params: Promise.resolve({ id: source.id }) }),
      () => DELETE(request(`http://localhost:3000/api/documents/${source.id}`, "DELETE"), { params: Promise.resolve({ id: source.id }) }),
      () => duplicateDocument(request(`http://localhost:3000/api/documents/${source.id}/duplicate`, "POST"), { params: Promise.resolve({ id: source.id }) }),
      () => listVersions(request(`http://localhost:3000/api/documents/${source.id}/versions`, "GET"), { params: Promise.resolve({ id: source.id }) }),
      () => restoreVersion(request(`http://localhost:3000/api/documents/${source.id}/versions/1`, "POST"), { params: Promise.resolve({ id: source.id, version: "1" }) }),
    ]

    for (const call of calls) {
      mockAuth.mockRejectedValueOnce(new Error("session store unavailable"))
      const response = await call()
      const payload = await response.json()

      expect(response.status).toBe(500)
      expect(response.headers.get("X-Request-ID")).toEqual(expect.any(String))
      expect(payload.error).toBe("Authentication check failed")
    }
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

  it("bounds document search terms before querying MongoDB", async () => {
    mockDocument.findMany.mockResolvedValue([])
    const longQuery = "a".repeat(400)

    await listDocuments(
      request(`http://localhost:3000/api/documents?q=${longQuery}`, "GET"),
    )

    expect(mockDocument.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: "user-1",
        OR: [
          { projectTitle: { contains: "a".repeat(200) } },
          { clientName: { contains: "a".repeat(200) } },
          { clientCompany: { contains: "a".repeat(200) } },
        ],
      },
    }))
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
    expect(response.headers.get("ETag")).toMatch(/^"[a-f0-9]{64}"$/)
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

  it("does not create a version when an unconditional update fails", async () => {
    mockDocument.findFirst.mockResolvedValue(source)
    mockDocument.update.mockRejectedValue(new Error("database unavailable"))

    const response = await PATCH(
      request("http://localhost:3000/api/documents/507f1f77bcf86cd799439011", "PATCH", {
        projectTitle: "Update that will fail",
      }),
      { params: Promise.resolve({ id: source.id }) },
    )

    expect(response.status).toBe(500)
    expect(mockDocumentVersion.create).not.toHaveBeenCalled()
  })

  it("does not report a save when the transactional version snapshot fails", async () => {
    mockDocument.findFirst.mockResolvedValue(source)
    mockDocument.update.mockResolvedValue({ ...source, projectTitle: "Updated" })
    mockDocumentVersion.create.mockRejectedValue(new Error("version write unavailable"))

    const response = await PATCH(
      request("http://localhost:3000/api/documents/507f1f77bcf86cd799439011", "PATCH", {
        projectTitle: "Updated",
      }),
      { params: Promise.resolve({ id: source.id }) },
    )

    expect(response.status).toBe(500)
    expect(mockPrismaTransaction).toHaveBeenCalled()
  })

  it("rejects a stale document revision without overwriting newer content", async () => {
    mockDocument.findFirst.mockResolvedValue({ ...source, content: "Newer content" })

    const staleResponse = await PATCH(
      new NextRequest("http://localhost:3000/api/documents/507f1f77bcf86cd799439011", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "If-Match": `"${getDocumentRevision(source)}"` },
        body: JSON.stringify({ projectTitle: "Stale write" }),
      }),
      { params: Promise.resolve({ id: source.id }) },
    )

    expect(staleResponse.status).toBe(409)
    expect((await staleResponse.json()).error).toContain("changed since it was loaded")
    expect(staleResponse.headers.get("ETag")).toBe(`"${getDocumentRevision({ ...source, content: "Newer content" })}"`)
    expect(mockDocument.update).not.toHaveBeenCalled()
  })

  it("atomically applies a guarded revision update", async () => {
    const updatedDocument = { ...source, projectTitle: "Guarded update" }
    mockDocument.findFirst
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(updatedDocument)

    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/documents/507f1f77bcf86cd799439011", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "If-Match": `"${getDocumentRevision(source)}"` },
        body: JSON.stringify({ projectTitle: updatedDocument.projectTitle }),
      }),
      { params: Promise.resolve({ id: source.id }) },
    )

    expect(response.status).toBe(200)
    expect(mockDocument.updateMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { id: source.id, userId: source.userId },
          { clientName: source.clientName },
          { clientCompany: source.clientCompany },
          { projectTitle: source.projectTitle },
          { content: source.content },
          { metadata: source.metadata },
        ],
      },
      data: { projectTitle: updatedDocument.projectTitle },
    })
    expect(mockDocument.update).not.toHaveBeenCalled()
    expect((await response.json()).document.projectTitle).toBe(updatedDocument.projectTitle)
  })

  it("guards optional Mongo fields whether they are null or unset", async () => {
    const mongoDocument = { ...source, clientCompany: null, metadata: null }
    const updatedDocument = { ...mongoDocument, projectTitle: "Guarded optional update" }
    mockDocument.findFirst
      .mockResolvedValueOnce(mongoDocument)
      .mockResolvedValueOnce(updatedDocument)

    const response = await PATCH(
      new NextRequest(`http://localhost:3000/api/documents/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "If-Match": `"${getDocumentRevision(mongoDocument)}"` },
        body: JSON.stringify({ projectTitle: updatedDocument.projectTitle }),
      }),
      { params: Promise.resolve({ id: source.id }) },
    )

    expect(response.status).toBe(200)
    expect(mockDocument.updateMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { id: source.id, userId: source.userId },
          { clientName: source.clientName },
          { OR: [{ clientCompany: null }, { clientCompany: { isSet: false } }] },
          { projectTitle: source.projectTitle },
          { content: source.content },
          { OR: [{ metadata: null }, { metadata: { isSet: false } }] },
        ],
      },
      data: { projectTitle: updatedDocument.projectTitle },
    })
  })

  it("returns a conflict when the guarded update loses a write race", async () => {
    const latestDocument = { ...source, projectTitle: "Concurrent update" }
    mockDocument.findFirst
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(latestDocument)
    mockDocument.updateMany.mockResolvedValue({ count: 0 })

    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/documents/507f1f77bcf86cd799439011", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "If-Match": `"${getDocumentRevision(source)}"` },
        body: JSON.stringify({ projectTitle: "Lost race" }),
      }),
      { params: Promise.resolve({ id: source.id }) },
    )

    expect(response.status).toBe(409)
    expect((await response.json()).error).toContain("changed since it was loaded")
    expect(response.headers.get("ETag")).toBe(`"${getDocumentRevision(latestDocument)}"`)
    expect(mockDocumentVersion.create).not.toHaveBeenCalled()
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
    expect(mockDocumentShare.deleteMany).toHaveBeenCalledWith({
      where: { documentId: source.id, userId: session.user.id },
    })
    expect(mockProductEvent.deleteMany).toHaveBeenCalledWith({
      where: { documentId: source.id, userId: session.user.id },
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
    expect(mockDocumentVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ documentId: "507f1f77bcf86cd799439012", version: 1 }),
    }))
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
    expect(mockDocumentVersion.findMany).toHaveBeenCalledWith({
      where: { documentId: source.id, userId: session.user.id },
      select: {
        id: true,
        version: true,
        projectTitle: true,
        createdAt: true,
      },
      orderBy: { version: "desc" },
      take: 50,
    })

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

  it("atomically restores a version from a matching editor revision", async () => {
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
    const restoredDocument = { ...source, projectTitle: version.projectTitle, content: version.content }
    mockDocument.findFirst
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(restoredDocument)
    mockDocumentVersion.findFirst
      .mockResolvedValueOnce(version)
      .mockResolvedValueOnce({ ...version, version: 1 })

    const response = await restoreVersion(
      new NextRequest(`http://localhost:3000/api/documents/${source.id}/versions/1`, {
        method: "POST",
        headers: { "If-Match": `"${getDocumentRevision(source)}"` },
      }),
      { params: Promise.resolve({ id: source.id, version: "1" }) },
    )

    expect(response.status).toBe(200)
    expect(mockDocument.updateMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { id: source.id, userId: source.userId },
          { clientName: source.clientName },
          { clientCompany: source.clientCompany },
          { projectTitle: source.projectTitle },
          { content: source.content },
          { metadata: source.metadata },
        ],
      },
      data: {
        clientName: version.clientName,
        clientCompany: version.clientCompany,
        projectTitle: version.projectTitle,
        content: version.content,
        metadata: version.metadata,
      },
    })
    expect(mockDocument.update).not.toHaveBeenCalled()
    expect((await response.json()).document.projectTitle).toBe(version.projectTitle)
  })

  it("rejects restoring a version from a stale editor revision", async () => {
    const newerDocument = { ...source, content: "Newer content" }
    mockDocument.findFirst.mockResolvedValue(newerDocument)

    const response = await restoreVersion(
      new NextRequest(`http://localhost:3000/api/documents/${source.id}/versions/1`, {
        method: "POST",
        headers: { "If-Match": `"${getDocumentRevision(source)}"` },
      }),
      { params: Promise.resolve({ id: source.id, version: "1" }) },
    )

    expect(response.status).toBe(409)
    expect((await response.json()).error).toContain("Reload before restoring")
    expect(response.headers.get("ETag")).toBe(`"${getDocumentRevision(newerDocument)}"`)
    expect(mockDocumentVersion.findFirst).not.toHaveBeenCalled()
    expect(mockDocument.update).not.toHaveBeenCalled()
  })
})
