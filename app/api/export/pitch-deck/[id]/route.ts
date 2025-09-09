import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import puppeteer from "puppeteer"
import { prisma } from "@/lib/prisma"

interface RouteParams {
  params: { id: string }
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
  }
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const pitchDeck = await getPitchDeck(params.id, session.user.id)

    if (!pitchDeck) {
      return NextResponse.json({ error: "Pitch deck not found" }, { status: 404 })
    }

    // Generate PDF using Puppeteer with slide-like formatting
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })

    const page = await browser.newPage()

    // Create HTML content for PDF with slide formatting
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${pitchDeck.startupName} Pitch Deck</title>
        <style>
          /* Global PDF-ready styles */
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #1A1A1A;
            margin: 0;
            padding: 0;
          }
          .slide {
            width: 1000px;
            height: 562px;
            padding: 40px;
            box-sizing: border-box;
            position: relative;
            page-break-after: always;
          }
          h1 {
            font-size: 36px;
            font-weight: 700;
            color: #0B2B5B;
            margin: 0 0 16px;
          }
          h2 {
            font-size: 28px;
            font-weight: 600;
            color: #0B2B5B;
            margin: 0 0 12px;
          }
          h3 {
            font-size: 22px;
            font-weight: 600;
            color: #0B2B5B;
            margin: 0 0 8px;
          }
          p, li {
            font-size: 18px;
            line-height: 26px;
            margin: 0 0 6px;
          }
          .accent {
            color: #0072FF;
          }
          .grid2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
          }
          .grid3 {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
          }
          
          /* Kimi-K2 specific styles for PDF export */
          .pitch-deck-slides .slide {
            width: 100%;
            max-width: 1000px;
            margin: 0 auto 20px;
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
          
          /* Title slide styling */
          .title-slide {
            text-align: center;
            background: linear-gradient(135deg, #15803d 0%, #84cc16 100%);
            color: white;
          }
          .title-slide h1 {
            color: white;
            font-size: 64px;
            margin-bottom: 20px;
          }
          .title-slide .tagline {
            font-size: 32px;
            margin-bottom: 60px;
            opacity: 0.9;
          }
          .slide-number {
            position: absolute;
            bottom: 30px;
            right: 30px;
            font-size: 18px;
            color: #84cc16;
            font-weight: bold;
          }
          
          @media print {
            .slide {
              page-break-after: always;
              margin: 0;
              border-radius: 0;
            }
            .pitch-deck-slides .slide {
              page-break-after: always;
              margin: 0;
              border-radius: 0;
            }
          }
        </style>
      </head>
      <body>
        ${formatPitchDeckForPDF(pitchDeck.content, pitchDeck.startupName, pitchDeck.tagline)}
      </body>
      </html>
    `

    await page.setContent(htmlContent, { waitUntil: "networkidle0" })

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: {
        top: "10mm",
        right: "10mm",
        bottom: "10mm",
        left: "10mm",
      },
      preferCSSPageSize: true,
    })

    await browser.close()

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pitchDeck.startupName.replace(/[^a-z0-9]/gi, "_")}_pitch_deck.pdf"`,
      },
    })
  } catch (error) {
    console.error("Error exporting pitch deck:", error)
    return NextResponse.json({ error: "Failed to export pitch deck" }, { status: 500 })
  }
}

function formatPitchDeckForPDF(content: string, startupName: string, tagline: string | null): string {
  // Check if content is already in HTML format (from Kimi-K2 model)
  if (content.includes('<div class="slide"')) {
    // Content is already formatted for PDF - just add title slide
    const titleSlide = `
      <div class="slide title-slide">
        <h1>${startupName}</h1>
        <div class="tagline">${tagline || ''}</div>
        <div class="slide-number">1</div>
      </div>
    `
    return titleSlide + content
  }

  // Fallback to original parsing for legacy content
  const lines = content.split("\n")
  const slides: string[] = []
  let currentSlide = ""
  let slideNumber = 0
  let isFirstSlide = true

  for (const line of lines) {
    if (line.startsWith("## Slide")) {
      if (currentSlide) {
        slides.push(currentSlide)
      }
      slideNumber++

      if (isFirstSlide) {
        currentSlide = `
          <div class="slide title-slide">
            <h1>${startupName}</h1>
            <div class="tagline">${tagline}</div>
            <div class="slide-number">${slideNumber}</div>
          </div>
        `
        isFirstSlide = false
      } else {
        currentSlide = `<div class="slide"><div class="slide-number">${slideNumber}</div>`
      }
    } else if (line.startsWith("**") && line.endsWith("**")) {
      currentSlide += `<h2>${line.replace(/\*\*/g, "")}</h2>`
    } else if (line.startsWith("• ")) {
      if (!currentSlide.includes("<ul>")) {
        currentSlide += "<ul>"
      }
      currentSlide += `<li>${line.replace("• ", "")}</li>`
    } else if (line.trim() === "" && currentSlide.includes("<ul>")) {
      currentSlide += "</ul>"
    }
  }

  if (currentSlide) {
    if (currentSlide.includes("<ul>") && !currentSlide.includes("</ul>")) {
      currentSlide += "</ul>"
    }
    currentSlide += "</div>"
    slides.push(currentSlide)
  }

  return slides.join("")
}
