import { normalizeStructuredOutput } from "@/lib/structured-output"
import { validateGeneratedContent } from "@/lib/generation-output"
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit"
import { safeFilename } from "@/lib/safe-filename"
import { sanitizeGeneratedHtml } from "@/lib/sanitize-html"

describe("performance contracts", () => {
  afterEach(() => {
    resetRateLimits()
  })

  it("handles a burst of bounded rate-limit checks without exceeding the guard window", () => {
    const startedAt = performance.now()
    const results = Array.from({ length: 1_000 }, (_, index) =>
      checkRateLimit(`performance-${index}`, { limit: 2, windowMs: 60_000 }),
    )

    expect(results).toHaveLength(1_000)
    expect(results.every((result) => result.allowed)).toBe(true)
    expect(performance.now() - startedAt).toBeLessThan(500)
  })

  it("normalizes a structured document within the generation content bound", () => {
    const raw = JSON.stringify({
      title: "Performance proposal",
      executiveSummary: "A measurable delivery plan.",
      sections: [{ heading: "Scope", body: "A bounded scope.", bullets: ["One outcome"] }],
    })

    const normalized = normalizeStructuredOutput(raw, "proposal")

    expect(normalized.format).toBe("structured-json")
    expect(validateGeneratedContent(normalized.content, "proposal")).toMatchObject({ valid: true })
    expect(normalized.content.length).toBeLessThan(200_000)
  })

  it("sanitizes repeated slide markup without retaining executable attributes", () => {
    const raw = Array.from({ length: 100 }, (_, index) =>
      `<div class="slide" onclick="bad(${index})"><p>Slide ${index}</p><script>bad()</script></div>`,
    ).join("")

    const sanitized = sanitizeGeneratedHtml(raw)

    expect((sanitized.match(/class="slide"/g) || []).length).toBe(100)
    expect(sanitized).not.toContain("onclick")
    expect(sanitized).not.toContain("<script")
  })

  it("keeps export filenames bounded and portable", () => {
    const filename = safeFilename("../../Quarterly: review / <draft>", "proposal")

    expect(filename).toBe("Quarterly_review_draft")
    expect(filename).not.toMatch(/[/:<>]/)
    expect(filename.length).toBeLessThanOrEqual(120)
  })

  it("preserves all results under concurrent bounded work", async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, async (_, index) => ({ index, value: `work-${index}` })),
    )

    expect(results).toHaveLength(100)
    expect(results[0]).toEqual({ index: 0, value: "work-0" })
    expect(results[99]).toEqual({ index: 99, value: "work-99" })
  })
})
