import { createHash } from "node:crypto"

export type DocumentRevisionInput = {
  clientName: string | null
  clientCompany: string | null
  projectTitle: string | null
  content: string
  metadata?: string | null
}

/**
 * Produce a stable, non-sensitive optimistic-concurrency token for a
 * document's editable state. The token contains no document content and is
 * safe to return as an HTTP ETag.
 */
export function getDocumentRevision(document: DocumentRevisionInput): string {
  const canonical = JSON.stringify([
    document.clientName,
    document.clientCompany,
    document.projectTitle,
    document.content,
    document.metadata ?? null,
  ])

  return createHash("sha256").update(canonical).digest("hex")
}

export function getIfMatchRevision(request: Request): string | null {
  const value = request.headers.get("if-match")?.trim()
  if (!value || value === "*") return null

  const unquoted = value.replace(/^"|"$/g, "")
  return /^[a-f0-9]{64}$/i.test(unquoted) ? unquoted.toLowerCase() : null
}

export function revisionHeaders(revision: string): Headers {
  const headers = new Headers()
  headers.set("ETag", `"${revision}"`)
  return headers
}
