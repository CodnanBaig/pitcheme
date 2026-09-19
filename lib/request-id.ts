import { randomUUID } from "node:crypto"

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,96}$/

export function getRequestId(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim()
  return supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : randomUUID()
}

export function jsonWithRequestId(
  requestId: string,
  init: ResponseInit = {},
): ResponseInit {
  const headers = new Headers(init.headers)
  headers.set("X-Request-ID", requestId)
  // API responses may contain authenticated or generated document data. Keep
  // them out of browser and intermediary caches unless a route explicitly
  // returns a non-API response.
  headers.set("Cache-Control", "no-store")
  return { ...init, headers }
}
