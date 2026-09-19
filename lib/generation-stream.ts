import { type NextRequest, type NextResponse } from "next/server"
import { getRequestId } from "@/lib/request-id"
import { withGenerationProgress, type GenerationStage } from "@/lib/generation-progress"
import { readBoundedJsonResponse } from "@/lib/bounded-json"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"

type GenerationRoute = (request: NextRequest) => Promise<NextResponse>

type StreamEvent = {
  type: "started" | "stage" | "delta" | "completed" | "error"
  requestId: string
  stage?: GenerationStage
  text?: string
  status?: number
  payload?: unknown
}

function writeEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: StreamEvent,
): void {
  controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`))
}

/**
 * Wrap an existing JSON generation route in a progress stream. The wrapped
 * route remains the source of truth for auth, validation, quota, persistence,
 * and errors; this adapter only adds an opt-in event-stream transport.
 */
export function createGenerationStream(request: NextRequest, route: GenerationRoute): Response {
  const requestId = getRequestId(request)
  const encoder = new TextEncoder()
  const streamAbortController = new AbortController()
  const abortSignal = AbortSignal.any([request.signal, streamAbortController.signal])
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: StreamEvent) => {
        if (!closed) writeEvent(controller, encoder, event)
      }

      send({ type: "started", requestId, stage: "queued" })

      void withGenerationProgress(
        {
          signal: abortSignal,
          onStage: (stage) => send({ type: "stage", requestId, stage }),
          onTextDelta: (text) => send({ type: "delta", requestId, text }),
        },
        async () => {
          try {
            const response = await route(request)
            const payload = await readBoundedJsonResponse(response)
            if (response.ok) send({ type: "stage", requestId, stage: "completed" })
            send({
              type: response.ok ? "completed" : "error",
              requestId,
              status: response.status,
              payload,
            })
          } catch (error) {
            void sendOperationalErrorTelemetry({
              event: "generation_failed",
              requestId,
              path: new URL(request.url).pathname,
              method: request.method,
              category: "stream",
              error: error instanceof Error ? error.name : "unknown",
            })
            send({
              type: "error",
              requestId,
              status: 500,
              payload: { error: "Generation stream failed", requestId },
            })
          } finally {
            if (!closed) {
              closed = true
              controller.close()
            }
          }
        },
      )
    },
    cancel() {
      closed = true
      streamAbortController.abort()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Request-ID": requestId,
      "X-Accel-Buffering": "no",
      Vary: "Accept",
    },
  })
}
