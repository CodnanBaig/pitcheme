import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const TOKEN_VERSION = "v2"
const SHARE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_TOKEN_LENGTH = 256
const MONGO_OBJECT_ID = /^[a-f0-9]{24}$/
const TOKEN_NONCE = /^[A-Za-z0-9_-]{16,64}$/

export type DocumentShareToken = {
  token: string
  documentId: string
  expiresAt: number
}

function getSigningSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  if (!secret || secret.length < 32) {
    throw new Error("NEXTAUTH_SECRET must be configured before share links can be issued")
  }
  return secret
}

function sign(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("base64url")
}

export function createDocumentShareToken(documentId: string, now = Date.now()): DocumentShareToken {
  if (!MONGO_OBJECT_ID.test(documentId)) throw new Error("Invalid document id")

  const expiresAt = now + SHARE_TOKEN_TTL_MS
  const nonce = randomBytes(16).toString("base64url")
  const payload = `${TOKEN_VERSION}.${documentId}.${expiresAt}.${nonce}`
  return {
    token: `${payload}.${sign(payload)}`,
    documentId,
    expiresAt,
  }
}

export function verifyDocumentShareToken(token: string, now = Date.now()): { documentId: string; expiresAt: number } | null {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null

  const parts = token.split(".")
  if (parts.length !== 5 || parts[0] !== TOKEN_VERSION) return null

  const [, documentId, expiresAtValue, nonce, providedSignature] = parts
  if (!MONGO_OBJECT_ID.test(documentId) || !/^\d+$/.test(expiresAtValue) || !TOKEN_NONCE.test(nonce)) return null

  const expiresAt = Number(expiresAtValue)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return null

  try {
    const expectedSignature = Buffer.from(sign(`${TOKEN_VERSION}.${documentId}.${expiresAtValue}.${nonce}`), "base64url")
    const actualSignature = Buffer.from(providedSignature, "base64url")
    if (expectedSignature.length !== actualSignature.length || !timingSafeEqual(expectedSignature, actualSignature)) {
      return null
    }
  } catch {
    return null
  }

  return { documentId, expiresAt }
}

export function hashDocumentShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function isPersistentDocumentShareToken(token: string): boolean {
  return typeof token === "string" && token.split(".").length === 5 && token.startsWith(`${TOKEN_VERSION}.`)
}

export const documentShareTokenTtlMs = SHARE_TOKEN_TTL_MS
