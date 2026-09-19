import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  const json = (body: unknown, init: ResponseInit = {}) =>
    NextResponse.json(body, jsonWithRequestId(requestId, init))
  try {
    const session = await auth()

    if (!session) {
      return json({ error: "No session", requestId }, { status: 401 })
    }

    return json({ user: session.user, expires: session.expires })
  } catch (error) {
    console.error("Session check error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "auth_failed",
      requestId,
      path: "/api/auth/session",
      method: "GET",
      category: "session",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Session check failed", requestId }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  const json = (body: unknown, init: ResponseInit = {}) =>
    NextResponse.json(body, jsonWithRequestId(requestId, init))
  // Force refresh the session
  try {
    const session = await auth()

    if (!session) {
      return json({ error: "No session", requestId }, { status: 401 })
    }

    return json({ user: session.user, expires: session.expires, refreshed: true })
  } catch (error) {
    console.error("Session refresh error", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "auth_failed",
      requestId,
      path: "/api/auth/session",
      method: "POST",
      category: "session-refresh",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Session refresh failed", requestId }, { status: 500 })
  }
}
