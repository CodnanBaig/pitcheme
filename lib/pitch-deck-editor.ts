import { escapeHtml } from "@/lib/sanitize-html"

export type EditablePitchSlide = {
  title: string
  bullets: string[]
  visualSuggestion: string
  speakerNotes: string
}

const MAX_SLIDES = 50
const MAX_BULLETS = 20

/**
 * Read the sanitized slide markup produced by the structured-output renderer.
 * Legacy markdown/text is deliberately returned as null so the existing raw
 * editor remains available for older documents.
 */
export function parsePitchDeckSlides(content: string): EditablePitchSlide[] | null {
  if (typeof DOMParser === "undefined" || !content.includes('class="slide"')) return null

  const parsed = new DOMParser().parseFromString(`<div id="pitch-deck-root">${content}</div>`, "text/html")
  const root = parsed.getElementById("pitch-deck-root")
  if (!root) return null

  const slideElements = Array.from(root.children).filter((element) => element.classList.contains("slide"))
  if (slideElements.length === 0 || slideElements.length > MAX_SLIDES) return null

  const slides = slideElements.map((slide) => ({
    title: slide.querySelector("h1, h2, h3")?.textContent?.trim() || "",
    bullets: Array.from(slide.querySelectorAll("ul > li"))
      .map((bullet) => bullet.textContent?.trim() || "")
      .filter(Boolean)
      .slice(0, MAX_BULLETS),
    visualSuggestion: slide.querySelector(".visual-elements p")?.textContent?.trim() || "",
    speakerNotes: slide.querySelector(".speaker-notes p")?.textContent?.trim() || "",
  }))

  return slides.every((slide) => slide.title.length > 0) ? slides : null
}

export function serializePitchDeckSlides(slides: EditablePitchSlide[]): string {
  return slides.map((slide) => {
    const title = escapeHtml(slide.title.trim())
    const bullets = slide.bullets
      .map((bullet) => bullet.trim())
      .filter(Boolean)
      .slice(0, MAX_BULLETS)
      .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
      .join("")
    const visualSuggestion = slide.visualSuggestion.trim()
    const speakerNotes = slide.speakerNotes.trim()

    return `<div class="slide"><h1>${title}</h1>${bullets ? `<ul>${bullets}</ul>` : ""}${visualSuggestion ? `<div class="visual-elements"><h3>Visual direction</h3><p>${escapeHtml(visualSuggestion)}</p></div>` : ""}${speakerNotes ? `<div class="speaker-notes"><h3>Speaker notes</h3><p>${escapeHtml(speakerNotes)}</p></div>` : ""}</div>`
  }).join("\n")
}
