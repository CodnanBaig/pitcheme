import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit } from '@/lib/rate-limit'
import { getLoginClientAddress, hashRateLimitKeyPart } from '@/lib/auth-rate-limit'
import { getRequestId, jsonWithRequestId } from '@/lib/request-id'
import { readJsonBody } from '@/lib/request-body'
import { sendOperationalErrorTelemetry } from '@/lib/error-monitoring'

const MAX_REQUEST_BYTES = 8 * 1024
const REGISTRATION_RATE_LIMIT = { limit: 5, windowMs: 60_000 }

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  const json = (body: unknown, init: ResponseInit = {}) =>
    NextResponse.json(body, jsonWithRequestId(requestId, init))
  try {
    if (process.env.NODE_ENV !== 'test') {
      const clientAddress = getLoginClientAddress(request)
      const clientKey = clientAddress ? hashRateLimitKeyPart(clientAddress) : 'unknown-client'
      const rateLimit = await enforceRateLimit(`registration:client:${clientKey}`, REGISTRATION_RATE_LIMIT)
      if (!rateLimit.allowed) {
        return json(
          { error: 'Too many registration attempts. Please try again shortly.', requestId },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
        )
      }
    }

    const parsedBody = await readJsonBody(request, MAX_REQUEST_BYTES)
    if (!parsedBody.ok) {
      return json(
        { error: parsedBody.reason === 'too-large' ? 'Request body is too large' : 'Invalid JSON request body', requestId },
        { status: parsedBody.reason === 'too-large' ? 413 : 400 },
      )
    }
    const body = parsedBody.body

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'Invalid request body', requestId }, { status: 400 })
    }

    const input = body as Record<string, unknown>
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
    const password = typeof input.password === 'string' ? input.password : ''
    const name = typeof input.name === 'string' ? input.name.trim() : null

    if (!email || !password) {
      return json(
        { error: 'Email and password are required', requestId },
        { status: 400 }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return json({ error: 'Please provide a valid email address', requestId }, { status: 400 })
    }

    if (process.env.NODE_ENV !== 'test') {
      const emailRateLimit = await enforceRateLimit(`registration:email:${hashRateLimitKeyPart(email)}`, REGISTRATION_RATE_LIMIT)
      if (!emailRateLimit.allowed) {
        return json(
          { error: 'Too many registration attempts. Please try again shortly.', requestId },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((emailRateLimit.resetAt - Date.now()) / 1000)) } },
        )
      }
    }

    if (password.length < 8 || password.length > 128) {
      return json(
        { error: 'Password must be between 8 and 128 characters', requestId },
        { status: 400 },
      )
    }

    if (name && name.length > 120) {
      return json({ error: 'Name must be 120 characters or fewer', requestId }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return json(
        { error: 'User with this email already exists', requestId },
        { status: 400 }
      )
    }

    // Hash the password
    const hashedPassword = await hashPassword(password)

    // The preflight lookup keeps the common path friendly, while the unique
    // MongoDB index remains the authority when two registrations race.
    let user
    try {
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || null,
        }
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return json(
          { error: 'User with this email already exists', requestId },
          { status: 409 },
        )
      }
      throw error
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user

    return json(
      { message: 'User created successfully', user: userWithoutPassword },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error', {
      requestId,
      error: error instanceof Error ? error.name : 'unknown',
    })
    void sendOperationalErrorTelemetry({
      event: "auth_failed",
      requestId,
      path: "/api/auth/register",
      method: "POST",
      category: "registration",
      error: error instanceof Error ? error.name : "unknown",
    })
    return json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    )
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'P2002'
}
