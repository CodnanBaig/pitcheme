import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isMongoObjectId } from "@/lib/mongo-id"
import { enforceRateLimit } from "@/lib/rate-limit"
import { createDocumentShareToken, documentShareTokenTtlMs, hashDocumentShareToken } from "@/lib/share-token"
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
      path: "/api/documents/:id/share",
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
    if (process.env.NODE_ENV !== "test") {
      const rateLimit = await enforceRateLimit(`document-share:${session.user.id}`, { limit: 20, windowMs: 60_000 })
      if (!rateLimit.allowed) {
        return json(
          { error: "Too many share-link requests. Please try again shortly.", requestId },
          { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
        )
      }
    }

    const document = await prisma.document.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, type: true },
    })

    if (!document) {
      return json({ error: "Document not found", requestId }, { status: 404 })
    }

    const share = createDocumentShareToken(document.id)
    await prisma.documentShare.create({
      data: {
        tokenHash: hashDocumentShareToken(share.token),
        documentId: document.id,
        userId: session.user.id,
        expiresAt: new Date(share.expiresAt),
      },
    })
    return json({
      sharePath: `/share/${share.token}`,
      documentType: document.type,
      expiresAt: new Date(share.expiresAt).toISOString(),
      expiresInSeconds: Math.floor(documentShareTokenTtlMs / 1000),
      requestId,
    }, { status: 201 })
  } catch (error) {
    console.error("Document share-link error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "route_failed",
      requestId,
      path: "/api/documents/:id/share",
      method: "POST",
      category: "share-create",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Unable to create share link", requestId }, { status: 500 })
  }
}

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
      path: "/api/documents/:id/share",
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
    const document = await prisma.document.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    })
    if (!document) {
      return json({ error: "Document not found", requestId }, { status: 404 })
    }

    const links = await prisma.documentShare.findMany({
      where: { documentId: id, userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
        accessCount: true,
        lastAccessedAt: true,
      },
    })
    const now = Date.now()
    return json({
      links: links.map((link) => ({
        id: link.id,
        createdAt: link.createdAt.toISOString(),
        expiresAt: link.expiresAt.toISOString(),
        revokedAt: link.revokedAt?.toISOString() || null,
        accessCount: link.accessCount,
        lastAccessedAt: link.lastAccessedAt?.toISOString() || null,
      })),
      activeCount: links.filter((link) => !link.revokedAt && link.expiresAt.getTime() > now).length,
      totalViews: links.reduce((total, link) => total + link.accessCount, 0),
      requestId,
    })
  } catch (error) {
    console.error("Document share analytics error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "route_failed",
      requestId,
      path: "/api/documents/:id/share",
      method: "GET",
      category: "share-analytics",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Unable to load share analytics", requestId }, { status: 500 })
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
      path: "/api/documents/:id/share",
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
    if (process.env.NODE_ENV !== "test") {
      const rateLimit = await enforceRateLimit(`document-share-revoke:${session.user.id}`, { limit: 20, windowMs: 60_000 })
      if (!rateLimit.allowed) {
        return json(
          { error: "Too many share-link requests. Please try again shortly.", requestId },
          { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
        )
      }
    }

    const document = await prisma.document.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    })
    if (!document) {
      return json({ error: "Document not found", requestId }, { status: 404 })
    }

    const result = await prisma.documentShare.updateMany({
      where: {
        documentId: id,
        userId: session.user.id,
        OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }],
      },
      data: { revokedAt: new Date() },
    })
    return json({ revokedCount: result.count, requestId })
  } catch (error) {
    console.error("Document share revocation error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "route_failed",
      requestId,
      path: "/api/documents/:id/share",
      method: "DELETE",
      category: "share-revoke",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Unable to revoke share links", requestId }, { status: 500 })
  }
}
