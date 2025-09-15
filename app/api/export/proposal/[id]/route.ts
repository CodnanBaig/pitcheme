import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import puppeteer from "puppeteer"
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx"
import { prisma } from "@/lib/prisma"

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
  try {
    const session = await auth()

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || "pdf"

    const proposal = await getProposal(params.id, session.user.id)

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    if (format === "pdf") {
      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      })

      const page = await browser.newPage()

      // Create HTML content for PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${proposal.projectTitle}</title>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px 20px;
            }
            h1 {
              color: #15803d;
              font-size: 28px;
              margin-bottom: 20px;
              border-bottom: 3px solid #15803d;
              padding-bottom: 10px;
            }
            h2 {
              color: #15803d;
              font-size: 22px;
              margin-top: 30px;
              margin-bottom: 15px;
            }
            h3 {
              color: #374151;
              font-size: 18px;
              margin-top: 20px;
              margin-bottom: 10px;
            }
            p {
              margin-bottom: 15px;
            }
            ul {
              margin-bottom: 15px;
            }
            li {
              margin-bottom: 5px;
            }
            .cover-page {
              text-align: center;
              margin-bottom: 50px;
              padding: 40px;
              border: 2px solid #15803d;
              border-radius: 10px;
            }
            .cover-page h1 {
              border: none;
              margin-bottom: 10px;
            }
            .section {
              margin-bottom: 30px;
            }
            hr {
              border: none;
              border-top: 1px solid #e5e7eb;
              margin: 30px 0;
            }
          </style>
        </head>
        <body>
          ${formatContentForPDF(proposal.content)}
        </body>
        </html>
      `

      await page.setContent(htmlContent, { waitUntil: "networkidle0" })

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "20mm",
          right: "20mm",
          bottom: "20mm",
          left: "20mm",
        },
      })

      await browser.close()

      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${(proposal.projectTitle || "proposal").replace(/[^a-z0-9]/gi, "_")}.pdf"`,
        },
      })
    } else if (format === "docx") {
      // Generate DOCX using docx library
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: await formatContentForDOCX(proposal.content),
          },
        ],
      })

      const buffer = await Packer.toBuffer(doc)

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${(proposal.projectTitle || "proposal").replace(/[^a-z0-9]/gi, "_")}.docx"`,
        },
      })
    }

    return NextResponse.json({ error: "Invalid format" }, { status: 400 })
  } catch (error) {
    console.error("Error exporting proposal:", error)
    return NextResponse.json({ error: "Failed to export proposal" }, { status: 500 })
  }
}

function formatContentForPDF(content: string): string {
  return content
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) {
        return `<h1>${line.replace("# ", "")}</h1>`
      }
      if (line.startsWith("## ")) {
        return `<h2>${line.replace("## ", "")}</h2>`
      }
      if (line.startsWith("### ")) {
        return `<h3>${line.replace("### ", "")}</h3>`
      }
      if (line.startsWith("**") && line.endsWith("**")) {
        return `<p><strong>${line.replace(/\*\*/g, "")}</strong></p>`
      }
      if (line.startsWith("- ")) {
        return `<li>${line.replace("- ", "")}</li>`
      }
      if (line.startsWith("---")) {
        return "<hr>"
      }
      if (line.trim() === "") {
        return "<br>"
      }
      return `<p>${line}</p>`
    })
    .join("")
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
