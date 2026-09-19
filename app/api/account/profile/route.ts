import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { type NextRequest, NextResponse } from "next/server"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"
import { readJsonBody } from "@/lib/request-body"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"

const MAX_NAME_LENGTH = 120
const MAX_REQUEST_BYTES = 4 * 1024

export const runtime = "nodejs"
export const maxDuration = 30

export async function PATCH(request: NextRequest) {
  const requestId = getRequestId(request)
  const json = (body: unknown, init: ResponseInit = {}) =>
    NextResponse.json(body, jsonWithRequestId(requestId, init))
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return json({ error: "Unauthorized", requestId }, { status: 401 })
    }

    const parsedBody = await readJsonBody(request, MAX_REQUEST_BYTES)
    if (!parsedBody.ok) {
      return json(
        { error: parsedBody.reason === "too-large" ? "Request body is too large" : "Invalid JSON request body", requestId },
        { status: parsedBody.reason === "too-large" ? 413 : 400 },
      )
    }
    const body = parsedBody.body

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Invalid request body", requestId }, { status: 400 })
    }

    const input = body as Record<string, unknown>
    const unknownFields = Object.keys(input).filter((key) => key !== "name")
    if (unknownFields.length > 0) {
      return json({ error: "Unsupported profile fields", requestId }, { status: 400 })
    }

    if (typeof input.name !== "string") {
      return json({ error: "Name must be a string", requestId }, { status: 400 })
    }

    const name = input.name.trim()
    if (name.length > MAX_NAME_LENGTH) {
      return json(
        { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer`, requestId },
        { status: 400 },
      )
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: name || null },
      select: { id: true, name: true, email: true },
    })

    return json({ user })
  } catch (error) {
    console.error("Profile update error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "route_failed",
      requestId,
      path: "/api/account/profile",
      method: "PATCH",
      category: "profile",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Failed to update profile", requestId }, { status: 500 })
  }
}
