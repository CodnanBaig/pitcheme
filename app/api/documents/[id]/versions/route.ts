import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isMongoObjectId } from "@/lib/mongo-id"

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await props.params
  if (!isMongoObjectId(id)) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 })
  }

  try {
    const document = await prisma.document.findFirst({ where: { id, userId: session.user.id } })
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const versions = await prisma.documentVersion.findMany({
      where: { documentId: document.id, userId: session.user.id },
      orderBy: { version: "desc" },
      take: 50,
    })

    return NextResponse.json({ versions })
  } catch {
    return NextResponse.json({ error: "Unable to load document versions" }, { status: 500 })
  }
}
