import { auth } from "@/auth"
import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { DocumentEditor } from "@/components/document-editor"
import { isMongoObjectId } from "@/lib/mongo-id"

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
    <DocumentEditor
      document={{
        id: document.id,
        type: document.type,
        clientName: document.clientName,
        clientCompany: document.clientCompany,
        projectTitle: document.projectTitle,
        content: document.content,
      }}
    />
  )
}
