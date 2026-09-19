import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import type { PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isMongoObjectId } from "@/lib/mongo-id"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"
import { getDocumentRevision, getIfMatchRevision, revisionHeaders } from "@/lib/document-revision"
import { readJsonBody } from "@/lib/request-body"
import { recordProductEvent } from "@/lib/product-events"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"

type EditableDocumentFields = {
  clientName?: string | null
  clientCompany?: string | null
  projectTitle?: string | null
  content?: string
}

const MAX_CONTENT_LENGTH = 1_000_000
const MAX_REQUEST_BYTES = 1_100_000
const editableFields = new Set<keyof EditableDocumentFields>(["clientName", "clientCompany", "projectTitle", "content"])

export const runtime = "nodejs"
export const maxDuration = 30

async function getOwnedDocument(id: string, userId: string) {
  return prisma.document.findFirst({
    where: { id, userId },
  })
}

function documentStateWhere(document: {
  id: string
  userId: string
  clientName: string | null
  clientCompany: string | null
  projectTitle: string | null
  content: string
  metadata: string | null
}) {
  const nullableState = (field: "clientName" | "clientCompany" | "projectTitle" | "metadata", value: string | null) =>
    value === null
      ? { OR: [{ [field]: null }, { [field]: { isSet: false } }] }
      : { [field]: value }

  return {
    AND: [
      { id: document.id, userId: document.userId },
      nullableState("clientName", document.clientName),
      nullableState("clientCompany", document.clientCompany),
      nullableState("projectTitle", document.projectTitle),
      { content: document.content },
      nullableState("metadata", document.metadata),
    ],
  }
}

async function createVersion(document: {
  id: string
  type: string
  clientName: string | null
  clientCompany: string | null
  projectTitle: string | null
  content: string
  metadata: string | null
}, userId: string, client: Pick<PrismaClient, "documentVersion"> = prisma) {
  const latest = await client.documentVersion.findFirst({
    where: { documentId: document.id, userId },
    orderBy: { version: "desc" },
  })

  return client.documentVersion.create({
    data: {
      documentId: document.id,
      userId,
      version: (latest?.version ?? 0) + 1,
      type: document.type,
      clientName: document.clientName,
      clientCompany: document.clientCompany,
      projectTitle: document.projectTitle,
      content: document.content,
      metadata: document.metadata,
    },
  })
}

function parseEditableFields(value: unknown):
  | { valid: true; data: EditableDocumentFields }
  | { valid: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, error: "Request body must be a JSON object" }
  }

  const input = value as Record<string, unknown>
  const unknownField = Object.keys(input).find((key) => !editableFields.has(key as keyof EditableDocumentFields))
  if (unknownField) {
    return { valid: false, error: `Field is not editable: ${unknownField}` }
  }

  const data: EditableDocumentFields = {}
  for (const field of editableFields) {
    if (!(field in input)) continue
    const fieldValue = input[field]

    if (field === "content") {
      if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
        return { valid: false, error: "content must be a non-empty string" }
      }
      if (fieldValue.length > MAX_CONTENT_LENGTH) {
        return { valid: false, error: "content is too large" }
      }
      data.content = fieldValue
      continue
    }

    if (fieldValue !== null && typeof fieldValue !== "string") {
      return { valid: false, error: `${field} must be a string or null` }
    }
    if (typeof fieldValue === "string" && fieldValue.length > 500) {
      return { valid: false, error: `${field} is too large` }
    }
    data[field] = fieldValue as string | null
  }

  if (Object.keys(data).length === 0) {
    return { valid: false, error: "At least one editable field is required" }
  }

  return { valid: true, data }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request)
  const json = (body: unknown, init: ResponseInit = {}) =>
    NextResponse.json(body, jsonWithRequestId(requestId, init))
  const jsonWithRevision = (body: unknown, revision: string, init: ResponseInit = {}) => {
    const headers = jsonWithRequestId(requestId, init).headers
    const mergedHeaders = new Headers(headers)
    revisionHeaders(revision).forEach((value, key) => mergedHeaders.set(key, value))
    return NextResponse.json(body, { ...init, headers: mergedHeaders })
  }
  let session: Awaited<ReturnType<typeof auth>>
  try {
    session = await auth()
  } catch (error) {
    console.error("Document authentication error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "route_failed",
      requestId,
      path: "/api/documents/:id",
      method: "PATCH",
      category: "authentication",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Authentication check failed", requestId }, { status: 500 })
  }
  if (!session?.user?.id) {
    return json({ error: "Unauthorized", requestId }, { status: 401 })
  }

  const { id } = await props.params
  if (!isMongoObjectId(id)) {
    return json({ error: "Invalid document id", requestId }, { status: 400 })
  }
  const parsedBody = await readJsonBody(request, MAX_REQUEST_BYTES)
  if (!parsedBody.ok) {
    return json(
      { error: parsedBody.reason === "too-large" ? "Request body is too large" : "Invalid JSON request body", requestId },
      { status: parsedBody.reason === "too-large" ? 413 : 400 },
    )
  }
  const body = parsedBody.body

  const parsed = parseEditableFields(body)
  if (!parsed.valid) {
    return json({ error: parsed.error, requestId }, { status: 400 })
  }

  try {
    const document = await getOwnedDocument(id, session.user.id)
    if (!document) {
      return json({ error: "Document not found", requestId }, { status: 404 })
    }

    const currentRevision = getDocumentRevision(document)
    const expectedRevision = getIfMatchRevision(request)
    if (request.headers.has("if-match") && !expectedRevision) {
      return json({ error: "Invalid document revision", requestId }, { status: 400 })
    }
    if (expectedRevision && expectedRevision !== currentRevision) {
      return jsonWithRevision(
        { error: "Document changed since it was loaded. Reload before saving.", revision: currentRevision, requestId },
        currentRevision,
        { status: 409 },
      )
    }

    const hasChanges = Object.entries(parsed.data).some(([field, value]) => {
      return document[field as keyof typeof parsed.data] !== value
    })
    if (!hasChanges) {
      return jsonWithRevision({ document, revision: currentRevision }, currentRevision)
    }

    if (expectedRevision) {
      const transactionResult = await prisma.$transaction(async (transaction) => {
        const guardedUpdate = await transaction.document.updateMany({
          where: documentStateWhere(document),
          data: parsed.data,
        })
        if (guardedUpdate.count !== 1) return { status: "conflict" as const }

        const updated = await transaction.document.findFirst({
          where: { id: document.id, userId: session.user.id },
        })
        if (!updated) return { status: "missing" as const }

        await createVersion(updated, session.user.id, transaction)
        return { status: "updated" as const, document: updated }
      })

      if (transactionResult.status === "conflict") {
        const latest = await getOwnedDocument(document.id, session.user.id)
        if (!latest) {
          return json({ error: "Document not found", requestId }, { status: 404 })
        }
        const latestRevision = getDocumentRevision(latest)
        return jsonWithRevision(
          { error: "Document changed since it was loaded. Reload before saving.", revision: latestRevision, requestId },
          latestRevision,
          { status: 409 },
        )
      }
      if (transactionResult.status === "missing") {
        return json({ error: "Document not found", requestId }, { status: 404 })
      }
      const updated = transactionResult.document
      await recordProductEvent({
        name: "edit_saved",
        userId: session.user.id,
        documentId: updated.id,
        requestId,
      })
      const nextRevision = getDocumentRevision(updated)
      return jsonWithRevision({ document: updated, revision: nextRevision }, nextRevision)
    }

    const updated = await prisma.$transaction(async (transaction) => {
      const next = await transaction.document.update({
        where: { id: document.id },
        data: parsed.data,
      })
      await createVersion(next, session.user.id, transaction)
      return next
    })
    await recordProductEvent({
      name: "edit_saved",
      userId: session.user.id,
      documentId: updated.id,
      requestId,
    })

    const nextRevision = getDocumentRevision(updated)
    return jsonWithRevision({ document: updated, revision: nextRevision }, nextRevision)
  } catch (error) {
    console.error("Document update error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "route_failed",
      requestId,
      path: "/api/documents/:id",
      method: "PATCH",
      category: "document-update",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Unable to update document", requestId }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request)
  const json = (body: unknown, init: ResponseInit = {}) =>
    NextResponse.json(body, jsonWithRequestId(requestId, init))
  let session: Awaited<ReturnType<typeof auth>>
  try {
    session = await auth()
  } catch (error) {
    console.error("Document authentication error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "route_failed",
      requestId,
      path: "/api/documents/:id",
      method: "DELETE",
      category: "authentication",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Authentication check failed", requestId }, { status: 500 })
  }
  if (!session?.user?.id) {
    return json({ error: "Unauthorized", requestId }, { status: 401 })
  }

  const { id } = await props.params
  if (!isMongoObjectId(id)) {
    return json({ error: "Invalid document id", requestId }, { status: 400 })
  }

  try {
    const document = await getOwnedDocument(id, session.user.id)
    if (!document) {
      return json({ error: "Document not found", requestId }, { status: 404 })
    }

    // MongoDB does not apply relational cascades for these Prisma relations.
    // Keep the cleanup and document delete in one transaction so a failed
    // dependent write cannot leave an orphaned share or version behind.
    await prisma.$transaction(async (transaction) => {
      await transaction.documentVersion.deleteMany({
        where: { documentId: document.id, userId: session.user.id },
      })
      await transaction.documentShare.deleteMany({
        where: { documentId: document.id, userId: session.user.id },
      })
      await transaction.productEvent.deleteMany({
        where: { documentId: document.id, userId: session.user.id },
      })
      await transaction.generation.updateMany({
        where: { documentId: document.id, userId: session.user.id },
        data: { documentId: null },
      })
      await transaction.document.delete({ where: { id: document.id } })
    })
    return json({ message: "Document deleted" })
  } catch (error) {
    console.error("Document deletion error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "route_failed",
      requestId,
      path: "/api/documents/:id",
      method: "DELETE",
      category: "document-delete",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Unable to delete document", requestId }, { status: 500 })
  }
}
