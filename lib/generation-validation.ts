export type GenerationBody = Record<string, unknown>
export type GenerationKind = "proposal" | "pitch-deck"

export type GenerationValidationResult =
  | { valid: true; data: GenerationBody }
  | { valid: false; errors: string[] }

function isRecord(value: unknown): value is GenerationBody {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\r\n?/g, "\n").trim()
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeValue(item))
      .filter((item) => !(typeof item === "string" && item.length === 0))
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, nestedValue]) => [key, normalizeValue(nestedValue)] as const)
        .filter(([, nestedValue]) => {
          if (typeof nestedValue === "string") return nestedValue.length > 0
          if (Array.isArray(nestedValue)) return nestedValue.length > 0
          return nestedValue !== undefined && nestedValue !== null
        }),
    )
  }

  return value
}

const MAX_REQUEST_BYTES = 64 * 1024
const MAX_TEXT_LENGTH = 10_000
const MAX_ARRAY_ITEMS = 50

function validateTextLimits(body: GenerationBody): string[] {
  const errors: string[] = []

  if (JSON.stringify(body).length > MAX_REQUEST_BYTES) {
    errors.push("request body must be 64 KB or smaller")
  }

  const visit = (value: unknown, path: string) => {
    if (typeof value === "string") {
      if (value.length > MAX_TEXT_LENGTH) {
        errors.push(`${path} must be ${MAX_TEXT_LENGTH} characters or fewer`)
      }
      return
    }

    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY_ITEMS) {
        errors.push(`${path} must contain ${MAX_ARRAY_ITEMS} items or fewer`)
      }
      value.forEach((item, index) => visit(item, `${path}[${index}]`))
      return
    }

    if (isRecord(value)) {
      Object.entries(value).forEach(([key, nestedValue]) => {
        visit(nestedValue, path ? `${path}.${key}` : key)
      })
    }
  }

  visit(body, "")

  return errors
}

export function validateGenerationBody(
  value: unknown,
  requiredFields: string[],
): GenerationValidationResult {
  if (!isRecord(value)) {
    return { valid: false, errors: ["body must be a JSON object"] }
  }

  const errors = requiredFields.flatMap((field) => {
    const fieldValue = value[field]
    return typeof fieldValue === "string" && fieldValue.trim().length > 0
      ? []
      : [`${field} is required`]
  })

  errors.push(...validateTextLimits(value))

  const fieldSpecificData = value.fieldSpecificData
  if (
    fieldSpecificData !== undefined
    && (typeof fieldSpecificData !== "object" || fieldSpecificData === null || Array.isArray(fieldSpecificData))
  ) {
    errors.push("fieldSpecificData must be an object")
  }

  if (isRecord(fieldSpecificData)) {
    Object.entries(fieldSpecificData).forEach(([field, fieldValue]) => {
      if (typeof fieldValue === "string") return
      if (!Array.isArray(fieldValue)) {
        errors.push(`fieldSpecificData.${field} must be a string or array of strings`)
        return
      }
      if (fieldValue.some((item) => typeof item !== "string")) {
        errors.push(`fieldSpecificData.${field} must contain only strings`)
      }
    })
  }

  return errors.length > 0
    ? { valid: false, errors }
    : { valid: true, data: value }
}

/**
 * Canonicalize user-entered generation data before it is passed to prompts or
 * persisted as metadata. Empty optional values are removed, while arrays and
 * nested field-specific values keep their shape.
 */
export function normalizeGenerationBody(value: GenerationBody): GenerationBody {
  return normalizeValue(value) as GenerationBody
}

const MINIMUM_BRIEF_LENGTHS: Record<GenerationKind, Record<string, number>> = {
  proposal: {
    clientName: 2,
    projectDescription: 12,
    goals: 8,
  },
  "pitch-deck": {
    startupName: 2,
    problem: 12,
    solution: 12,
    market: 8,
  },
}

const PLACEHOLDER_BRIEFS = new Set(["n/a", "na", "none", "unknown", "tbd", "..."])

function meaningfulLength(value: string): number {
  return value.replace(/[^\p{L}\p{N}]+/gu, "").length
}

/** Reject input that is technically non-empty but cannot produce a useful brief. */
export function validateGenerationBrief(body: GenerationBody, kind: GenerationKind): string[] {
  return Object.entries(MINIMUM_BRIEF_LENGTHS[kind]).flatMap(([field, minimum]) => {
    const value = body[field]
    if (typeof value !== "string") return []

    const normalized = value.trim().toLowerCase()
    if (PLACEHOLDER_BRIEFS.has(normalized)) {
      return [`${field} must contain meaningful information`]
    }
    if (meaningfulLength(value) < minimum) {
      return [`${field} must contain at least ${minimum} meaningful characters`]
    }
    return []
  })
}

const MODEL_PREFERENCES = new Set(["primary", "fallback", "lightweight", "visual"])

export function validateGenerationOptions(body: GenerationBody, kind: GenerationKind): string[] {
  const errors: string[] = []

  if (body.field !== undefined && (typeof body.field !== "string" || body.field.trim().length === 0)) {
    errors.push("field must be a non-empty string")
  }

  if (body.modelPreference !== undefined && (
    typeof body.modelPreference !== "string" || !MODEL_PREFERENCES.has(body.modelPreference)
  )) {
    errors.push("modelPreference is invalid")
  }

  if (kind === "pitch-deck") {
    if (body.visualMode !== undefined && typeof body.visualMode !== "boolean") {
      errors.push("visualMode must be a boolean")
    }
    if (body.exportFormat !== undefined && !["pdf", "html"].includes(String(body.exportFormat))) {
      errors.push("exportFormat is invalid")
    }
  }

  return errors
}
