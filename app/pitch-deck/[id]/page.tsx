import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExportButton } from "@/components/export-button"
import { ArrowLeft, Share, Edit, PresentationIcon as PresentationChart, Zap } from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"

// CSS styles for rendering Kimi-K2 generated HTML content
const pitchDeckStyles = `
  .pitch-deck-slides {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #1A1A1A;
  }
  
  .pitch-deck-slides .slide {
    width: 100%;
    max-width: 1000px;
    margin: 20px auto;
    padding: 30px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    page-break-after: always;
    position: relative;
  }
  
  .pitch-deck-slides .slide:last-child {
    page-break-after: avoid;
  }
  
  .pitch-deck-slides h1 {
    font-size: 32px;
    font-weight: bold;
    margin-bottom: 20px;
    text-align: center;
    color: white;
  }
  
  .pitch-deck-slides h2 {
    font-size: 24px;
    margin-bottom: 15px;
    color: #f8f9fa;
  }
  
  .pitch-deck-slides h3 {
    font-size: 20px;
    margin-bottom: 10px;
    color: #f8f9fa;
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
    background: rgba(255,255,255,0.1);
    padding: 20px;
    border-radius: 8px;
    margin-top: 20px;
  }
  
  .pitch-deck-slides .speaker-notes {
    background: rgba(255,255,255,0.1);
    padding: 15px;
    border-radius: 8px;
    margin-top: 30px;
  }
  
  @media print {
    .pitch-deck-slides .slide {
      page-break-after: always;
      margin: 0;
      border-radius: 0;
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
    content: pitchDeck.content,
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
    <div className="min-h-screen bg-background">
      {/* Add styles for pitch deck rendering */}
      <style dangerouslySetInnerHTML={{ __html: pitchDeckStyles }} />
      
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">PitchGenie</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Share className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <ExportButton
                documentId={pitchDeck.id}
                documentType="pitch-deck"
                documentTitle={`${pitchDeck.startupName} Pitch Deck`}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Pitch Deck Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <PresentationChart className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{pitchDeck.startupName} Pitch Deck</h1>
                <p className="text-muted-foreground">{pitchDeck.tagline}</p>
              </div>
            </div>
            <Badge variant="default">Completed</Badge>
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
                      color: "#1A1A1A",
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
          <div className="flex justify-center gap-4 mt-8">
            <Button variant="outline" size="lg">
              <Edit className="w-4 h-4 mr-2" />
              Edit Pitch Deck
            </Button>
            <ExportButton
              documentId={pitchDeck.id}
              documentType="pitch-deck"
              documentTitle={`${pitchDeck.startupName} Pitch Deck`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
