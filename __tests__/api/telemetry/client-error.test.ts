jest.mock("@/lib/error-monitoring", () => ({
  sendOperationalErrorTelemetry: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from "next/server"
import { POST } from "@/app/api/telemetry/client-error/route"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"

const mockOperationalTelemetry = sendOperationalErrorTelemetry as jest.MockedFunction<typeof sendOperationalErrorTelemetry>

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/telemetry/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/telemetry/client-error", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("accepts a bounded framework digest without forwarding exception text", async () => {
    const response = await POST(request({
      digest: "incident-123456789",
      message: "private provider response must not be forwarded",
    }))
    const payload = await response.json()

    expect(response.status).toBe(202)
    expect(response.headers.get("X-Request-ID")).toEqual(expect.any(String))
    expect(payload).toEqual({ accepted: true, requestId: expect.any(String) })
    expect(mockOperationalTelemetry).toHaveBeenCalledWith({
      event: "route_failed",
      requestId: expect.any(String),
      path: "/api/telemetry/client-error",
      method: "POST",
      category: "client_error_boundary",
      error: "incident-123456789",
    })
    expect(JSON.stringify(mockOperationalTelemetry.mock.calls[0][0])).not.toContain("private provider response")
  })

  it("normalizes an untrusted digest before telemetry delivery", async () => {
    const response = await POST(request({ digest: "private content with spaces" }))

    expect(response.status).toBe(202)
    expect(mockOperationalTelemetry).toHaveBeenCalledWith(expect.objectContaining({ error: "unknown" }))
  })

  it("rejects malformed and oversized bodies before reporting", async () => {
    const malformed = new NextRequest("http://localhost:3000/api/telemetry/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    })
    expect((await POST(malformed)).status).toBe(400)

    const oversized = await POST(request({ digest: "x".repeat(3_000) }))
    expect(oversized.status).toBe(413)
    expect(mockOperationalTelemetry).not.toHaveBeenCalled()
  })
})
