import { createDocumentShareToken, documentShareTokenTtlMs, hashDocumentShareToken, isPersistentDocumentShareToken, verifyDocumentShareToken } from "@/lib/share-token"

describe("document share tokens", () => {
  const documentId = "507f1f77bcf86cd799439011"
  const now = 1_735_689_600_000

  it("creates a signed token with a bounded expiry", () => {
    const share = createDocumentShareToken(documentId, now)

    expect(share.documentId).toBe(documentId)
    expect(share.expiresAt).toBe(now + documentShareTokenTtlMs)
    expect(isPersistentDocumentShareToken(share.token)).toBe(true)
    expect(hashDocumentShareToken(share.token)).toMatch(/^[a-f0-9]{64}$/)
    expect(createDocumentShareToken(documentId, now).token).not.toBe(share.token)
    expect(verifyDocumentShareToken(share.token, now)).toEqual({
      documentId,
      expiresAt: now + documentShareTokenTtlMs,
    })
  })

  it("rejects tampered, malformed, and expired tokens", () => {
    const share = createDocumentShareToken(documentId, now)
    const parts = share.token.split(".")

    expect(verifyDocumentShareToken(`${parts.slice(0, -1).join(".")}.tampered`, now)).toBeNull()
    expect(verifyDocumentShareToken("v2.not-an-object-id.123.nonce.signature", now)).toBeNull()
    expect(verifyDocumentShareToken("v1.507f1f77bcf86cd799439011.123.signature", now)).toBeNull()
    expect(verifyDocumentShareToken(share.token, share.expiresAt)).toBeNull()
  })

  it("rejects invalid document ids before signing", () => {
    expect(() => createDocumentShareToken("not-an-object-id", now)).toThrow("Invalid document id")
  })
})
