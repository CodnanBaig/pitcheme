import { auth } from "@/auth"
import { type Prisma } from "@prisma/client"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const documentTypes = new Set(["proposal", "pitch-deck"])

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = new URL(request.url).searchParams
  const query = searchParams.get("q")?.trim()
  const requestedType = searchParams.get("type")
  const sort = searchParams.get("sort") === "oldest" ? "asc" : "desc"
  const limitValue = Number(searchParams.get("limit") || 100)
  const take = Number.isFinite(limitValue) ? Math.min(Math.max(Math.floor(limitValue), 1), 100) : 100
  const pageValue = Number(searchParams.get("page") || 1)
  const page = Number.isFinite(pageValue) ? Math.min(Math.max(Math.floor(pageValue), 1), 10_000) : 1

  const where: Prisma.DocumentWhereInput = {
    userId: session.user.id,
  }

  if (requestedType && documentTypes.has(requestedType)) {
    where.type = requestedType
  }

  if (query) {
    where.OR = [
      { projectTitle: { contains: query } },
      { clientName: { contains: query } },
      { clientCompany: { contains: query } },
    ]
  }

  try {
    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: sort },
      skip: (page - 1) * take,
      take: take + 1,
    })
    const hasMore = documents.length > take

    return NextResponse.json({ documents: hasMore ? documents.slice(0, take) : documents, page, hasMore })
  } catch {
    return NextResponse.json({ error: "Unable to load documents" }, { status: 500 })
  }
}
