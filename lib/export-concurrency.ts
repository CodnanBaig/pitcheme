import { acquireConcurrencySlot } from "@/lib/concurrency-limit"

/**
 * PDF/DOCX exports are materially more expensive than ordinary API reads.
 * Keep a single account from opening multiple Chromium processes and bound
 * the total number of export jobs handled by one application instance.
 */
export const EXPORT_CONCURRENCY_LIMIT = 2

export function acquireExportConcurrencySlot(userId: string): (() => void) | null {
  const userRelease = acquireConcurrencySlot(`document-export:user:${userId}`)
  if (!userRelease) return null

  const globalRelease = acquireConcurrencySlot("document-export:global", EXPORT_CONCURRENCY_LIMIT)
  if (!globalRelease) {
    userRelease()
    return null
  }

  let released = false
  return () => {
    if (released) return
    released = true
    globalRelease()
    userRelease()
  }
}
