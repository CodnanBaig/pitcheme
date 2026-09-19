import { NextRequest } from "next/server"
import { getDocumentRevision, getIfMatchRevision, revisionHeaders } from "@/lib/document-revision"

const document = {
  clientName: "Acme",
  clientCompany: "Acme Inc",
  projectTitle: "Website proposal",
  content: "# Proposal",
  metadata: '{"model":"test"}',
}

describe("document revisions", () => {
  it("creates a stable opaque token from editable state", () => {
    const revision = getDocumentRevision(document)

    expect(revision).toMatch(/^[a-f0-9]{64}$/)
    expect(revision).not.toContain(document.projectTitle)
    expect(getDocumentRevision({ ...document })).toBe(revision)
    expect(getDocumentRevision({ ...document, content: "# Updated" })).not.toBe(revision)
  })

  it("accepts quoted and unquoted If-Match hashes while rejecting malformed values", () => {
    const revision = getDocumentRevision(document)

    expect(getIfMatchRevision(new NextRequest("http://localhost", { headers: { "If-Match": `"${revision}"` } }))).toBe(revision)
    expect(getIfMatchRevision(new NextRequest("http://localhost", { headers: { "If-Match": revision.toUpperCase() } }))).toBe(revision)
    expect(getIfMatchRevision(new NextRequest("http://localhost"))).toBeNull()
    expect(getIfMatchRevision(new NextRequest("http://localhost", { headers: { "If-Match": "not-a-revision" } }))).toBeNull()
    expect(getIfMatchRevision(new NextRequest("http://localhost", { headers: { "If-Match": "*" } }))).toBeNull()
  })

  it("formats the revision as a quoted ETag", () => {
    const revision = getDocumentRevision(document)

    expect(revisionHeaders(revision).get("ETag")).toBe(`"${revision}"`)
  })
})
