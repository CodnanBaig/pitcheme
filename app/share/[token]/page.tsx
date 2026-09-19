import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import { sanitizeGeneratedHtml } from "@/lib/sanitize-html"
import { hashDocumentShareToken, isPersistentDocumentShareToken, verifyDocumentShareToken } from "@/lib/share-token"
import { BrandMark } from "@/components/brand-mark"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"
export const metadata = {
  robots: { index: false, follow: false },
}

const sharedDeckStyles = `
  .shared-deck { color: #0D1B2A; font-family: 'Segoe UI', Arial, sans-serif; }
  .shared-deck .slide { position: relative; margin: 0 auto 20px; max-width: 1000px; min-height: 520px; padding: 42px; box-sizing: border-box; background: #fff; border: 1px solid #D7E0E7; border-top: 5px solid #18A6A6; box-shadow: 0 12px 30px rgba(13, 27, 42, .08); page-break-after: always; }
  .shared-deck .slide:last-child { page-break-after: avoid; }
  .shared-deck h1 { color: #0D1B2A; font-size: 32px; margin: 0 0 24px; }
  .shared-deck h2 { color: #0E7373; font-size: 24px; margin: 0 0 16px; }
  .shared-deck h3 { color: #1B263B; font-size: 18px; margin: 0 0 8px; }
  .shared-deck ul { font-size: 18px; line-height: 1.6; padding-left: 22px; }
  .shared-deck p { line-height: 1.55; }
  .shared-deck .visual-elements, .shared-deck .speaker-notes { margin-top: 24px; padding: 16px; background: #F4F6F8; border-left: 3px solid #18A6A6; }
  @media (max-width: 700px) { .shared-deck .slide { min-height: 0; padding: 28px; } }
`

type SharedDocument = {
  type: string
  clientName: string | null
  clientCompany: string | null
  projectTitle: string | null
  content: string
}

async function getSharedDocument(token: string): Promise<SharedDocument | null> {
  const payload = verifyDocumentShareToken(token)
  if (!payload || !isPersistentDocumentShareToken(token)) return null

  const now = new Date()
  const access = await prisma.documentShare.updateMany({
    where: {
      tokenHash: hashDocumentShareToken(token),
      documentId: payload.documentId,
      // Prisma's MongoDB connector omits optional fields when they are not
      // set, so a newly issued link may have no `revokedAt` field at all.
      OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }],
      expiresAt: { gt: now },
    },
    data: {
      accessCount: { increment: 1 },
      lastAccessedAt: now,
    },
  })
  if (access.count !== 1) return null

  return prisma.document.findFirst({
    where: { id: payload.documentId },
    select: {
      type: true,
      clientName: true,
      clientCompany: true,
      projectTitle: true,
      content: true,
    },
  })
}

function renderProposal(content: string) {
  return content.split("\n").map((line, index) => {
    if (line.startsWith("# ")) return <h1 key={index} className="mt-8 mb-4 text-3xl font-bold first:mt-0">{line.slice(2)}</h1>
    if (line.startsWith("## ")) return <h2 key={index} className="mt-6 mb-3 text-2xl font-semibold">{line.slice(3)}</h2>
    if (line.startsWith("### ")) return <h3 key={index} className="mt-4 mb-2 text-xl font-semibold">{line.slice(4)}</h3>
    if (line.startsWith("**") && line.endsWith("**")) return <p key={index} className="mb-2 font-semibold">{line.slice(2, -2)}</p>
    if (line.startsWith("- ")) return <li key={index} className="ml-4 mb-1 list-disc">{line.slice(2)}</li>
    if (line.startsWith("---")) return <hr key={index} className="my-6 border-border" />
    if (!line.trim()) return <br key={index} />
    return <p key={index} className="mb-3">{line}</p>
  })
}

export default async function SharedDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const document = await getSharedDocument(token)
  if (!document) notFound()

  const title = document.projectTitle || document.clientName || "Shared document"
  const isPitchDeck = document.type === "pitch-deck"
  const safePitchDeckContent = isPitchDeck ? sanitizeGeneratedHtml(document.content) : ""

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      {isPitchDeck && <style dangerouslySetInnerHTML={{ __html: sharedDeckStyles }} />}
      <div className="mx-auto max-w-5xl">
        <div className="mb-8"><BrandMark href="/" /></div>
        <header className="mb-8 flex items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Secure shared view</p>
            <h1 className="mt-2 text-2xl font-bold text-foreground">{title}</h1>
            {document.clientCompany && <p className="mt-1 text-sm text-muted-foreground">{document.clientCompany}</p>}
          </div>
          <Badge variant="secondary">Read only</Badge>
        </header>

        <Card className="border-border bg-card">
          <CardContent className="pt-8">
            {isPitchDeck ? (
              safePitchDeckContent.includes('class="slide"') ? (
                <div className="shared-deck" dangerouslySetInnerHTML={{ __html: safePitchDeckContent }} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-foreground">{document.content}</pre>
              )
            ) : (
              <article className="prose prose-gray max-w-none whitespace-pre-wrap text-foreground">{renderProposal(document.content)}</article>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          This link is read-only and expires automatically. Contact the owner for an updated link.
        </p>
      </div>
    </main>
  )
}
