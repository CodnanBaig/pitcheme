import { validateGeneratedContent } from "@/lib/generation-output"

describe("generated content validation", () => {
  it("accepts non-empty proposal and pitch-deck content", () => {
    expect(validateGeneratedContent("# Proposal", "proposal")).toEqual({ valid: true, content: "# Proposal" })
    expect(validateGeneratedContent('<div class="slide">Title</div>', "pitch-deck").valid).toBe(true)
  })

  it("rejects empty and oversized provider output", () => {
    expect(validateGeneratedContent("   ", "proposal")).toEqual({ valid: false, error: "AI provider returned empty content" })
    expect(validateGeneratedContent("x".repeat(200_001), "pitch-deck")).toEqual({ valid: false, error: "AI provider returned content that is too large" })
  })
})
