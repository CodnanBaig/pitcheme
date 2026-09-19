import { type NextRequest, NextResponse } from "next/server"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"

export const runtime = "nodejs"
export const maxDuration = 5

/** Process liveness: this probe intentionally does not depend on external services. */
export function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  const init = jsonWithRequestId(requestId)
  const headers = new Headers(init.headers)
  headers.set("Cache-Control", "no-store")
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    requestId,
  }, { ...init, headers })
}
