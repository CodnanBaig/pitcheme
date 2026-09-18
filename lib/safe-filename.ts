const MAX_FILENAME_LENGTH = 120

/**
 * Convert user- or model-provided text into a portable attachment filename.
 *
 * Only ASCII letters, numbers, underscores, and hyphens are retained. Runs of
 * punctuation/whitespace collapse to one underscore so filenames remain easy
 * to scan and cannot introduce path separators or control characters.
 */
export function safeFilename(value: string | null | undefined, fallback: string): string {
  const sanitized = (value || "")
    .normalize("NFKC")
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, MAX_FILENAME_LENGTH)

  return sanitized || fallback
}
