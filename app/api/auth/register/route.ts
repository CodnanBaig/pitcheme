import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV !== 'test') {
      const clientKey = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-client'
      const rateLimit = await enforceRateLimit(`registration:${clientKey}`, { limit: 5, windowMs: 60_000 })
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: 'Too many registration attempts. Please try again shortly.' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
        )
      }
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 })
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const input = body as Record<string, unknown>
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
    const password = typeof input.password === 'string' ? input.password : ''
    const name = typeof input.name === 'string' ? input.name.trim() : null

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Please provide a valid email address' }, { status: 400 })
    }

    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: 'Password must be between 8 and 128 characters' },
        { status: 400 },
      )
    }

    if (name && name.length > 120) {
      return NextResponse.json({ error: 'Name must be 120 characters or fewer' }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Hash the password
    const hashedPassword = await hashPassword(password)

    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
      }
    })

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json(
      { message: 'User created successfully', user: userWithoutPassword },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error', {
      error: error instanceof Error ? error.name : 'unknown',
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
