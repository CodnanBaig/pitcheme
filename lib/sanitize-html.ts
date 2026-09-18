import sanitizeHtml from "sanitize-html"

const allowedTags = [
  "br",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "li",
  "ol",
  "p",
  "section",
  "span",
  "strong",
  "ul",
]

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Keep model-generated slide markup within the export renderer's safe subset. */
export function sanitizeGeneratedHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags,
    allowedAttributes: {
      "*": ["class"],
    },
    disallowedTagsMode: "discard",
  })
}
