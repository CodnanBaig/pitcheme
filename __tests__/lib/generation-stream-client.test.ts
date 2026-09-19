jest.mock("@/lib/auth-api", () => ({
  AuthApiError: class AuthApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
  authenticatedFetch: jest.fn(),
}))

import { authenticatedFetch } from "@/lib/auth-api"
import { streamGeneration } from "@/lib/generation-stream-client"

const mockAuthenticatedFetch = authenticatedFetch as jest.MockedFunction<typeof authenticatedFetch>

function streamResponse(events: unknown[]) {
  const body = events.map((event) => `event: ${String((event as { type: string }).type)}\ndata: ${JSON.stringify(event)}\n\n`).join("")
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } })
}

describe("streamGeneration", () => {
  beforeEach(() => jest.clearAllMocks())

  it("consumes stage/delta events and returns the completed payload", async () => {
    mockAuthenticatedFetch.mockResolvedValue(streamResponse([
      { type: "started", requestId: "req-1", stage: "queued" },
      { type: "stage", requestId: "req-1", stage: "provider" },
      { type: "delta", requestId: "req-1", text: "draft" },
      { type: "completed", requestId: "req-1", status: 200, payload: { id: "doc-1" } },
    ]))
    const events: string[] = []

    const result = await streamGeneration<{ id: string }>("/api/generate/proposal/stream", { clientName: "Acme" }, {
      onEvent: (event) => events.push(event.type),
    })

    expect(result).toEqual({ id: "doc-1" })
    expect(events).toEqual(["started", "stage", "delta", "completed"])
    expect(mockAuthenticatedFetch).toHaveBeenCalledWith("/api/generate/proposal/stream", expect.objectContaining({
      method: "POST",
      headers: { Accept: "text/event-stream" },
    }))
  })

  it("surfaces streamed errors as authenticated API errors", async () => {
    mockAuthenticatedFetch.mockResolvedValue(streamResponse([
      { type: "started", requestId: "req-2", stage: "queued" },
      { type: "error", requestId: "req-2", status: 429, payload: { error: "Too many requests" } },
    ]))

    await expect(streamGeneration("/api/generate/proposal/stream", {})).rejects.toMatchObject({
      message: "Too many requests",
      status: 429,
    })
  })

  it("refreshes the session once when a stream reports unauthorized", async () => {
    mockAuthenticatedFetch
      .mockResolvedValueOnce(streamResponse([
        { type: "started", requestId: "req-3", stage: "queued" },
        { type: "error", requestId: "req-3", status: 401, payload: { error: "Unauthorized" } },
      ]))
      .mockResolvedValueOnce(streamResponse([
        { type: "started", requestId: "req-4", stage: "queued" },
        { type: "completed", requestId: "req-4", status: 200, payload: { id: "doc-2" } },
      ]))
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }))

    await expect(streamGeneration<{ id: string }>("/api/generate/proposal/stream", {})).resolves.toEqual({ id: "doc-2" })
    expect(fetchSpy).toHaveBeenCalledWith("/api/auth/session", expect.objectContaining({
      method: "GET",
      credentials: "include",
    }))
    expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(2)

    fetchSpy.mockRestore()
  })
})
