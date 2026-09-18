import { NextRequest } from "next/server"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"

describe("request IDs", () => {
  it("keeps a bounded, safe incoming request ID", () => {
    const request = new NextRequest("http://localhost", {
      headers: { "x-request-id": "trace-123:worker" },
    })

    expect(getRequestId(request)).toBe("trace-123:worker")
  })

  it("replaces malformed incoming IDs and preserves response headers", () => {
    const request = new NextRequest("http://localhost", {
      headers: { "x-request-id": "contains spaces and secrets" },
    })
    const requestId = getRequestId(request)
    const init = jsonWithRequestId(requestId, { status: 429, headers: { "Retry-After": "3" } })
    const headers = new Headers(init.headers)

    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(headers.get("X-Request-ID")).toBe(requestId)
    expect(headers.get("Retry-After")).toBe("3")
  })
})
