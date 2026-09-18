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
  return { ...init, headers }
}
