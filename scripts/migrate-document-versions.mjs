import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const batchSize = 250
const applyChanges = process.env.MIGRATE_DOCUMENT_VERSIONS_CONFIRM === "apply"

async function scanDocumentsWithoutVersions(onCandidates) {
  let missing = 0
  let cursor

  while (true) {
    const documents = await prisma.document.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      take: batchSize,
      select: {
        id: true,
        userId: true,
        type: true,
        clientName: true,
        clientCompany: true,
        projectTitle: true,
        content: true,
        metadata: true,
      },
    })

    if (documents.length === 0) break

    const versions = await prisma.documentVersion.findMany({
      where: { documentId: { in: documents.map((document) => document.id) } },
      select: { documentId: true },
      distinct: ["documentId"],
    })
    const documentsWithVersions = new Set(versions.map((version) => version.documentId))

    const candidates = documents.filter((document) => !documentsWithVersions.has(document.id))
    missing += candidates.length
    await onCandidates(candidates)
    cursor = documents[documents.length - 1].id

    if (documents.length < batchSize) break
  }

  return missing
}

async function migrate() {
  let migrated = 0
  let skipped = 0

  const missing = await scanDocumentsWithoutVersions(async (candidates) => {
    if (!applyChanges) return

    for (const document of candidates) {
      try {
        await prisma.documentVersion.create({
          data: {
            documentId: document.id,
            userId: document.userId,
            version: 1,
            type: document.type,
            clientName: document.clientName,
            clientCompany: document.clientCompany,
            projectTitle: document.projectTitle,
            content: document.content,
            metadata: document.metadata,
          },
        })
        migrated += 1
      } catch (error) {
        // A concurrent migration may have inserted the same unique version.
        // Treat that as success only after confirming the snapshot exists.
        const existing = await prisma.documentVersion.findFirst({
          where: { documentId: document.id, version: 1 },
          select: { id: true },
        })
        if (!existing) throw error
        skipped += 1
      }
    }
  })

  if (!applyChanges) {
    console.log(`Dry run: ${missing} document(s) need an initial version snapshot.`)
    console.log("Set MIGRATE_DOCUMENT_VERSIONS_CONFIRM=apply to create the snapshots.")
    return
  }

  console.log(`Migration complete: ${migrated} snapshot(s) created, ${skipped} concurrent insert(s) skipped.`)
}

try {
  await migrate()
} finally {
  await prisma.$disconnect()
}
