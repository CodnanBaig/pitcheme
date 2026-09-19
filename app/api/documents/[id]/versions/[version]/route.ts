import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isMongoObjectId } from "@/lib/mongo-id"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"
import { getDocumentRevision, getIfMatchRevision, revisionHeaders } from "@/lib/document-revision"
import { recordProductEvent } from "@/lib/product-events"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"

export const runtime = "nodejs"
export const maxDuration = 30

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

async function getOwnedDocument(id: string, userId: string) {
  return prisma.document.findFirst({ where: { id, userId } })
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string; version: string }> }) {
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
      path: "/api/documents/:id/versions/:version",
      method: "POST",
      category: "authentication",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Authentication check failed", requestId }, { status: 500 })
  }
  if (!session?.user?.id) {
    return json({ error: "Unauthorized", requestId }, { status: 401 })
  }

  const { id, version: versionParam } = await props.params
  if (!isMongoObjectId(id)) {
    return json({ error: "Invalid document id", requestId }, { status: 400 })
  }
  const versionNumber = Number(versionParam)
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return json({ error: "Invalid version", requestId }, { status: 400 })
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
        { error: "Document changed since it was loaded. Reload before restoring.", revision: currentRevision, requestId },
        currentRevision,
        { status: 409 },
      )
    }

    const version = await prisma.documentVersion.findFirst({
      where: { documentId: document.id, userId: session.user.id, version: versionNumber },
    })
    if (!version) {
      return json({ error: "Version not found", requestId }, { status: 404 })
    }

    const restoreData = {
      clientName: version.clientName,
      clientCompany: version.clientCompany,
      projectTitle: version.projectTitle,
      content: version.content,
      metadata: version.metadata,
    }
    const transactionResult = await prisma.$transaction(async (transaction) => {
      let updated
      if (expectedRevision) {
        const guardedUpdate = await transaction.document.updateMany({
          where: documentStateWhere(document),
          data: restoreData,
        })
        if (guardedUpdate.count !== 1) return { status: "conflict" as const }

        updated = await transaction.document.findFirst({
          where: { id: document.id, userId: session.user.id },
        })
        if (!updated) return { status: "missing" as const }
      } else {
        updated = await transaction.document.update({ where: { id: document.id }, data: restoreData })
      }

      const latest = await transaction.documentVersion.findFirst({
        where: { documentId: document.id, userId: session.user.id },
        orderBy: { version: "desc" },
      })
      await transaction.documentVersion.create({
        data: {
          documentId: document.id,
          userId: session.user.id,
          version: (latest?.version ?? versionNumber) + 1,
          type: document.type,
          clientName: updated.clientName,
          clientCompany: updated.clientCompany,
          projectTitle: updated.projectTitle,
          content: updated.content,
          metadata: updated.metadata,
        },
      })

      return { status: "updated" as const, document: updated }
    })

    if (transactionResult.status === "conflict") {
      const latest = await getOwnedDocument(document.id, session.user.id)
      if (!latest) {
        return json({ error: "Document not found", requestId }, { status: 404 })
      }
      const latestRevision = getDocumentRevision(latest)
      return jsonWithRevision(
        { error: "Document changed since it was loaded. Reload before restoring.", revision: latestRevision, requestId },
        latestRevision,
        { status: 409 },
      )
    }
    if (transactionResult.status === "missing") {
      return json({ error: "Document not found", requestId }, { status: 404 })
    }
    const updated = transactionResult.document

    await recordProductEvent({
      name: "document_restored",
      userId: session.user.id,
      documentId: updated.id,
      requestId,
      metadata: { version: versionNumber },
    })

    const nextRevision = getDocumentRevision(updated)
    return jsonWithRevision({ document: updated, restoredFrom: versionNumber, revision: nextRevision }, nextRevision)
  } catch (error) {
    console.error("Document version restore error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "route_failed",
      requestId,
      path: "/api/documents/:id/versions/:version",
      method: "POST",
      category: "version-restore",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Unable to restore document version", requestId }, { status: 500 })
  }
}
