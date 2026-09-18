import { estimateGenerationCost } from "@/lib/model-cost"

describe("generation cost estimates", () => {
  const originalRate = process.env.AI_COST_PER_MILLION_TOKENS

  afterEach(() => {
    if (originalRate === undefined) delete process.env.AI_COST_PER_MILLION_TOKENS
    else process.env.AI_COST_PER_MILLION_TOKENS = originalRate
  })

  it("treats free provider aliases as zero cost", () => {
    delete process.env.AI_COST_PER_MILLION_TOKENS
    expect(estimateGenerationCost("provider/model:free", 40_000)).toBe(0)
  })

  it("uses an optional blended paid-model rate", () => {
    process.env.AI_COST_PER_MILLION_TOKENS = "2.5"
    expect(estimateGenerationCost("provider/paid-model", 400_000)).toBe(1)
  })

  it("rejects invalid or negative estimates", () => {
    process.env.AI_COST_PER_MILLION_TOKENS = "not-a-number"
    expect(estimateGenerationCost("provider/paid-model", 100)).toBeUndefined()
    expect(estimateGenerationCost("provider/paid-model", -1)).toBeUndefined()
    expect(estimateGenerationCost(undefined, 100)).toBeUndefined()
  })
})
