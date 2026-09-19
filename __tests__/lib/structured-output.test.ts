import { inspectStructuredOutput, normalizeStructuredOutput } from "@/lib/structured-output"

describe("structured generation output", () => {
  it("normalizes proposal JSON into the existing renderer format", () => {
    const result = normalizeStructuredOutput(JSON.stringify({
      title: "Acme proposal",
      executiveSummary: "A focused delivery plan.",
      sections: [{ heading: "Scope", body: "Build the core workflow.", bullets: ["Discovery", "Delivery"] }],
    }), "proposal")

    expect(result.format).toBe("structured-json")
    expect(result.content).toContain("# Acme proposal")
    expect(result.content).toContain("- Discovery")
  })

  it("normalizes bounded pricing rows into a Markdown table", () => {
    const result = normalizeStructuredOutput(JSON.stringify({
      title: "Commercial proposal",
      executiveSummary: "A clear delivery plan.",
      sections: [{ heading: "Scope", body: "A focused scope.", bullets: ["Discovery"] }],
      pricing: [
        { item: "Discovery", description: "Requirements and planning", amount: "$5,000" },
        { item: "Delivery", description: "Implementation | QA", amount: "TBD" },
      ],
    }), "proposal")

    expect(result.format).toBe("structured-json")
    expect(result.content).toContain("| Item | Description | Amount |")
    expect(result.content).toContain("| Delivery | Implementation \\| QA | TBD |")
  })

  it("normalizes pitch slides and escapes generated text", () => {
    const result = normalizeStructuredOutput(JSON.stringify({
      slides: [{ title: "Problem", bullets: ["<script>alert(1)</script>"], visualSuggestion: "Market chart" }],
    }), "pitch-deck")

    expect(result.format).toBe("structured-json")
    expect(result.content).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
    expect(result.content).toContain('class="slide"')
  })

  it("keeps legacy provider text available as a controlled fallback", () => {
    expect(normalizeStructuredOutput("# Existing markdown", "proposal")).toEqual({
      content: "# Existing markdown",
      format: "legacy-text",
    })
  })

  it("rejects incomplete proposal contracts", () => {
    const result = inspectStructuredOutput(JSON.stringify({ title: "Missing sections" }), "proposal")

    expect(result.candidate).toBe(true)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining(["executiveSummary is required", "sections must be an array"]))
  })

  it("rejects oversized or incomplete pricing rows", () => {
    const result = inspectStructuredOutput(JSON.stringify({
      title: "Pricing",
      executiveSummary: "Summary",
      sections: [{ heading: "Scope", body: "Body", bullets: [] }],
      pricing: [{ item: "Missing amount" }],
    }), "proposal")

    expect(result.valid).toBe(false)
    expect(result.errors).toContain("pricing[0].amount is required")
  })

  it("rejects empty pitch slides while leaving markdown outside the contract", () => {
    expect(inspectStructuredOutput(JSON.stringify({ slides: [] }), "pitch-deck")).toMatchObject({
      candidate: true,
      valid: false,
    })
    expect(inspectStructuredOutput("# Legacy deck", "pitch-deck")).toEqual({
      candidate: false,
      valid: false,
      errors: [],
    })
  })
})
