import { auth } from "@/auth"
import { type Prisma } from "@prisma/client"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"

const documentTypes = new Set(["proposal", "pitch-deck"])
const MAX_SEARCH_LENGTH = 200

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(request: NextRequest) {
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
      path: "/api/documents",
      method: "GET",
      category: "authentication",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Authentication check failed", requestId }, { status: 500 })
  }

  if (!session?.user?.id) {
    return json({ error: "Unauthorized", requestId }, { status: 401 })
  }

  const searchParams = new URL(request.url).searchParams
  const query = searchParams.get("q")?.trim().slice(0, MAX_SEARCH_LENGTH)
  const requestedType = searchParams.get("type")
  const sort = searchParams.get("sort") === "oldest" ? "asc" : "desc"
  const limitValue = Number(searchParams.get("limit") || 100)
  const take = Number.isFinite(limitValue) ? Math.min(Math.max(Math.floor(limitValue), 1), 100) : 100
  const pageValue = Number(searchParams.get("page") || 1)
  const page = Number.isFinite(pageValue) ? Math.min(Math.max(Math.floor(pageValue), 1), 10_000) : 1

  const where: Prisma.DocumentWhereInput = {
    userId: session.user.id,
  }

  if (requestedType && documentTypes.has(requestedType)) {
    where.type = requestedType
  }

  if (query) {
    where.OR = [
      { projectTitle: { contains: query } },
      { clientName: { contains: query } },
      { clientCompany: { contains: query } },
    ]
  }

  try {
    const documents = await prisma.document.findMany({
      where,
      select: {
        id: true,
        type: true,
        clientName: true,
        projectTitle: true,
        createdAt: true,
      },
      orderBy: { createdAt: sort },
      skip: (page - 1) * take,
      take: take + 1,
    })
    const hasMore = documents.length > take

    return json({ documents: hasMore ? documents.slice(0, take) : documents, page, hasMore })
  } catch (error) {
    console.error("Document list error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "route_failed",
      requestId,
      path: "/api/documents",
      method: "GET",
      category: "document-list",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Unable to load documents", requestId }, { status: 500 })
  }
}
