import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { DocumentsWorkspace, type DocumentListItem } from "@/components/documents-workspace"
import { getServerRequestId, reportServerRouteError } from "@/lib/server-error-telemetry"

export const runtime = "nodejs"

export default async function DocumentsPage() {
  const requestId = await getServerRequestId()
  const session = await auth()

  if (!session) {
    redirect("/auth/signin")
  }

  try {
    // Fetch real documents from database
    const documents = await prisma.document.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        type: true,
        clientName: true,
        projectTitle: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 101,
    })
    const hasMore = documents.length > 100
    return <DocumentsWorkspace
      user={{ name: session.user?.name, email: session.user?.email }}
      hasMore={hasMore}
      documents={documents.slice(0, 100).map((document): DocumentListItem => ({
        id: document.id,
        type: document.type,
        clientName: document.clientName,
        projectTitle: document.projectTitle,
        createdAt: document.createdAt.toISOString(),
      }))}
    />
  } catch (error) {
    reportServerRouteError({
      requestId,
      path: "/documents",
      category: "documents-data",
      error,
    })
    return <DocumentsWorkspace
      user={{ name: session.user?.name, email: session.user?.email }}
      documents={[]}
      loadError
    />
  }
}
