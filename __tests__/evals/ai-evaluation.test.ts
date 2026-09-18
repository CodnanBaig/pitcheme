import {
  compareEvaluationRuns,
  evaluateGenerationOutput,
} from "@/lib/ai-evaluation"
import { evaluationFixtures } from "@/evals/fixtures"

describe("AI evaluation harness", () => {
  it("ships at least 15 representative fixtures", () => {
    expect(evaluationFixtures).toHaveLength(15)
  })

  it.each(evaluationFixtures.map((fixture) => [fixture.id, fixture]))(
    "%s passes deterministic quality checks",
    (_id, fixture) => {
      const report = evaluateGenerationOutput(fixture, fixture.sampleOutput)

      expect(report.passed).toBe(true)
      expect(report.score).toBe(1)
    },
  )

  it("flags malformed output and reports prompt-run regressions", () => {
    const baseline = evaluationFixtures.map((fixture) =>
      evaluateGenerationOutput(fixture, fixture.sampleOutput),
    )
    const degradedFixture = evaluationFixtures[0]
    const degraded = evaluateGenerationOutput(
      degradedFixture,
      JSON.stringify({ title: "Incomplete", executiveSummary: "[insert text]", sections: [] }),
    )
    const comparison = compareEvaluationRuns(baseline, [degraded])

    expect(degraded.passed).toBe(false)
    expect(comparison.passed).toBe(false)
    expect(comparison.regressions[0]).toEqual({
      fixtureId: degradedFixture.id,
      baselineScore: 1,
      candidateScore: degraded.score,
    })
  })

  it("accepts controlled legacy text for older prompt versions", () => {
    const fixture = evaluationFixtures.find((entry) => entry.id === "agency-proposal")
    if (!fixture) throw new Error("Fixture missing")

    const report = evaluateGenerationOutput(fixture, fixture.sampleOutput)

    expect(report.passed).toBe(true)
    expect(report.format).toBe("legacy-text")
  })
})
