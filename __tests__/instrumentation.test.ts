import { onRequestError } from "@/instrumentation"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"

describe("framework error instrumentation", () => {
  it("logs bounded context without exception text or query strings", () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined)

    try {
      onRequestError(
        new Error("private document contents must not be logged"),
        {
          path: "/api/documents?content=private",
          method: "POST",
          headers: { "x-request-id": "trace-123" },
        },
        {
          routerKind: "App Router",
          routePath: "/api/documents",
          routeType: "route",
        },
      )

      expect(log).toHaveBeenCalledWith("Unhandled request error", {
        requestId: "trace-123",
        path: "/api/documents",
        method: "POST",
        routerKind: "App Router",
        routePath: "/api/documents",
        routeType: "route",
        error: "Error",
      })
      expect(JSON.stringify(log.mock.calls[0])).not.toContain("private document contents")
      expect(JSON.stringify(log.mock.calls[0])).not.toContain("content=private")
    } finally {
      log.mockRestore()
    }
  })

  it("forwards bounded context to the optional monitoring webhook", async () => {
    const originalEndpoint = process.env.ERROR_MONITORING_WEBHOOK_URL
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 204 } as Response)
    process.env.ERROR_MONITORING_WEBHOOK_URL = "https://monitoring.example.test/events"

    try {
      onRequestError(
        new Error("private document contents must not be logged"),
        {
          path: "/api/documents?content=private",
          method: "POST",
          headers: { "x-request-id": "trace-456" },
        },
        {
          routerKind: "App Router",
          routePath: "/api/documents",
          routeType: "route",
        },
      )
      await new Promise((resolve) => setImmediate(resolve))

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [endpoint, request] = fetchSpy.mock.calls[0]
      expect(endpoint).toBe("https://monitoring.example.test/events")
      const body = String(request?.body)
      expect(JSON.parse(body)).toMatchObject({
        event: "unhandled_request_error",
        requestId: "trace-456",
        path: "/api/documents",
        error: "Error",
      })
      expect(body).not.toContain("private document contents")
      expect(body).not.toContain("content=private")
    } finally {
      if (originalEndpoint === undefined) delete process.env.ERROR_MONITORING_WEBHOOK_URL
      else process.env.ERROR_MONITORING_WEBHOOK_URL = originalEndpoint
      fetchSpy.mockRestore()
    }
  })

  it("forwards classified operational failures without private route data", async () => {
    const originalEndpoint = process.env.ERROR_MONITORING_WEBHOOK_URL
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 204 } as Response)
    process.env.ERROR_MONITORING_WEBHOOK_URL = "https://monitoring.example.test/events"

    try {
      await sendOperationalErrorTelemetry({
        event: "export_failed",
        requestId: "trace-export",
        path: "/api/export/proposal/private?content=secret",
        method: "GET",
        category: "chromium",
        error: "TimeoutError",
      })

      const [endpoint, request] = fetchSpy.mock.calls[0]
      expect(endpoint).toBe("https://monitoring.example.test/events")
      expect(JSON.parse(String(request?.body))).toEqual({
        source: "pitchgenie",
        event: "export_failed",
        requestId: "trace-export",
        path: "/api/export/proposal/private",
        method: "GET",
        category: "chromium",
        error: "TimeoutError",
      })
    } finally {
      if (originalEndpoint === undefined) delete process.env.ERROR_MONITORING_WEBHOOK_URL
      else process.env.ERROR_MONITORING_WEBHOOK_URL = originalEndpoint
      fetchSpy.mockRestore()
    }
  })
})
