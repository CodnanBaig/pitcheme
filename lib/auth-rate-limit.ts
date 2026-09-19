import { createHash } from "node:crypto"
import { enforceRateLimit, type RateLimitResult } from "@/lib/rate-limit"

const LOGIN_WINDOW_MS = 60_000
const LOGIN_EMAIL_LIMIT = 10
const LOGIN_CLIENT_LIMIT = 30
const MAX_CLIENT_KEY_LENGTH = 96

type RequestHeaders = { get(name: string): string | null } | Record<string, unknown>

type LoginRequest = {
  headers?: RequestHeaders
}

export function hashRateLimitKeyPart(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

/**
 * Read the address supplied by the trusted edge proxy without allowing an
 * unbounded value into a shared rate-limit key. If no proxy address exists,
 * the email guard still applies and the client guard is skipped.
 */
export function getLoginClientAddress(request?: LoginRequest): string | null {
  const forwarded = readHeader(request?.headers, "x-forwarded-for")
    ?.split(",", 1)[0]
    ?.trim()
  const realIp = readHeader(request?.headers, "x-real-ip")?.trim()
  const address = forwarded || realIp || ""
  if (!address) return null

  const normalized = address
    .replace(/[^A-Za-z0-9.:[\]-]/g, "")
    .slice(0, MAX_CLIENT_KEY_LENGTH)
  return normalized || null
}

function readHeader(headers: RequestHeaders | undefined, name: string): string | null {
  if (!headers) return null
  if (typeof (headers as { get?: unknown }).get === "function") {
    return (headers as { get(name: string): string | null }).get(name)
  }

  const record = headers as Record<string, unknown>
  const value = record[name] ?? record[name.toLowerCase()]
  return typeof value === "string" ? value : null
}

export async function enforceCredentialsLoginRateLimit(
  email: string,
  request?: LoginRequest,
): Promise<{ allowed: boolean; email: RateLimitResult; client?: RateLimitResult }> {
  const emailResult = await enforceRateLimit(
    `credentials-login:email:${hashRateLimitKeyPart(email)}`,
    { limit: LOGIN_EMAIL_LIMIT, windowMs: LOGIN_WINDOW_MS },
  )
  const clientAddress = getLoginClientAddress(request)
  if (!clientAddress) return { allowed: emailResult.allowed, email: emailResult }

  const clientResult = await enforceRateLimit(
    `credentials-login:client:${hashRateLimitKeyPart(clientAddress)}`,
    { limit: LOGIN_CLIENT_LIMIT, windowMs: LOGIN_WINDOW_MS },
  )
  return {
    allowed: emailResult.allowed && clientResult.allowed,
    email: emailResult,
    client: clientResult,
  }
}
