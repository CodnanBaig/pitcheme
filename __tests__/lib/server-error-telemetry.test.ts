jest.mock("next/headers", () => ({ headers: jest.fn() }))
jest.mock("@/lib/error-monitoring", () => ({
  sendOperationalErrorTelemetry: jest.fn(),
}))

import { headers } from "next/headers"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"
import { getServerRequestId, reportServerRouteError } from "@/lib/server-error-telemetry"

const mockHeaders = headers as jest.MockedFunction<typeof headers>
const mockSendOperationalErrorTelemetry = sendOperationalErrorTelemetry as jest.MockedFunction<typeof sendOperationalErrorTelemetry>

describe("server error telemetry", () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    jest.clearAllMocks()
    console.error = jest.fn()
  })

  afterAll(() => {
    console.error = originalConsoleError
  })

  it("uses only a bounded request ID from request headers", async () => {
    mockHeaders.mockResolvedValue(new Headers({ "x-request-id": "request-42" }))

    await expect(getServerRequestId()).resolves.toBe("request-42")
  })

  it("falls back when request headers are unavailable or malformed", async () => {
    mockHeaders.mockRejectedValue(new Error("outside request scope"))
    await expect(getServerRequestId()).resolves.toBe("unknown")

    mockHeaders.mockResolvedValue(new Headers({ "x-request-id": "private value" }))
    await expect(getServerRequestId()).resolves.toBe("unknown")
  })

  it("reports an error class without forwarding private exception details", () => {
    reportServerRouteError({
      requestId: "request-42",
      path: "/dashboard?tab=private",
      category: "dashboard-data",
      error: new Error("customer brief should never be logged"),
    })

    expect(mockSendOperationalErrorTelemetry).toHaveBeenCalledWith({
      event: "route_failed",
      requestId: "request-42",
      path: "/dashboard",
      method: "GET",
      category: "dashboard-data",
      error: "Error",
    })
    expect(JSON.stringify(mockSendOperationalErrorTelemetry.mock.calls)).not.toContain("customer brief")
  })
})
