export type GenerationBody = Record<string, unknown>
export type GenerationKind = "proposal" | "pitch-deck"
export type GenerationSafetyReason = "prompt-injection" | "unsafe-content"

export type GenerationValidationResult =
  | { valid: true; data: GenerationBody }
  | { valid: false; errors: string[] }

function isRecord(value: unknown): value is GenerationBody {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeValue(value: unknown): unknown {
  return normalizeValueAtDepth(value, 0)
}

const MAX_REQUEST_BYTES = 64 * 1024
const MAX_TEXT_LENGTH = 10_000
const MAX_ARRAY_ITEMS = 50
const MAX_NESTING_DEPTH = 32

function normalizeValueAtDepth(value: unknown, depth: number): unknown {
  if (depth > MAX_NESTING_DEPTH) return value

  if (typeof value === "string") {
    return value.replace(/\r\n?/g, "\n").trim()
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeValueAtDepth(item, depth + 1))
      .filter((item) => !(typeof item === "string" && item.length === 0))
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, nestedValue]) => [key, normalizeValueAtDepth(nestedValue, depth + 1)] as const)
        .filter(([, nestedValue]) => {
          if (typeof nestedValue === "string") return nestedValue.length > 0
          if (Array.isArray(nestedValue)) return nestedValue.length > 0
          return nestedValue !== undefined && nestedValue !== null
        }),
    )
  }

  return value
}

function validateTextLimits(body: GenerationBody): string[] {
  const errors: string[] = []

  const serializedBody = JSON.stringify(body)
  if (new TextEncoder().encode(serializedBody).byteLength > MAX_REQUEST_BYTES) {
    errors.push("request body must be 64 KB or smaller")
  }

  const visit = (value: unknown, path: string, depth: number) => {
    if (depth > MAX_NESTING_DEPTH) {
      errors.push(`request body nesting must be ${MAX_NESTING_DEPTH} levels or fewer`)
      return
    }

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
      value.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1))
      return
    }

    if (isRecord(value)) {
      Object.entries(value).forEach(([key, nestedValue]) => {
        visit(nestedValue, path ? `${path}.${key}` : key, depth + 1)
      })
    }
  }

  visit(body, "", 0)

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

/**
 * These patterns intentionally cover only high-confidence attempts to make
 * user-entered brief content behave like a system/developer instruction.
 * Normal business language should remain valid; the model prompt separately
 * labels all brief values as untrusted data.
 */
const PROMPT_INJECTION_PATTERNS = [
  /\b(?:ignore|disregard|forget|override|bypass|do not follow|don't follow)\b[\s\S]{0,80}\b(?:all|any|the|these|previous|prior|above|earlier|system|developer|assistant)?\s*(?:instructions?|prompt|rules?|messages?)\b/i,
  /\b(?:ignore|disregard|forget|override|bypass|do not follow|don't follow)\b[\s\S]{0,80}\b(?:instructions?|prompt|rules?|messages?)\b[\s\S]{0,24}\b(?:above|below|previous|prior|earlier)\b/i,
  /\b(?:reveal|show|print|output|expose|leak|repeat|quote)\b[\s\S]{0,80}\b(?:the\s+)?(?:system|developer|hidden|secret)\s+(?:prompt|message|instructions?|rules?)\b/i,
  /(?:<\s*(?:system|developer|assistant)\b|\[\s*(?:system|developer|assistant)\s*\]|\b(?:begin|end)\s+(?:system|developer)\s+(?:prompt|message)\b)/i,
  /\b(?:jailbreak|prompt\s+injection)\b/i,
]

/**
 * Block only explicit requests to create or deploy harmful tooling. The
 * action-and-object shape avoids blocking ordinary security, compliance, or
 * threat-intelligence briefs that describe a risk without asking the model to
 * produce it.
 */
const UNSAFE_CONTENT_PATTERNS = [
  /\b(?:create|write|build|deploy|execute|launch)\s+(?:a|an|the)?\s*(?:ransomware|keylogger|credential[- ]?stealer|phishing\s+kit|malware\s+payload|botnet|ddos\s+tool)\b/i,
  /\b(?:steal|harvest|exfiltrate)\s+(?:passwords?|credentials?|session\s+tokens?|private\s+keys?|personal\s+data)\b/i,
  /\b(?:bypass|evade)\s+(?:authentication|mfa|security\s+controls|fraud\s+detection)\b/i,
]

function looksLikePromptInjection(value: string): boolean {
  const normalized = value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()

  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalized))
}

function looksLikeUnsafeContent(value: string): boolean {
  const normalized = value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()

  return UNSAFE_CONTENT_PATTERNS.some((pattern) => pattern.test(normalized))
}

function validatePromptSafety(body: GenerationBody): string[] {
  const errors: string[] = []

  const visit = (value: unknown, path: string, depth: number) => {
    if (depth > MAX_NESTING_DEPTH) {
      errors.push(`${path || "brief"} exceeds the maximum nesting depth`)
      return
    }

    if (typeof value === "string") {
      if (looksLikePromptInjection(value)) {
        errors.push(`${path || "brief"} contains instructions that cannot be used as generation data`)
      } else if (looksLikeUnsafeContent(value)) {
        errors.push(`${path || "brief"} contains content that cannot be used for generation`)
      }
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1))
      return
    }

    if (isRecord(value)) {
      Object.entries(value).forEach(([key, nestedValue]) => visit(nestedValue, path ? `${path}.${key}` : key, depth + 1))
    }
  }

  visit(body, "", 0)
  return errors
}

function findGenerationSafetyReason(body: GenerationBody): GenerationSafetyReason | null {
  let reason: GenerationSafetyReason | null = null

  const visit = (value: unknown, depth: number) => {
    if (depth > MAX_NESTING_DEPTH) return
    if (typeof value === "string") {
      if (looksLikePromptInjection(value)) {
        // Prompt injection is the more specific reason when a brief contains
        // multiple blocked values; keep scanning until that precedence is set
        // so containsPromptInjection remains an any-match check.
        reason = "prompt-injection"
      } else if (!reason && looksLikeUnsafeContent(value)) {
        reason = "unsafe-content"
      }
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1))
      return
    }
    if (isRecord(value)) Object.values(value).forEach((item) => visit(item, depth + 1))
  }

  visit(body, 0)
  return reason
}

/** Detect a prompt-injection block without exposing the matched user text. */
export function containsPromptInjection(body: GenerationBody): boolean {
  return findGenerationSafetyReason(body) === "prompt-injection"
}

/** Detect the first high-confidence safety block without exposing user text. */
export function getGenerationSafetyReason(body: GenerationBody): GenerationSafetyReason | null {
  return findGenerationSafetyReason(body)
}

function meaningfulLength(value: string): number {
  return value.replace(/[^\p{L}\p{N}]+/gu, "").length
}

/** Reject input that is technically non-empty but cannot produce a useful brief. */
export function validateGenerationBrief(body: GenerationBody, kind: GenerationKind): string[] {
  const errors = Object.entries(MINIMUM_BRIEF_LENGTHS[kind]).flatMap(([field, minimum]) => {
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

  return [...errors, ...validatePromptSafety(body)]
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
