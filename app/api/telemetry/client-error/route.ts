import { type NextRequest, NextResponse } from "next/server"
import { readJsonBody } from "@/lib/request-body"
import { enforceRateLimit } from "@/lib/rate-limit"
import { getLoginClientAddress, hashRateLimitKeyPart } from "@/lib/auth-rate-limit"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"

export const runtime = "nodejs"
export const maxDuration = 5

const MAX_REQUEST_BYTES = 2 * 1024
const RATE_LIMIT = { limit: 10, windowMs: 60_000 }
const DIGEST_PATTERN = /^[A-Za-z0-9._:-]{1,96}$/

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  const json = (body: unknown, init: ResponseInit = {}) =>
    NextResponse.json(body, jsonWithRequestId(requestId, init))

  try {
    if (process.env.NODE_ENV !== "test") {
      const address = getLoginClientAddress(request)
      const clientKey = address ? hashRateLimitKeyPart(address) : "unknown-client"
      const rateLimit = await enforceRateLimit(`client-error:${clientKey}`, RATE_LIMIT)
      if (!rateLimit.allowed) {
        return json(
          { error: "Too many client error reports. Please try again shortly.", requestId },
          {
            status: 429,
            headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
          },
        )
      }
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
    const candidate = typeof input.digest === "string"
      ? input.digest.trim()
      : ""
    const digest = DIGEST_PATTERN.test(candidate) ? candidate : "unknown"

    void sendOperationalErrorTelemetry({
      event: "route_failed",
      requestId,
      path: "/api/telemetry/client-error",
      method: "POST",
      category: "client_error_boundary",
      error: digest,
    })

    return json({ accepted: true, requestId }, { status: 202 })
  } catch (error) {
    console.error("Client error telemetry failure", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    void sendOperationalErrorTelemetry({
      event: "route_failed",
      requestId,
      path: "/api/telemetry/client-error",
      method: "POST",
      category: "client_error_telemetry",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Unable to record client error", requestId }, { status: 503 })
  }
}
