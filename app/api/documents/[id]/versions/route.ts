import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isMongoObjectId } from "@/lib/mongo-id"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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
      path: "/api/documents/:id/versions",
      method: "GET",
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
    const document = await prisma.document.findFirst({ where: { id, userId: session.user.id } })
    if (!document) {
      return json({ error: "Document not found", requestId }, { status: 404 })
    }

    const versions = await prisma.documentVersion.findMany({
      where: { documentId: document.id, userId: session.user.id },
      select: {
        id: true,
        version: true,
        projectTitle: true,
        createdAt: true,
      },
      orderBy: { version: "desc" },
      take: 50,
    })

    return json({ versions })
  } catch (error) {
    console.error("Document version list error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "route_failed",
      requestId,
      path: "/api/documents/:id/versions",
      method: "GET",
      category: "version-list",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Unable to load document versions", requestId }, { status: 500 })
  }
}
