import { DEFAULT_MAX_JSON_RESPONSE_BYTES, readBoundedJsonResponse } from "@/lib/bounded-json"

function streamResponse(body: Uint8Array, headers?: Headers): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(body)
      controller.close()
    },
  })
  return new Response(stream, { headers })
}

describe("bounded JSON responses", () => {
  it("parses a response within the configured limit", async () => {
    const payload = new TextEncoder().encode(JSON.stringify({ data: [{ id: "model" }] }))

    await expect(readBoundedJsonResponse(streamResponse(payload))).resolves.toEqual({
      data: [{ id: "model" }],
    })
  })

  it("rejects a response whose declared length exceeds the limit", async () => {
    const response = new Response("{}", {
      headers: { "content-length": String(DEFAULT_MAX_JSON_RESPONSE_BYTES + 1) },
    })

    await expect(readBoundedJsonResponse(response)).rejects.toThrow("JSON response is too large")
  })

  it("cancels a streamed response once it exceeds the limit", async () => {
    const payload = new TextEncoder().encode("x".repeat(DEFAULT_MAX_JSON_RESPONSE_BYTES + 1))

    await expect(readBoundedJsonResponse(streamResponse(payload))).rejects.toThrow("JSON response is too large")
  })
})
