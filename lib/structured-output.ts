import { escapeHtml } from "@/lib/sanitize-html"

export type StructuredOutputType = "proposal" | "pitch-deck"
export type StructuredOutputFormat = "structured-json" | "legacy-text"

type StructuredOutputResult = {
  content: string
  format: StructuredOutputFormat
}

type StructuredOutputInspection = {
  candidate: boolean
  valid: boolean
  value?: Record<string, unknown>
  errors: string[]
}

const MAX_TITLE_LENGTH = 500
const MAX_HEADING_LENGTH = 300
const MAX_TEXT_LENGTH = 20_000
const MAX_ITEM_LENGTH = 2_000
const MAX_SECTIONS = 50
const MAX_SLIDES = 50
const MAX_BULLETS = 20
const MAX_PRICING_ROWS = 20

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : []
}

function extractJsonCandidate(raw: string): string | null {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  if (fenced) return fenced
  if (!trimmed.startsWith("{")) return null

  const end = trimmed.lastIndexOf("}")
  if (end < 0) return trimmed
  return trimmed.slice(0, end + 1)
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const candidate = extractJsonCandidate(raw)
  if (!candidate || !candidate.startsWith("{") || !candidate.endsWith("}")) return null

  try {
    const parsed: unknown = JSON.parse(candidate)
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function validateBoundedString(
  value: unknown,
  field: string,
  maxLength: number,
  errors: string[],
  required = false,
) {
  if (typeof value !== "string" || value.trim().length === 0) {
    if (required) errors.push(`${field} is required`)
    return
  }
  if (value.trim().length > maxLength) errors.push(`${field} exceeds ${maxLength} characters`)
}

function validateStringList(value: unknown, field: string, errors: string[], required = false) {
  if (!Array.isArray(value)) {
    if (required) errors.push(`${field} must be an array`)
    return
  }

  if (value.length > MAX_BULLETS) errors.push(`${field} must contain ${MAX_BULLETS} items or fewer`)
  value.forEach((item, index) => validateBoundedString(item, `${field}[${index}]`, MAX_ITEM_LENGTH, errors, true))
}

function validatePricing(value: unknown, errors: string[]) {
  if (value === undefined) return
  if (!Array.isArray(value)) {
    errors.push("pricing must be an array")
    return
  }
  if (value.length > MAX_PRICING_ROWS) errors.push(`pricing must contain ${MAX_PRICING_ROWS} items or fewer`)

  value.forEach((item, index) => {
    const field = `pricing[${index}]`
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${field} must be an object`)
      return
    }
    const record = item as Record<string, unknown>
    validateBoundedString(record.item, `${field}.item`, MAX_ITEM_LENGTH, errors, true)
    validateBoundedString(record.description, `${field}.description`, MAX_ITEM_LENGTH, errors)
    validateBoundedString(record.amount, `${field}.amount`, MAX_ITEM_LENGTH, errors, true)
  })
}

function validateProposal(value: Record<string, unknown>): string[] {
  const errors: string[] = []
  validateBoundedString(value.title, "title", MAX_TITLE_LENGTH, errors, true)
  validateBoundedString(value.executiveSummary, "executiveSummary", MAX_TEXT_LENGTH, errors, true)
  validatePricing(value.pricing, errors)

  if (!Array.isArray(value.sections)) {
    errors.push("sections must be an array")
    return errors
  }
  if (value.sections.length === 0) errors.push("sections must contain at least one section")
  if (value.sections.length > MAX_SECTIONS) errors.push(`sections must contain ${MAX_SECTIONS} items or fewer`)

  value.sections.forEach((section, index) => {
    const field = `sections[${index}]`
    if (!section || typeof section !== "object" || Array.isArray(section)) {
      errors.push(`${field} must be an object`)
      return
    }

    const record = section as Record<string, unknown>
    const heading = record.heading ?? record.title
    const body = record.body ?? record.content
    validateBoundedString(heading, `${field}.heading`, MAX_HEADING_LENGTH, errors, true)
    validateBoundedString(body, `${field}.body`, MAX_TEXT_LENGTH, errors)
    validateStringList(record.bullets, `${field}.bullets`, errors)

    const hasBody = typeof body === "string" && body.trim().length > 0
    const bullets = asStringArray(record.bullets)
    if (!hasBody && bullets.length === 0) errors.push(`${field} must include body or bullets`)
  })

  return errors
}

function validatePitchDeck(value: Record<string, unknown>): string[] {
  const errors: string[] = []
  validateBoundedString(value.company, "company", MAX_TITLE_LENGTH, errors)
  validateBoundedString(value.tagline, "tagline", MAX_TITLE_LENGTH, errors)

  if (!Array.isArray(value.slides)) {
    errors.push("slides must be an array")
    return errors
  }
  if (value.slides.length === 0) errors.push("slides must contain at least one slide")
  if (value.slides.length > MAX_SLIDES) errors.push(`slides must contain ${MAX_SLIDES} items or fewer`)

  value.slides.forEach((slide, index) => {
    const field = `slides[${index}]`
    if (!slide || typeof slide !== "object" || Array.isArray(slide)) {
      errors.push(`${field} must be an object`)
      return
    }

    const record = slide as Record<string, unknown>
    validateBoundedString(record.title, `${field}.title`, MAX_TITLE_LENGTH, errors, true)
    validateStringList(record.bullets, `${field}.bullets`, errors)
    validateBoundedString(record.visualSuggestion, `${field}.visualSuggestion`, MAX_TEXT_LENGTH, errors)
    validateBoundedString(record.speakerNotes, `${field}.speakerNotes`, MAX_TEXT_LENGTH, errors)

    const hasBullets = asStringArray(record.bullets).length > 0
    const hasVisual = asString(record.visualSuggestion) !== null
    const hasNotes = asString(record.speakerNotes) !== null
    if (!hasBullets && !hasVisual && !hasNotes) errors.push(`${field} must include bullets, visualSuggestion, or speakerNotes`)
  })

  return errors
}

/**
 * Inspect only responses that look like the structured contract. Plain
 * markdown/text remains a supported legacy response and is not treated as a
 * malformed JSON attempt.
 */
export function inspectStructuredOutput(raw: string, type: StructuredOutputType): StructuredOutputInspection {
  const candidate = Boolean(extractJsonCandidate(raw))
  if (!candidate) return { candidate: false, valid: false, errors: [] }

  const parsed = parseJsonObject(raw)
  if (!parsed) return { candidate: true, valid: false, errors: ["response is not valid JSON"] }

  const errors = type === "proposal" ? validateProposal(parsed) : validatePitchDeck(parsed)
  return { candidate: true, valid: errors.length === 0, value: parsed, errors }
}

function proposalFromJson(value: Record<string, unknown>): string | null {
  const inspection = inspectStructuredOutput(JSON.stringify(value), "proposal")
  if (!inspection.valid) return null

  const title = asString(value.title)
  const executiveSummary = asString(value.executiveSummary)
  const sections = Array.isArray(value.sections)
    ? value.sections.map((section) => {
        const record = section as Record<string, unknown>
        const heading = asString(record.heading) || asString(record.title)
        const body = asString(record.body) || asString(record.content)
        const bullets = asStringArray(record.bullets)
        return `${heading ? `## ${heading}\n\n` : ""}${body || ""}${bullets.length ? `\n\n${bullets.map((bullet) => `- ${bullet}`).join("\n")}` : ""}`
      })
    : []

  const pricing = Array.isArray(value.pricing)
    ? value.pricing
        .map((item) => item as Record<string, unknown>)
        .map((item) => [asString(item.item), asString(item.description), asString(item.amount)] as const)
        .filter((row): row is [string, string | null, string] => Boolean(row[0] && row[2]))
    : []
  const pricingTable = pricing.length > 0
    ? [
        "## Pricing",
        "",
        "| Item | Description | Amount |",
        "| --- | --- | ---: |",
        ...pricing.map(([item, description, amount]) => `| ${escapeMarkdownTableCell(item)} | ${escapeMarkdownTableCell(description || "")} | ${escapeMarkdownTableCell(amount)} |`),
      ].join("\n")
    : null

  return [
    `# ${title}`,
    `## Executive Summary\n\n${executiveSummary}`,
    ...sections,
    pricingTable,
  ].filter(Boolean).join("\n\n")
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ")
}

function pitchDeckFromJson(value: Record<string, unknown>): string | null {
  const inspection = inspectStructuredOutput(JSON.stringify(value), "pitch-deck")
  if (!inspection.valid || !Array.isArray(value.slides)) return null

  return value.slides.map((slide) => {
    const record = slide as Record<string, unknown>
    const title = asString(record.title) || "Slide"
    const bullets = asStringArray(record.bullets)
    const visualSuggestion = asString(record.visualSuggestion)
    const speakerNotes = asString(record.speakerNotes)
    return `<div class="slide"><h1>${escapeHtml(title)}</h1>${bullets.length ? `<ul>${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}${visualSuggestion ? `<div class="visual-elements"><h3>Visual direction</h3><p>${escapeHtml(visualSuggestion)}</p></div>` : ""}${speakerNotes ? `<div class="speaker-notes"><h3>Speaker notes</h3><p>${escapeHtml(speakerNotes)}</p></div>` : ""}</div>`
  }).join("\n")
}

export function normalizeStructuredOutput(raw: string, type: StructuredOutputType): StructuredOutputResult {
  const inspection = inspectStructuredOutput(raw, type)
  if (inspection.valid && inspection.value) {
    const content = type === "proposal" ? proposalFromJson(inspection.value) : pitchDeckFromJson(inspection.value)
    if (content) return { content, format: "structured-json" }
  }

  return { content: raw, format: "legacy-text" }
}
