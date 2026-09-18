import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isMongoObjectId } from "@/lib/mongo-id"

export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await props.params
  if (!isMongoObjectId(id)) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 })
  }

  try {
    const source = await prisma.document.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!source) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const copy = await prisma.document.create({
      data: {
        userId: session.user.id,
        type: source.type,
        clientName: source.clientName,
        clientCompany: source.clientCompany,
        projectTitle: `${source.projectTitle || source.clientName || "Untitled document"} (Copy)`,
        content: source.content,
        metadata: source.metadata,
      },
    })

    return NextResponse.json({ document: copy }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Unable to duplicate document" }, { status: 500 })
  }
}
