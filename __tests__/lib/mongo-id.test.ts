import { isMongoObjectId } from "@/lib/mongo-id"

describe("isMongoObjectId", () => {
  it("accepts 24-character hexadecimal IDs", () => {
    expect(isMongoObjectId("507f1f77bcf86cd799439011")).toBe(true)
  })

  it("rejects malformed or non-string IDs", () => {
    expect(isMongoObjectId("document-1")).toBe(false)
    expect(isMongoObjectId("507f1f77bcf86cd79943901")).toBe(false)
    expect(isMongoObjectId(null)).toBe(false)
  })
})
