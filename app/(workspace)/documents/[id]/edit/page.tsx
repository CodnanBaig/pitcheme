import { auth } from "@/auth"
import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { DocumentEditorShell } from "@/components/document-editor-shell"
import { isMongoObjectId } from "@/lib/mongo-id"
import { getDocumentRevision } from "@/lib/document-revision"

export const runtime = "nodejs"

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const { id } = await params
  if (!isMongoObjectId(id)) notFound()
  const document = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!document) notFound()

  return (
    <DocumentEditorShell
      document={{
        id: document.id,
        type: document.type,
        clientName: document.clientName,
        clientCompany: document.clientCompany,
        projectTitle: document.projectTitle,
        content: document.content,
        revision: getDocumentRevision(document),
      }}
    />
  )
}
