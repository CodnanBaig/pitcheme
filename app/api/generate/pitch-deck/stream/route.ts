import { type NextRequest } from "next/server"
import { POST as generatePitchDeck } from "@/app/api/generate/pitch-deck/route"
import { createGenerationStream } from "@/lib/generation-stream"

export const runtime = "nodejs"
export const maxDuration = 60

export function POST(request: NextRequest) {
  return createGenerationStream(request, generatePitchDeck)
}
