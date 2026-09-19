import { sendRequestErrorTelemetry } from "@/lib/error-monitoring"

type RequestErrorRequest = {
  path: string
  method: string
  headers: Record<string, string | string[] | undefined>
}

type RequestErrorContext = {
  routerKind: "Pages Router" | "App Router"
  routePath: string
  routeType: "render" | "route" | "action" | "middleware"
  renderSource?: "react-server-components" | "react-server-components-payload" | "server-rendering"
  revalidateReason?: "on-demand" | "stale"
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,96}$/

function boundedPath(value: string): string {
  return value.split("?", 1)[0].slice(0, 256) || "/"
}

function safeRequestId(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : "unknown"
}

/**
 * Capture framework-level failures without logging exception messages, query
 * strings, request bodies, cookies, or other user-controlled payloads.
 * Deployments can forward this structured line to their log/error platform.
 */
export function onRequestError(
  error: unknown,
  request: RequestErrorRequest,
  context: RequestErrorContext,
): void {
  const telemetry = {
    requestId: safeRequestId(request.headers["x-request-id"]),
    path: boundedPath(request.path),
    method: request.method.slice(0, 16),
    routerKind: context.routerKind,
    routePath: boundedPath(context.routePath),
    routeType: context.routeType,
    ...(context.renderSource ? { renderSource: context.renderSource } : {}),
    ...(context.revalidateReason ? { revalidateReason: context.revalidateReason } : {}),
    error: error instanceof Error ? error.name.slice(0, 64) : "unknown",
  }

  console.error("Unhandled request error", telemetry)
  void sendRequestErrorTelemetry(telemetry)
}
