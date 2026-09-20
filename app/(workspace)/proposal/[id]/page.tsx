import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExportButton } from "@/components/export-button"
import { ShareButton } from "@/components/share-button"
import { Edit, FileText } from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { isMongoObjectId } from "@/lib/mongo-id"

export const runtime = "nodejs"

interface ProposalPageProps {
  params: Promise<{
    id: string
  }>
}

// Function to get proposal data from database
async function getProposal(id: string, userId: string) {
  if (!isMongoObjectId(id)) return null
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
    status: "completed", // All generated documents are considered completed
  }
}

export default async function ProposalPage({ params }: ProposalPageProps) {
  const resolvedParams = await params
  const session = await auth()

  if (!session) {
    redirect("/auth/signin")
  }

  const proposal = await getProposal(resolvedParams.id, session.user.id)

  if (!proposal) {
    notFound()
  }

  return (
    <>
        <div className="mx-auto max-w-4xl">
          {/* Proposal Header */}
          <div className="mb-6 flex flex-col justify-between gap-5 border-b border-border pb-6 sm:flex-row sm:items-end">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Proposal</p><Badge variant="secondary">Completed</Badge></div>
                <h1 className="text-2xl font-semibold text-foreground">{proposal.projectTitle}</h1>
                <p className="text-muted-foreground">
                  For {proposal.clientName}
                  {proposal.clientCompany && ` at ${proposal.clientCompany}`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ShareButton documentId={proposal.id} />
              <Button variant="outline" size="sm" asChild><Link href={`/documents/${proposal.id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit</Link></Button>
              <ExportButton documentId={proposal.id} documentType="proposal" documentTitle={proposal.projectTitle || "Proposal"} />
            </div>
          </div>

          {/* Proposal Content */}
          <Card className="border-border bg-card">
            <CardContent className="pt-8">
              <div className="prose prose-gray max-w-none">
                <div
                  className="whitespace-pre-wrap text-foreground leading-relaxed"
                  style={{
                    fontFamily: "inherit",
                    lineHeight: "1.7",
                  }}
                >
                  {proposal.content.split("\n").map((line: string, index: number) => {
                    if (line.startsWith("# ")) {
                      return (
                        <h1 key={index} className="text-3xl font-bold text-foreground mt-8 mb-4 first:mt-0">
                          {line.replace("# ", "")}
                        </h1>
                      )
                    }
                    if (line.startsWith("## ")) {
                      return (
                        <h2 key={index} className="text-2xl font-semibold text-foreground mt-6 mb-3">
                          {line.replace("## ", "")}
                        </h2>
                      )
                    }
                    if (line.startsWith("### ")) {
                      return (
                        <h3 key={index} className="text-xl font-semibold text-foreground mt-4 mb-2">
                          {line.replace("### ", "")}
                        </h3>
                      )
                    }
                    if (line.startsWith("**") && line.endsWith("**")) {
                      return (
                        <p key={index} className="font-semibold text-foreground mb-2">
                          {line.replace(/\*\*/g, "")}
                        </p>
                      )
                    }
                    if (line.startsWith("- ")) {
                      return (
                        <li key={index} className="text-foreground mb-1 ml-4">
                          {line.replace("- ", "")}
                        </li>
                      )
                    }
                    if (line.startsWith("---")) {
                      return <hr key={index} className="my-6 border-border" />
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
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <ShareButton documentId={proposal.id} size="lg" allowRevoke />
            <Button variant="outline" size="lg" asChild>
              <Link href={`/documents/${proposal.id}/edit`}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Proposal
              </Link>
            </Button>
            <ExportButton documentId={proposal.id} documentType="proposal" documentTitle={proposal.projectTitle || "Proposal"} />
          </div>
        </div>
    </>
  )
}
