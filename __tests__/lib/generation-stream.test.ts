import { NextRequest, NextResponse } from "next/server"
import { emitGenerationStage, emitGenerationTextDelta, getGenerationProgressSink } from "@/lib/generation-progress"
import { createGenerationStream } from "@/lib/generation-stream"

async function readEvents(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("stream body unavailable")
  const decoder = new TextDecoder()
  let body = ""
  while (true) {
    const { done, value } = await reader.read()
    body += decoder.decode(value || new Uint8Array(), { stream: !done })
    if (done) break
  }
  return body
    .split(/\r?\n\r?\n/)
    .filter(Boolean)
    .map((block) => JSON.parse(block.split("\n").find((line) => line.startsWith("data:"))!.slice(5).trim()))
}

describe("generation stream transport", () => {
  it("streams stages and preserves the wrapped route response", async () => {
    const request = new NextRequest("http://localhost:3000/api/generate/proposal/stream", { method: "POST", body: "{}" })
    const response = createGenerationStream(request, async () => {
      expect(getGenerationProgressSink()?.signal).toBeInstanceOf(AbortSignal)
      expect(getGenerationProgressSink()?.signal?.aborted).toBe(false)
      await emitGenerationStage("provider")
      await emitGenerationTextDelta("draft")
      return NextResponse.json({ id: "507f1f77bcf86cd799439011", status: "completed" })
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/event-stream")
    expect(response.headers.get("cache-control")).toContain("no-store")
    expect(response.headers.get("x-accel-buffering")).toBe("no")

    const events = await readEvents(response)
    expect(events.map((event) => event.type)).toEqual(["started", "stage", "delta", "stage", "completed"])
    expect(events[1]).toMatchObject({ stage: "provider" })
    expect(events[2]).toMatchObject({ text: "draft" })
    expect(events[4]).toMatchObject({ status: 200, payload: { id: "507f1f77bcf86cd799439011" } })
  })

  it("turns a wrapped route failure into a structured error event", async () => {
    const request = new NextRequest("http://localhost:3000/api/generate/proposal/stream", { method: "POST", body: "{}" })
    const response = createGenerationStream(request, async () => NextResponse.json({ error: "Invalid request" }, { status: 400 }))

    const events = await readEvents(response)
    expect(events.at(-1)).toMatchObject({ type: "error", status: 400, payload: { error: "Invalid request" } })
  })

  it("fails closed when a wrapped route response exceeds the JSON limit", async () => {
    const request = new NextRequest("http://localhost:3000/api/generate/proposal/stream", { method: "POST", body: "{}" })
    const response = createGenerationStream(request, async () => new NextResponse(
      JSON.stringify({ error: "x".repeat(1_048_576) }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    ))

    const events = await readEvents(response)
    expect(events.at(-1)).toMatchObject({
      type: "error",
      status: 500,
      payload: { error: "Generation stream failed" },
    })
  })

  it("aborts provider work when the consumer cancels the stream", async () => {
    const request = new NextRequest("http://localhost:3000/api/generate/proposal/stream", { method: "POST", body: "{}" })
    let resumeRoute!: () => void
    let resolveSignal!: (signal: AbortSignal) => void
    const signalReady = new Promise<AbortSignal>((resolve) => {
      resolveSignal = resolve
    })
    const routePaused = new Promise<void>((resolve) => {
      resumeRoute = resolve
    })
    const response = createGenerationStream(request, async () => {
      const signal = getGenerationProgressSink()?.signal
      if (!signal) throw new Error("missing generation signal")
      resolveSignal(signal)
      await routePaused
      return NextResponse.json({ id: "507f1f77bcf86cd799439011" })
    })

    const reader = response.body?.getReader()
    if (!reader) throw new Error("stream body unavailable")
    await reader.read()
    const signal = await signalReady
    await reader.cancel()
    expect(signal.aborted).toBe(true)
    resumeRoute()
  })
})
