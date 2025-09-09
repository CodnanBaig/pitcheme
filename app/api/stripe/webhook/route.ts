import { type NextRequest, NextResponse } from "next/server"
// Stripe disabled: return 204 to indicate no-op

export async function POST(req: NextRequest) {
  try {
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
