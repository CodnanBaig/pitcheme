import { auth } from "@/auth"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isMongoObjectId } from "@/lib/mongo-id"

type EditableDocumentFields = {
  clientName?: string | null
  clientCompany?: string | null
  projectTitle?: string | null
  content?: string
}

const MAX_CONTENT_LENGTH = 1_000_000
const editableFields = new Set<keyof EditableDocumentFields>(["clientName", "clientCompany", "projectTitle", "content"])

async function getOwnedDocument(id: string, userId: string) {
  return prisma.document.findFirst({
    where: { id, userId },
  })
}

async function createVersion(document: {
  id: string
  type: string
  clientName: string | null
  clientCompany: string | null
  projectTitle: string | null
  content: string
  metadata: string | null
}, userId: string) {
  const latest = await prisma.documentVersion.findFirst({
    where: { documentId: document.id, userId },
    orderBy: { version: "desc" },
  })

  return prisma.documentVersion.create({
    data: {
      documentId: document.id,
      userId,
      version: (latest?.version ?? 0) + 1,
      type: document.type,
      clientName: document.clientName,
      clientCompany: document.clientCompany,
      projectTitle: document.projectTitle,
      content: document.content,
      metadata: document.metadata,
    },
  })
}

function parseEditableFields(value: unknown):
  | { valid: true; data: EditableDocumentFields }
  | { valid: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, error: "Request body must be a JSON object" }
  }

  const input = value as Record<string, unknown>
  const unknownField = Object.keys(input).find((key) => !editableFields.has(key as keyof EditableDocumentFields))
  if (unknownField) {
    return { valid: false, error: `Field is not editable: ${unknownField}` }
  }

  const data: EditableDocumentFields = {}
  for (const field of editableFields) {
    if (!(field in input)) continue
    const fieldValue = input[field]

    if (field === "content") {
      if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
        return { valid: false, error: "content must be a non-empty string" }
      }
      if (fieldValue.length > MAX_CONTENT_LENGTH) {
        return { valid: false, error: "content is too large" }
      }
      data.content = fieldValue
      continue
    }

    if (fieldValue !== null && typeof fieldValue !== "string") {
      return { valid: false, error: `${field} must be a string or null` }
    }
    if (typeof fieldValue === "string" && fieldValue.length > 500) {
      return { valid: false, error: `${field} is too large` }
    }
    data[field] = fieldValue as string | null
  }

  if (Object.keys(data).length === 0) {
    return { valid: false, error: "At least one editable field is required" }
  }

  return { valid: true, data }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await props.params
  if (!isMongoObjectId(id)) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
  }

  const parsed = parseEditableFields(body)
  if (!parsed.valid) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const document = await getOwnedDocument(id, session.user.id)
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const hasChanges = Object.entries(parsed.data).some(([field, value]) => {
      return document[field as keyof typeof parsed.data] !== value
    })
    if (!hasChanges) {
      return NextResponse.json({ document })
    }

    const nextDocument = {
      ...document,
      ...parsed.data,
    }
    await createVersion(nextDocument, session.user.id)

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: parsed.data,
    })

    return NextResponse.json({ document: updated })
  } catch {
    return NextResponse.json({ error: "Unable to update document" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await props.params
  if (!isMongoObjectId(id)) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 })
  }

  try {
    const document = await getOwnedDocument(id, session.user.id)
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // MongoDB does not apply relational cascades for these Prisma relations.
    // Remove snapshots and detach generation records before deleting the document
    // so edited documents remain deletable without losing usage/audit history.
    await prisma.documentVersion.deleteMany({
      where: { documentId: document.id, userId: session.user.id },
    })
    await prisma.generation.updateMany({
      where: { documentId: document.id, userId: session.user.id },
      data: { documentId: null },
    })
    await prisma.document.delete({ where: { id: document.id } })
    return NextResponse.json({ message: "Document deleted" })
  } catch {
    return NextResponse.json({ error: "Unable to delete document" }, { status: 500 })
  }
}
