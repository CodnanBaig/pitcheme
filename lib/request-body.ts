export type JsonBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; reason: "too-large" | "invalid" }

export type TextBodyResult =
  | { ok: true; body: string }
  | { ok: false; reason: "too-large" | "invalid" }

type RequestBodyBytesResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: "too-large" | "invalid" }

async function readRequestBodyBytes(request: Request, maxBytes: number): Promise<RequestBodyBytesResult> {
  if (!Number.isFinite(maxBytes) || maxBytes < 0) return { ok: false, reason: "invalid" }

  const contentLength = request.headers.get("content-length")
  const declaredLength = contentLength === null ? null : Number(contentLength)
  if (declaredLength !== null && Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, reason: "too-large" }
  }

  if (!request.body) return { ok: false, reason: "invalid" }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, reason: "too-large" }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, reason: "invalid" }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return { ok: true, bytes }
}

/** Read a bounded UTF-8 request body without buffering beyond the route's cap. */
export async function readTextBody(request: Request, maxBytes: number): Promise<TextBodyResult> {
  const result = await readRequestBodyBytes(request, maxBytes)
  if (!result.ok) return result

  try {
    return { ok: true, body: new TextDecoder().decode(result.bytes) }
  } catch {
    return { ok: false, reason: "invalid" }
  }
}

/** Read and parse JSON without buffering more than the route's declared cap. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  const result = await readTextBody(request, maxBytes)
  if (!result.ok) return result

  try {
    return { ok: true, body: JSON.parse(result.body) }
  } catch {
    return { ok: false, reason: "invalid" }
  }
}
