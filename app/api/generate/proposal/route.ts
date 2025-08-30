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
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canGenerate = await canUserGenerate(session.user.id, "proposals")
    if (!canGenerate) {
      return NextResponse.json(
        {
          error: "Usage limit reached. Please upgrade your plan to generate more proposals.",
        },
        { status: 403 },
      )
    }

    const body = await request.json()
    const { 
      field = 'technology', 
      clientName, 
      clientCompany, 
      projectTitle, 
      projectDescription, 
      goals, 
      budget, 
      timeline, 
      services,
      fieldSpecificData = {},
      modelPreference 
    } = body

    // Generate proposal using field-specific AI service
    const generationRequest = {
      field,
      clientName,
      clientCompany,
      projectTitle: projectTitle || "Custom Project",
      projectDescription,
      goals,
      budget,
      timeline: timeline || "To be determined",
      services: Array.isArray(services) ? services : [services].filter(Boolean),
      fieldSpecificData,
      modelPreference
    }

    const result = await aiService.generateProposal(generationRequest)
    
    if (!result.success) {
      throw new Error(result.error || "Failed to generate proposal")
    }

    const proposalId = `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    await prisma.document.create({
      data: {
        id: proposalId,
        userId: session.user.id,
        type: "proposal",
        clientName,
        clientCompany,
        projectTitle: projectTitle || "Custom Project",
        content: result.content,
        metadata: JSON.stringify({
          field,
          model: result.model,
          tokensUsed: result.tokensUsed,
          generationTime: result.generationTime,
          fieldSpecificData
        })
      }
    })

    // Increment usage count
    await incrementUsage(session.user.id, "proposals")

    return NextResponse.json({
      id: proposalId,
      message: "Proposal generated successfully",
      metadata: {
        field,
        model: result.model,
        tokensUsed: result.tokensUsed,
        generationTime: result.generationTime
      }
    })
  } catch (error) {
    console.error("Error generating proposal:", error)
    return NextResponse.json({ error: "Failed to generate proposal" }, { status: 500 })
  }
}
