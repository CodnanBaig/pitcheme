/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import ApplicationErrorBoundary from "@/app/error"

describe("application error boundary", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("offers a retry path and keeps exception text out of the UI", () => {
    const reset = jest.fn()
    const error = Object.assign(new Error("private provider response"), { digest: "incident-123456789" })

    render(<ApplicationErrorBoundary error={error} reset={reset} />)

    expect(screen.getByRole("heading", { name: "We couldn't finish that request." })).toBeInTheDocument()
    expect(screen.getByText("Incident reference:")).toBeInTheDocument()
    expect(screen.getByText("incident-123")).toBeInTheDocument()
    expect(screen.queryByText("private provider response")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it("falls back to a safe incident reference when no digest is supplied", () => {
    render(<ApplicationErrorBoundary error={new Error("hidden details")} reset={jest.fn()} />)

    expect(screen.getByText("unavailable")).toBeInTheDocument()
    expect(screen.queryByText("hidden details")).not.toBeInTheDocument()
  })

  it("reports only a bounded digest from the production boundary", async () => {
    const originalNodeEnv = process.env.NODE_ENV
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 202 } as Response)
    process.env.NODE_ENV = "production"

    try {
      render(<ApplicationErrorBoundary error={Object.assign(new Error("private details"), { digest: "incident-123456789" })} reset={jest.fn()} />)

      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toBe("/api/telemetry/client-error")
      expect(init).toMatchObject({ method: "POST", credentials: "same-origin", keepalive: true })
      expect(JSON.parse(String(init?.body))).toEqual({ digest: "incident-123456789" })
      expect(String(init?.body)).not.toContain("private details")
    } finally {
      process.env.NODE_ENV = originalNodeEnv
      fetchSpy.mockRestore()
    }
  })
})
