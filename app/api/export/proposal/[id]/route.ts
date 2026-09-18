import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { chromium } from "playwright-core"
import { AlignmentType, Document, Footer, HeadingLevel, PageNumber, Packer, Paragraph, TextRun } from "docx"
import { prisma } from "@/lib/prisma"
import { safeFilename } from "@/lib/safe-filename"
import { escapeHtml } from "@/lib/sanitize-html"
import { enforceRateLimit } from "@/lib/rate-limit"
import { isMongoObjectId } from "@/lib/mongo-id"
import { getRequestId, jsonWithRequestId } from "@/lib/request-id"

interface ExportProposalParams {
  params: {
    id: string
  }
}

// Function to get proposal data from database
async function getProposal(id: string, userId: string) {
  const proposal = await prisma.document.findFirst({
    where: {
      id: id,
      userId: userId,
      type: "proposal",
    },
  })

  if (!proposal) {
    return null
  }

  return {
    id: proposal.id,
    clientName: proposal.clientName,
    clientCompany: proposal.clientCompany,
    projectTitle: proposal.projectTitle,
    content: proposal.content,
    createdAt: proposal.createdAt.toISOString(),
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const requestId = getRequestId(request)
  const json = (body: unknown, init: ResponseInit = {}) =>
    NextResponse.json(body, jsonWithRequestId(requestId, init))
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null

  try {
    const session = await auth()

    if (!session || !session.user || !session.user.id) {
      return json({ error: "Unauthorized", requestId }, { status: 401 })
    }

    if (!isMongoObjectId(params.id)) {
      return json({ error: "Invalid proposal ID", requestId }, { status: 400 })
    }

    if (process.env.NODE_ENV !== "test") {
      const rateLimit = await enforceRateLimit(`proposal-export:${session.user.id}`, { limit: 20, windowMs: 60_000 })
      if (!rateLimit.allowed) {
        return json(
          { error: "Too many export requests. Please try again shortly." },
          { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
        )
      }
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || "pdf"

    const proposal = await getProposal(params.id, session.user.id)

    if (!proposal) {
      return json({ error: "Proposal not found", requestId }, { status: 404 })
    }

    if (format === "pdf") {
      // Generate PDF using the deployment-provided Chromium executable.
      const launchOptions: Parameters<typeof chromium.launch>[0] = {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      }
      const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH?.trim() || process.env.PUPPETEER_EXECUTABLE_PATH?.trim()
      if (executablePath) {
        launchOptions.executablePath = executablePath
      }
      browser = await chromium.launch(launchOptions)

      const page = await browser.newPage()

      // Create HTML content for PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${escapeHtml(proposal.projectTitle || "Proposal")}</title>
          <style>
            @page { size: A4; margin: 20mm 18mm 22mm; }
            :root { color-scheme: light; }
            body {
              font-family: Inter, "Segoe UI", Arial, sans-serif;
              line-height: 1.65;
              color: #0d1b2a;
              max-width: 760px;
              margin: 0 auto;
              padding: 0;
            }
            h1 {
              color: #0d1b2a;
              font-size: 28px;
              letter-spacing: -0.02em;
              margin: 0 0 20px;
              padding-bottom: 10px;
              border-bottom: 2px solid #18a6a6;
            }
            h2 {
              color: #0e7373;
              font-size: 22px;
              letter-spacing: -0.01em;
              margin: 32px 0 12px;
              break-after: avoid;
            }
            h3 {
              color: #1b263b;
              font-size: 18px;
              margin: 22px 0 8px;
              break-after: avoid;
            }
            p {
              margin: 0 0 14px;
            }
            ul {
              margin: 0 0 16px;
              padding-left: 22px;
            }
            li {
              margin-bottom: 6px;
            }
            .cover-page {
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: center;
              min-height: 235mm;
              margin-bottom: 20mm;
              padding: 24mm 18mm;
              border: 1px solid #b7c9d7;
              border-top: 8px solid #0e7373;
              background: #f4f6f8;
              break-inside: avoid;
              break-after: page;
            }
            .cover-page h1 {
              border: none;
              font-size: 38px;
              margin: 12px 0 18px;
              max-width: 600px;
            }
            .cover-page .eyebrow {
              color: #0e7373;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.16em;
              margin: 0;
              text-transform: uppercase;
            }
            .cover-page .cover-meta {
              color: #667085;
              font-size: 14px;
              margin: 0;
            }
            .section {
              margin-bottom: 30px;
            }
            hr {
              border: none;
              border-top: 1px solid #d7e0e7;
              margin: 30px 0;
            }
          </style>
        </head>
        <body>
          ${formatContentForPDF(proposal.content, proposal.clientName, proposal.clientCompany)}
        </body>
        </html>
      `

      await page.setContent(htmlContent, { waitUntil: "load" })

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: `<div style="width:100%;padding:0 18mm;color:#667085;font:9px Arial,sans-serif;display:flex;justify-content:space-between;"><span>${escapeHtml(proposal.projectTitle || "Proposal")}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
        margin: {
          top: "20mm",
          right: "20mm",
          bottom: "20mm",
          left: "20mm",
        },
      })

      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeFilename(proposal.projectTitle, "proposal")}.pdf"`,
          "X-Request-ID": requestId,
        },
      })
    } else if (format === "docx") {
      // Generate DOCX using docx library
      const doc = new Document({
        creator: "PitchGenie",
        title: proposal.projectTitle || "Proposal",
        description: "Business proposal generated and edited in PitchGenie.",
        sections: [
          {
            properties: {
              page: {
                margin: { top: 1_440, right: 1_440, bottom: 1_440, left: 1_440 },
              },
            },
            footers: {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({ text: "PitchGenie · Page ", color: "667085", size: 18 }),
                      new TextRun({ children: [PageNumber.CURRENT], color: "667085", size: 18 }),
                    ],
                  }),
                ],
              }),
            },
            children: [
              new Paragraph({ text: "PITCHGENIE / PROPOSAL", heading: HeadingLevel.HEADING_3 }),
              new Paragraph({ text: proposal.projectTitle || "Proposal", heading: HeadingLevel.TITLE }),
              ...(proposal.clientName || proposal.clientCompany
                ? [new Paragraph({ text: `Prepared for ${[proposal.clientName, proposal.clientCompany].filter(Boolean).join(" · ")}` })]
                : []),
              new Paragraph({ text: "", pageBreakBefore: true }),
              ...(await formatContentForDOCX(proposal.content)),
            ],
          },
        ],
      })

      const buffer = await Packer.toBuffer(doc)

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${safeFilename(proposal.projectTitle, "proposal")}.docx"`,
          "X-Request-ID": requestId,
        },
      })
    }

    return json({ error: "Invalid format", requestId }, { status: 400 })
  } catch (error) {
    console.error("Error exporting proposal", {
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    })
    return json({ error: "Failed to export proposal", requestId }, { status: 500 })
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.error("Error closing proposal export browser", {
          requestId,
          error: closeError instanceof Error ? closeError.name : "unknown",
        })
      }
    }
  }
}

function formatContentForPDF(content: string, clientName: string | null, clientCompany: string | null): string {
  const output: string[] = []
  const listItems: string[] = []
  let firstHeading = true

  const flushList = () => {
    if (listItems.length === 0) return
    output.push(`<ul>${listItems.splice(0).join("")}</ul>`)
  }

  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith("- ")) {
      listItems.push(`<li>${escapeHtml(line.slice(2))}</li>`)
      continue
    }
    flushList()

    if (line.startsWith("# ")) {
      const title = escapeHtml(line.slice(2))
      if (firstHeading) {
        const recipient = [clientName, clientCompany].filter(Boolean).join(" · ")
        output.push(`<section class="cover-page"><p class="eyebrow">PitchGenie / Proposal</p><h1>${title}</h1>${recipient ? `<p class="cover-meta">Prepared for ${escapeHtml(recipient)}</p>` : ""}</section>`)
      } else {
        output.push(`<h1>${title}</h1>`)
      }
      firstHeading = false
      continue
    }
    if (line.startsWith("## ")) {
      output.push(`<h2>${escapeHtml(line.slice(3))}</h2>`)
      continue
    }
    if (line.startsWith("### ")) {
      output.push(`<h3>${escapeHtml(line.slice(4))}</h3>`)
      continue
    }
    if (line.startsWith("**") && line.endsWith("**")) {
      output.push(`<p><strong>${escapeHtml(line.slice(2, -2))}</strong></p>`)
      continue
    }
    if (line.startsWith("---")) {
      output.push("<hr>")
      continue
    }
    if (line.trim() !== "") output.push(`<p>${escapeHtml(line)}</p>`)
  }

  flushList()
  return output.join("")
}

async function formatContentForDOCX(content: string): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = []

  content.split("\n").forEach((line) => {
    if (line.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace("# ", ""),
          heading: HeadingLevel.HEADING_1,
        }),
      )
    } else if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace("## ", ""),
          heading: HeadingLevel.HEADING_2,
        }),
      )
    } else if (line.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace("### ", ""),
          heading: HeadingLevel.HEADING_3,
        }),
      )
    } else if (line.startsWith("**") && line.endsWith("**")) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line.replace(/\*\*/g, ""),
              bold: true,
            }),
          ],
        }),
      )
    } else if (line.startsWith("- ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace("- ", ""),
          bullet: {
            level: 0,
          },
        }),
      )
    } else if (line.trim() !== "" && !line.startsWith("---")) {
      paragraphs.push(
        new Paragraph({
          text: line,
        }),
      )
    }
  })

  return paragraphs
}
