import { headers } from "next/headers"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,96}$/

export async function getServerRequestId(): Promise<string> {
  try {
    const requestHeaders = await headers()
    const candidate = requestHeaders.get("x-request-id")?.trim()
    return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : "unknown"
  } catch {
    // Static rendering, tests, and non-request contexts do not have headers.
    return "unknown"
  }
}

export function reportServerRouteError(input: {
  requestId: string
  path: string
  category: string
  error: unknown
}): void {
  const errorName = input.error instanceof Error ? input.error.name.slice(0, 64) : "unknown"
  const requestId = REQUEST_ID_PATTERN.test(input.requestId) ? input.requestId : "unknown"
  const path = input.path.split("?", 1)[0].slice(0, 256) || "/"
  const category = input.category.slice(0, 64)

  console.error("Server route fallback", { requestId, path, category, error: errorName })
  void sendOperationalErrorTelemetry({
    event: "route_failed",
    requestId,
    path,
    method: "GET",
    category,
    error: errorName,
  })
}
