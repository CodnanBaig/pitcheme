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
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
          }
          .slide {
            width: 100vw;
            height: 100vh;
            padding: 60px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: center;
            page-break-after: always;
            background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);
            border-left: 8px solid #15803d;
          }
          .slide:last-child {
            page-break-after: avoid;
          }
          .slide h1 {
            color: #15803d;
            font-size: 48px;
            margin-bottom: 30px;
            text-align: center;
          }
          .slide h2 {
            color: #15803d;
            font-size: 36px;
            margin-bottom: 40px;
            text-align: center;
            border-bottom: 3px solid #84cc16;
            padding-bottom: 15px;
          }
          .slide h3 {
            color: #374151;
            font-size: 28px;
            margin-bottom: 30px;
            text-align: center;
          }
          .slide ul {
            font-size: 24px;
            line-height: 1.8;
            list-style: none;
            padding: 0;
          }
          .slide li {
            margin-bottom: 20px;
            padding-left: 40px;
            position: relative;
          }
          .slide li:before {
            content: "•";
            color: #84cc16;
            font-size: 30px;
            position: absolute;
            left: 0;
            top: -5px;
          }
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
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
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

function formatPitchDeckForPDF(content: string, startupName: string, tagline: string): string {
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
