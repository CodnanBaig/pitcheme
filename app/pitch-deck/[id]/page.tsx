import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExportButton } from "@/components/export-button"
import { ShareButton } from "@/components/share-button"
import { Edit, PresentationIcon as PresentationChart } from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { sanitizeGeneratedHtml } from "@/lib/sanitize-html"
import { isMongoObjectId } from "@/lib/mongo-id"
import { WorkspaceShell } from "@/components/workspace-shell"

export const runtime = "nodejs"

// CSS styles for rendering Kimi-K2 generated HTML content
const pitchDeckStyles = `
  .pitch-deck-slides {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #0D1B2A;
  }
  
  .pitch-deck-slides .slide {
    width: 100%;
    max-width: 1000px;
    margin: 20px auto;
    min-height: 560px;
    padding: 42px;
    box-sizing: border-box;
    background: #FFFFFF;
    color: #0D1B2A;
    border: 1px solid #D7E0E7;
    border-top: 5px solid #18A6A6;
    box-shadow: 0 12px 30px rgba(13, 27, 42, 0.08);
    page-break-after: always;
    position: relative;
  }
  
  .pitch-deck-slides .slide:last-child {
    page-break-after: avoid;
  }
  
  .pitch-deck-slides h1 {
    font-size: 32px;
    font-weight: bold;
    letter-spacing: -0.02em;
    margin: 0 0 24px;
    color: #0D1B2A;
  }
  
  .pitch-deck-slides h2 {
    font-size: 24px;
    margin-bottom: 15px;
    color: #0E7373;
  }
  
  .pitch-deck-slides h3 {
    font-size: 20px;
    margin-bottom: 10px;
    color: #1B263B;
  }

  .pitch-deck-slides .slide-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 28px;
    margin-top: 26px;
  }

  .pitch-deck-slides .slide-column {
    min-width: 0;
  }
  
  .pitch-deck-slides ul {
    font-size: 18px;
    line-height: 1.6;
    margin: 0;
    padding-left: 20px;
  }
  
  .pitch-deck-slides li {
    margin-bottom: 8px;
  }
  
  .pitch-deck-slides p {
    font-size: 16px;
    line-height: 1.5;
    margin: 0 0 10px 0;
  }
  
  .pitch-deck-slides .visual-elements {
    background: #F4F6F8;
    padding: 20px;
    border-left: 3px solid #18A6A6;
    margin-top: 20px;
  }
  
  .pitch-deck-slides .speaker-notes {
    background: #F8FAFC;
    padding: 15px;
    border-left: 3px solid #18A6A6;
    margin-top: 30px;
  }

  .pitch-deck-slides .slide-number {
    position: absolute;
    bottom: 24px;
    right: 28px;
    color: #0E7373;
    font-size: 14px;
    font-weight: 700;
  }

  .pitch-deck-slides .title-slide {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 560px;
    padding: 64px;
    background: #0D1B2A;
    border: 0;
    border-top: 10px solid #18A6A6;
    color: #FFFFFF;
  }

  .pitch-deck-slides .title-slide h1 {
    color: #FFFFFF;
    font-size: 56px;
    max-width: 760px;
  }

  .pitch-deck-slides .title-slide .tagline {
    color: #D7E0E7;
    font-size: 26px;
    line-height: 1.4;
    max-width: 680px;
  }

  .pitch-deck-slides .title-slide .slide-number {
    color: #6FD1CC;
  }
  
  @media print {
    .pitch-deck-slides .slide {
      page-break-after: always;
      margin: 0;
      box-shadow: none;
    }

    .pitch-deck-slides .slide-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 700px) {
    .pitch-deck-slides .slide,
    .pitch-deck-slides .title-slide {
      min-height: 0;
      padding: 28px;
    }

    .pitch-deck-slides .slide-grid {
      grid-template-columns: 1fr;
    }

    .pitch-deck-slides .title-slide h1 {
      font-size: 40px;
    }
  }
`

interface PitchDeckPageProps {
  params: Promise<{
    id: string
  }>
}

// Function to get pitch deck data from database
async function getPitchDeck(id: string, userId: string) {
  if (!isMongoObjectId(id)) return null
  const pitchDeck = await prisma.document.findFirst({
    where: {
      id: id,
      userId: userId,
      type: "pitch-deck",
    },
  })

  if (!pitchDeck) {
    return null
  }

  return {
    id: pitchDeck.id,
    startupName: pitchDeck.clientName,
    tagline: pitchDeck.projectTitle,
    // Model-generated slide markup is rendered below, so sanitize it at the
    // server boundary before it can reach dangerouslySetInnerHTML.
    content: sanitizeGeneratedHtml(pitchDeck.content),
    createdAt: pitchDeck.createdAt.toISOString(),
    status: "completed", // All generated documents are considered completed
  }
}

export default async function PitchDeckPage({ params }: PitchDeckPageProps) {
  const resolvedParams = await params
  const session = await auth()

  if (!session) {
    redirect("/auth/signin")
  }

  const pitchDeck = await getPitchDeck(resolvedParams.id, session.user.id)

  if (!pitchDeck) {
    notFound()
  }

  return (
    <WorkspaceShell active="documents" contentClassName="max-w-5xl">
      {/* Add styles for pitch deck rendering */}
      <style dangerouslySetInnerHTML={{ __html: pitchDeckStyles }} />
        <div className="max-w-4xl mx-auto">
          {/* Pitch Deck Header */}
          <div className="mb-6 flex flex-col justify-between gap-5 border-b border-border pb-6 sm:flex-row sm:items-end">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
                <PresentationChart className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Pitch deck</p><Badge variant="secondary">Completed</Badge></div>
                <h1 className="text-2xl font-semibold text-foreground">{pitchDeck.startupName} Pitch Deck</h1>
                <p className="text-muted-foreground">{pitchDeck.tagline}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ShareButton documentId={pitchDeck.id} />
              <Button variant="outline" size="sm" asChild><Link href={`/documents/${pitchDeck.id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit</Link></Button>
              <ExportButton documentId={pitchDeck.id} documentType="pitch-deck" documentTitle={`${pitchDeck.startupName} Pitch Deck`} />
            </div>
          </div>

          {/* Pitch Deck Content */}
          <Card className="border-border bg-card">
            <CardContent className="pt-8">
              <div className="prose prose-gray max-w-none">
                {pitchDeck.content.includes('<div class="slide"') ? (
                  // Render HTML content from Kimi-K2 model
                  <div 
                    className="pitch-deck-slides"
                    dangerouslySetInnerHTML={{ __html: pitchDeck.content }}
                    style={{
                      fontFamily: "'Segoe UI', Arial, sans-serif",
                      color: "#0D1B2A",
                    }}
                  />
                ) : (
                  // Fallback to text parsing for legacy content
                  <div
                    className="whitespace-pre-wrap text-foreground leading-relaxed"
                    style={{
                      fontFamily: "inherit",
                      lineHeight: "1.7",
                    }}
                  >
                    {pitchDeck.content.split("\n").map((line: string, index: number) => {
                      if (line.startsWith("# ")) {
                        return (
                          <h1 key={index} className="text-3xl font-bold text-foreground mt-8 mb-4 first:mt-0">
                            {line.replace("# ", "")}
                          </h1>
                        )
                      }
                      if (line.startsWith("## ")) {
                        return (
                          <div key={index} className="mt-8 mb-4 p-6 bg-accent/5 border-l-4 border-accent rounded-r-lg">
                            <h2 className="text-2xl font-semibold text-foreground mb-2">{line.replace("## ", "")}</h2>
                          </div>
                        )
                      }
                      if (line.startsWith("**") && line.endsWith("**")) {
                        return (
                          <h3 key={index} className="text-xl font-semibold text-foreground mt-4 mb-3">
                            {line.replace(/\*\*/g, "")}
                          </h3>
                        )
                      }
                      if (line.startsWith("• ")) {
                        return (
                          <li key={index} className="text-foreground mb-2 ml-4 list-disc">
                            {line.replace("• ", "")}
                          </li>
                        )
                      }
                      if (line.startsWith("---")) {
                        return <hr key={index} className="my-8 border-border" />
                      }
                      if (line.trim() === "") {
                        return <br key={index} />
                      }
                      return (
                        <p key={index} className="text-foreground mb-3">
                          {line}
                        </p>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <ShareButton documentId={pitchDeck.id} size="lg" allowRevoke />
            <Button variant="outline" size="lg" asChild>
              <Link href={`/documents/${pitchDeck.id}/edit`}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Pitch Deck
              </Link>
            </Button>
            <ExportButton
              documentId={pitchDeck.id}
              documentType="pitch-deck"
              documentTitle={`${pitchDeck.startupName} Pitch Deck`}
            />
          </div>
        </div>
    </WorkspaceShell>
  )
}
