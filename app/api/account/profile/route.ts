import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { type NextRequest, NextResponse } from "next/server"

const MAX_NAME_LENGTH = 120

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const input = body as Record<string, unknown>
    const unknownFields = Object.keys(input).filter((key) => key !== "name")
    if (unknownFields.length > 0) {
      return NextResponse.json({ error: "Unsupported profile fields" }, { status: 400 })
    }

    if (typeof input.name !== "string") {
      return NextResponse.json({ error: "Name must be a string" }, { status: 400 })
    }

    const name = input.name.trim()
    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` },
        { status: 400 },
      )
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: name || null },
      select: { id: true, name: true, email: true },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Profile update error", {
      error: error instanceof Error ? error.name : "unknown",
    })
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
