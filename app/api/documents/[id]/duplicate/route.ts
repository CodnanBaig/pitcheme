import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isMongoObjectId } from "@/lib/mongo-id"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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
      path: "/api/documents/:id/duplicate",
      method: "POST",
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
    const source = await prisma.document.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!source) {
      return json({ error: "Document not found", requestId }, { status: 404 })
    }

    const copy = await prisma.$transaction(async (transaction) => {
      const document = await transaction.document.create({
        data: {
          userId: session.user.id,
          type: source.type,
          clientName: source.clientName,
          clientCompany: source.clientCompany,
          projectTitle: `${source.projectTitle || source.clientName || "Untitled document"} (Copy)`,
          content: source.content,
          metadata: source.metadata,
        },
      })
      await transaction.documentVersion.create({
        data: {
          documentId: document.id,
          userId: session.user.id,
          version: 1,
          type: document.type,
          clientName: document.clientName,
          clientCompany: document.clientCompany,
          projectTitle: document.projectTitle,
          content: document.content,
          metadata: document.metadata,
        },
      })
      return document
    })

    return json({
      document: {
        id: copy.id,
        type: copy.type,
        clientName: copy.clientName,
        projectTitle: copy.projectTitle,
        createdAt: copy.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error("Document duplication error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "route_failed",
      requestId,
      path: "/api/documents/:id/duplicate",
      method: "POST",
      category: "document-duplicate",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Unable to duplicate document", requestId }, { status: 500 })
  }
}
