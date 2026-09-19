import { type NextRequest } from "next/server"
import { POST as generateProposal } from "@/app/api/generate/proposal/route"
import { createGenerationStream } from "@/lib/generation-stream"

export const runtime = "nodejs"
export const maxDuration = 60

export function POST(request: NextRequest) {
  return createGenerationStream(request, generateProposal)
}
