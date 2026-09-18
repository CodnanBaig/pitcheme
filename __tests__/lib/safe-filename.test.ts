import { safeFilename } from "@/lib/safe-filename"

describe("safeFilename", () => {
  it("normalizes punctuation and whitespace into one separator", () => {
    expect(safeFilename("Project @#$%& with Special Chars!!!", "proposal"))
      .toBe("Project_with_Special_Chars")
  })

  it("falls back when the value contains no usable characters", () => {
    expect(safeFilename("../../", "proposal")).toBe("proposal")
  })

  it("limits attachment names to a reasonable length", () => {
    expect(safeFilename("a".repeat(200), "proposal")).toHaveLength(120)
  })
})
