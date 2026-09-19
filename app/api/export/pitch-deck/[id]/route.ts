import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { chromium } from "playwright-core"
import { prisma } from "@/lib/prisma"
import { safeFilename } from "@/lib/safe-filename"
import { escapeHtml, sanitizeGeneratedHtml } from "@/lib/sanitize-html"
import { enforceRateLimit } from "@/lib/rate-limit"
import { isMongoObjectId } from "@/lib/mongo-id"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"
import { recordProductEvent } from "@/lib/product-events"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"
import { acquireExportConcurrencySlot } from "@/lib/export-concurrency"
import { EXPORT_LAUNCH_TIMEOUT_MS, EXPORT_RENDER_TIMEOUT_MS, throwIfExportAborted, withExportTimeout } from "@/lib/export-timeout"
import { createChromiumLaunchOptions } from "@/lib/chromium-runtime"

export const runtime = "nodejs"
export const maxDuration = 60

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
  const requestId = getRequestId(request)
  const json = (body: unknown, init: ResponseInit = {}) =>
    NextResponse.json(body, jsonWithRequestId(requestId, init))
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  let exportUserId: string | undefined
  let exportDocumentId: string | undefined
  let releaseExportSlot: (() => void) | null = null

  try {
    const session = await auth()

    if (!session || !session.user || !session.user.id) {
      return json({ error: "Unauthorized", requestId }, { status: 401 })
    }
    exportUserId = session.user.id

    const requestedFormat = new URL(request.url).searchParams.get("format")
    if (requestedFormat && requestedFormat !== "pdf") {
      return json({ error: "Invalid format", requestId }, { status: 400 })
    }

    if (!isMongoObjectId(params.id)) {
      return json({ error: "Invalid pitch deck ID", requestId }, { status: 400 })
    }

    if (process.env.NODE_ENV !== "test") {
      const rateLimit = await enforceRateLimit(`pitch-deck-export:${session.user.id}`, { limit: 20, windowMs: 60_000 })
      if (!rateLimit.allowed) {
        return json(
          { error: "Too many export requests. Please try again shortly.", requestId },
          { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
        )
      }
    }

    const pitchDeck = await getPitchDeck(params.id, session.user.id)

    if (!pitchDeck) {
      return json({ error: "Pitch deck not found", requestId }, { status: 404 })
    }
    exportDocumentId = pitchDeck.id
    releaseExportSlot = acquireExportConcurrencySlot(session.user.id)
    if (!releaseExportSlot) {
      return json(
        { error: "Export capacity is currently busy. Please try again shortly.", requestId },
        { status: 429, headers: { "Retry-After": "5" } },
      )
    }
    throwIfExportAborted(request.signal)

    // Use a configured system browser or the Vercel-compatible serverless runtime.
    const launchOptions = await createChromiumLaunchOptions(EXPORT_LAUNCH_TIMEOUT_MS)
    browser = await chromium.launch(launchOptions)

    const page = await browser.newPage()

    // Create HTML content for PDF with slide formatting
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(pitchDeck.startupName || "Pitch Deck")} Pitch Deck</title>
          <style>
          @page { size: A4 landscape; margin: 0; }
          :root { color-scheme: light; }
          /* Global PDF-ready styles */
          body {
            font-family: Inter, 'Segoe UI', Arial, sans-serif;
            color: #0D1B2A;
            margin: 0;
            padding: 0;
            background: #ffffff;
          }
          .slide {
            width: 1000px;
            height: 562px;
            padding: 40px;
            box-sizing: border-box;
            position: relative;
            page-break-after: always;
            background: #ffffff;
          }
          h1 {
            font-size: 36px;
            font-weight: 700;
            color: #0D1B2A;
            margin: 0 0 16px;
          }
          h2 {
            font-size: 28px;
            font-weight: 600;
            color: #0E7373;
            margin: 0 0 12px;
          }
          h3 {
            font-size: 22px;
            font-weight: 600;
            color: #1B263B;
            margin: 0 0 8px;
          }
          p, li {
            font-size: 18px;
            line-height: 26px;
            margin: 0 0 6px;
          }
          .accent {
            color: #18A6A6;
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
            background: #1B263B;
            color: white;
            border: 1px solid #33465d;
            box-shadow: 0 5px 14px rgba(13, 27, 42, 0.12);
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
            background: rgba(255,255,255,0.08);
            padding: 20px;
            border-left: 3px solid #18A6A6;
            margin-top: 20px;
          }
          
          .pitch-deck-slides .speaker-notes {
            background: rgba(255,255,255,0.08);
            padding: 15px;
            border-left: 3px solid #18A6A6;
            margin-top: 30px;
          }

          @media print {
            .pitch-deck-slides .slide-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          
          /* Title slide styling */
          .title-slide {
            text-align: center;
            background: #0D1B2A;
            color: white;
            border-top: 10px solid #18A6A6;
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
            color: #18A6A6;
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
        ${formatPitchDeckForPDF(pitchDeck.content, pitchDeck.startupName || "", pitchDeck.tagline)}
      </body>
      </html>
    `

    await page.setContent(htmlContent, { waitUntil: "load", timeout: EXPORT_RENDER_TIMEOUT_MS, signal: request.signal })

    throwIfExportAborted(request.signal)
    const pdf = await withExportTimeout(page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;padding:0 10mm;color:#9bb0c4;font:9px Arial,sans-serif;text-align:right;">${escapeHtml(pitchDeck.startupName || "Pitch Deck")} · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    }))
    throwIfExportAborted(request.signal)

    await recordProductEvent({
      name: "export_used",
      userId: session.user.id,
      documentId: pitchDeck.id,
      requestId,
      metadata: { format: "pdf", type: "pitch-deck" },
    })

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename(pitchDeck.startupName, "pitch-deck")}_pitch_deck.pdf"`,
        "Cache-Control": "no-store",
        "X-Request-ID": requestId,
      },
    })
  } catch (error) {
    const cancelled = request.signal.aborted || (error instanceof Error && error.name === "AbortError")
    if (exportUserId) {
      await recordProductEvent({
        name: "export_failed",
        userId: exportUserId,
        ...(exportDocumentId ? { documentId: exportDocumentId } : {}),
        requestId,
        metadata: { format: "pdf", type: "pitch-deck" },
      })
    }
    if (!cancelled) {
      console.error("Error exporting pitch deck", {
        requestId,
        error: error instanceof Error ? error.name : "unknown",
      })
      void sendOperationalErrorTelemetry({
        event: "export_failed",
        requestId,
        path: "/api/export/pitch-deck/:id",
        method: "GET",
        category: "export",
        error: error instanceof Error ? error.name : "unknown",
      })
    }
    if (cancelled) {
      return json({ error: "Export request cancelled", requestId }, { status: 499 })
    }
    return json({ error: "Failed to export pitch deck", requestId }, { status: 500 })
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.error("Error closing pitch deck export browser", {
          requestId,
          error: closeError instanceof Error ? closeError.name : "unknown",
        })
      }
    }
    releaseExportSlot?.()
  }
}

function formatPitchDeckForPDF(content: string, startupName: string, tagline: string | null): string {
  // Check if content is already in HTML format (from Kimi-K2 model)
  if (content.includes('<div class="slide"')) {
    // Content is already formatted for PDF - just add title slide
    const titleSlide = `
      <div class="slide title-slide">
        <h1>${escapeHtml(startupName)}</h1>
        <div class="tagline">${escapeHtml(tagline || '')}</div>
        <div class="slide-number">1</div>
      </div>
    `
    return `<div class="pitch-deck-slides">${titleSlide}${sanitizeGeneratedHtml(content)}</div>`
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
            <h1>${escapeHtml(startupName)}</h1>
            <div class="tagline">${escapeHtml(tagline || '')}</div>
            <div class="slide-number">${slideNumber}</div>
          </div>
        `
        isFirstSlide = false
      } else {
        currentSlide = `<div class="slide"><div class="slide-number">${slideNumber}</div>`
      }
    } else if (line.startsWith("**") && line.endsWith("**")) {
      currentSlide += `<h2>${escapeHtml(line.slice(2, -2))}</h2>`
    } else if (line.startsWith("• ")) {
      if (!currentSlide.includes("<ul>")) {
        currentSlide += "<ul>"
      }
      currentSlide += `<li>${escapeHtml(line.slice(2))}</li>`
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

  return `<div class="pitch-deck-slides">${slides.join("")}</div>`
}
