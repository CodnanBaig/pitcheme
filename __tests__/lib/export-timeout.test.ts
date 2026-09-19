import { EXPORT_LAUNCH_TIMEOUT_MS, EXPORT_RENDER_TIMEOUT_MS, throwIfExportAborted, withExportTimeout } from "@/lib/export-timeout"

describe("export runtime deadlines", () => {
  it("keeps Chromium operations below the route budget", () => {
    expect(EXPORT_LAUNCH_TIMEOUT_MS).toBe(10_000)
    expect(EXPORT_RENDER_TIMEOUT_MS).toBe(20_000)
    expect(EXPORT_LAUNCH_TIMEOUT_MS + EXPORT_RENDER_TIMEOUT_MS * 2).toBeLessThan(60_000)
  })

  it("rejects an operation that exceeds the render deadline", async () => {
    await expect(withExportTimeout(new Promise<never>(() => undefined), 1)).rejects.toThrow("Export operation timed out")
  })

  it("raises an abort error for disconnected export requests", () => {
    const controller = new AbortController()
    controller.abort()

    expect(() => throwIfExportAborted(controller.signal)).toThrow("Export request aborted")
  })
})
