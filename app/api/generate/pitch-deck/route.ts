import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { canUserGenerate, incrementUsage } from "@/lib/subscription"
import { prisma } from "@/lib/prisma"
import { aiService } from "@/lib/ai-service"

// Check for required environment variable
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required")
}

export async function POST(request: NextRequest) {
  try {
    console.log("Pitch deck generation request received")

    const session = await auth()
    console.log("Session check:", { hasSession: !!session, userId: session?.user?.id })

    if (!session?.user?.id) {
      console.error("Unauthorized request - no valid session")
      return NextResponse.json({ error: "Unauthorized - Please sign in again" }, { status: 401 })
    }

    const canGenerate = await canUserGenerate(session.user.id, "pitchDecks")
    if (!canGenerate) {
      return NextResponse.json(
        {
          error: "Usage limit reached. Please upgrade your plan to generate more pitch decks.",
        },
        { status: 403 },
      )
    }

    const body = await request.json()
    const {
      field = 'technology',
      startupName,
      tagline,
      problem,
      solution,
      market,
      businessModel,
      traction,
      team,
      competition,
      fundingAsk,
      useOfFunds,
      industry,
      fieldSpecificData = {},
      modelPreference,
      visualMode = false,
      exportFormat
    } = body

    // Generate pitch deck using field-specific AI service
    const generationRequest = {
      field,
      startupName,
      tagline,
      problem,
      solution,
      market,
      businessModel,
      team,
      funding: fundingAsk,
      fieldSpecificData: {
        ...fieldSpecificData,
        traction,
        competition,
        useOfFunds,
        industry
      },
      modelPreference: visualMode ? 'visual' : modelPreference,
      visualMode,
      exportFormat
    }

    const result = await aiService.generatePitchDeck(generationRequest)
    
    if (!result.success) {
      throw new Error(result.error || "Failed to generate pitch deck")
    }

    const pitchDeckId = `deck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    await prisma.document.create({
      data: {
        id: pitchDeckId,
        userId: session.user.id,
        type: "pitch-deck",
        clientName: startupName,
        projectTitle: tagline || startupName,
        content: result.content,
        metadata: JSON.stringify({
          field,
          model: result.model,
          tokensUsed: result.tokensUsed,
          generationTime: result.generationTime,
          visualMode,
          fieldSpecificData
        })
      }
    })

    // Increment usage count
    await incrementUsage(session.user.id, "pitchDecks")

    return NextResponse.json({
      id: pitchDeckId,
      message: "Pitch deck generated successfully",
      metadata: {
        field,
        model: result.model,
        tokensUsed: result.tokensUsed,
        generationTime: result.generationTime
      }
    })
  } catch (error) {
    console.error("Error generating pitch deck:", error)
    return NextResponse.json({ error: "Failed to generate pitch deck" }, { status: 500 })
  }
}
