import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isMongoObjectId } from "@/lib/mongo-id"

export async function POST(_request: NextRequest, props: { params: Promise<{ id: string; version: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, version: versionParam } = await props.params
  if (!isMongoObjectId(id)) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 })
  }
  const versionNumber = Number(versionParam)
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return NextResponse.json({ error: "Invalid version" }, { status: 400 })
  }

  try {
    const document = await prisma.document.findFirst({ where: { id, userId: session.user.id } })
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const version = await prisma.documentVersion.findFirst({
      where: { documentId: document.id, userId: session.user.id, version: versionNumber },
    })
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        clientName: version.clientName,
        clientCompany: version.clientCompany,
        projectTitle: version.projectTitle,
        content: version.content,
        metadata: version.metadata,
      },
    })

    const latest = await prisma.documentVersion.findFirst({
      where: { documentId: document.id, userId: session.user.id },
      orderBy: { version: "desc" },
    })
    await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        userId: session.user.id,
        version: (latest?.version ?? versionNumber) + 1,
        type: document.type,
        clientName: version.clientName,
        clientCompany: version.clientCompany,
        projectTitle: version.projectTitle,
        content: version.content,
        metadata: version.metadata,
      },
    })

    return NextResponse.json({ document: updated, restoredFrom: versionNumber })
  } catch {
    return NextResponse.json({ error: "Unable to restore document version" }, { status: 500 })
  }
}
