import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"

export async function POST(req: NextRequest) {
  try {
    return NextResponse.json({ error: "Stripe is disabled in this deployment" }, { status: 503 })
  } catch (error) {
    console.error("Stripe portal error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
