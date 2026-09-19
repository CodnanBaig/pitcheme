export type RequestErrorTelemetry = {
  requestId: string
  path: string
  method: string
  routerKind: string
  routePath: string
  routeType: string
  renderSource?: string
  revalidateReason?: string
  error: string
}

export type OperationalErrorTelemetry = {
  event: "generation_failed" | "export_failed" | "auth_failed" | "stripe_failed" | "route_failed"
  requestId: string
  path: string
  method: string
  category: string
  error: string
}

type RequestErrorEvent = RequestErrorTelemetry & { event: "unhandled_request_error" }
type MonitoringEvent = RequestErrorEvent | OperationalErrorTelemetry

const ERROR_MONITORING_TIMEOUT_MS = 1_500
const MAX_ERROR_MONITORING_EVENT_BYTES = 8 * 1024

function monitoringEndpoint(): string | undefined {
  const candidate = process.env.ERROR_MONITORING_WEBHOOK_URL?.trim()
  if (!candidate || candidate.length > 2_048) return undefined

  try {
    const url = new URL(candidate)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

function normalizeEvent(event: MonitoringEvent) {
  return {
    ...event,
    requestId: event.requestId.slice(0, 96),
    path: event.path.split("?", 1)[0].slice(0, 256) || "/",
    method: event.method.slice(0, 16),
    error: event.error.slice(0, 64),
    ...("category" in event ? { category: event.category.slice(0, 64) } : {}),
  }
}

async function sendMonitoringEvent(event: MonitoringEvent): Promise<void> {
  const endpoint = monitoringEndpoint()
  if (!endpoint || typeof fetch !== "function") return

  const normalized = normalizeEvent(event)
  const payload = JSON.stringify({
    source: "pitchgenie",
    ...normalized,
  })
  if (new TextEncoder().encode(payload).byteLength > MAX_ERROR_MONITORING_EVENT_BYTES) return

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": normalized.requestId,
      },
      body: payload,
      signal: AbortSignal.timeout(ERROR_MONITORING_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`monitoring_http_${response.status}`)
  } catch (error) {
    console.warn("Error monitoring delivery unavailable", {
      requestId: normalized.requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
  }
}

/**
 * Forward only bounded operational context to an optional monitoring sink.
 * Delivery is best-effort and never blocks or fails the original request.
 */
export async function sendRequestErrorTelemetry(event: RequestErrorTelemetry): Promise<void> {
  return sendMonitoringEvent({ event: "unhandled_request_error", ...event })
}

/**
 * Forward bounded failures from critical product routes without adding user
 * payloads, provider messages, document content, or account identifiers.
 */
export async function sendOperationalErrorTelemetry(event: OperationalErrorTelemetry): Promise<void> {
  return sendMonitoringEvent(event)
}
