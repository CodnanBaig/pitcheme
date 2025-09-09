import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: "No session" }, { status: 401 })
    }

    return NextResponse.json({
      user: session.user,
      expires: session.expires
    })
  } catch (error) {
    console.error("Session check error:", error)
    return NextResponse.json({ error: "Session check failed" }, { status: 500 })
  }
}

export async function POST() {
  // Force refresh the session
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: "No session" }, { status: 401 })
    }

    return NextResponse.json({
      user: session.user,
      expires: session.expires,
      refreshed: true
    })
  } catch (error) {
    console.error("Session refresh error:", error)
    return NextResponse.json({ error: "Session refresh failed" }, { status: 500 })
  }
}

