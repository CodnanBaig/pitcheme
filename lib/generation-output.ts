export type GeneratedDocumentType = "proposal" | "pitch-deck"

const MAX_GENERATED_CONTENT_LENGTH = 200_000

export function validateGeneratedContent(
  content: unknown,
  _type: GeneratedDocumentType,
): { valid: true; content: string } | { valid: false; error: string } {
  if (typeof content !== "string" || content.trim().length === 0) {
    return { valid: false, error: "AI provider returned empty content" }
  }

  if (content.length > MAX_GENERATED_CONTENT_LENGTH) {
    return { valid: false, error: "AI provider returned content that is too large" }
  }

  return { valid: true, content }
}
