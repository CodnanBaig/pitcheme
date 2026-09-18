import { validateGeneratedContent } from "@/lib/generation-output"
import {
  inspectStructuredOutput,
  normalizeStructuredOutput,
  type StructuredOutputType,
} from "@/lib/structured-output"

export interface EvaluationFixture {
  id: string
  label: string
  type: StructuredOutputType
  promptVersion: string
  expectedKeywords: string[]
  requiredHeadings: string[]
  sampleOutput: string
}

export interface EvaluationCheck {
  name: string
  passed: boolean
  detail: string
}

export interface EvaluationReport {
  fixtureId: string
  promptVersion: string
  format: "structured-json" | "legacy-text"
  score: number
  passed: boolean
  checks: EvaluationCheck[]
}

export interface EvaluationComparison {
  passed: boolean
  regressions: Array<{
    fixtureId: string
    baselineScore: number
    candidateScore: number
  }>
}

const MAX_EVALUATED_OUTPUT_LENGTH = 200_000
const PLACEHOLDER_PATTERN = /\[[^\]]+\]|lorem ipsum|insert (?:text|data|content|metric)/i

export function evaluateGenerationOutput(
  fixture: EvaluationFixture,
  rawOutput: string,
): EvaluationReport {
  const normalized = normalizeStructuredOutput(rawOutput, fixture.type)
  const inspection = inspectStructuredOutput(rawOutput, fixture.type)
  const content = normalized.content.toLowerCase()
  const generatedValidation = validateGeneratedContent(normalized.content, fixture.type)

  const checks: EvaluationCheck[] = [
    {
      name: "non-empty-output",
      passed: generatedValidation.valid,
      detail: generatedValidation.valid ? "Output contains content" : generatedValidation.error,
    },
    {
      name: "structured-shape",
      passed: !inspection.candidate || inspection.valid,
      detail: !inspection.candidate
        ? "Legacy text fallback accepted"
        : inspection.valid
          ? "Structured output matches the contract"
          : inspection.errors.join("; "),
    },
    {
      name: "required-keywords",
      passed: fixture.expectedKeywords.every((keyword) => content.includes(keyword.toLowerCase())),
      detail: missingKeywords(fixture.expectedKeywords, content),
    },
    {
      name: "required-headings",
      passed: fixture.requiredHeadings.every((heading) => content.includes(heading.toLowerCase())),
      detail: missingKeywords(fixture.requiredHeadings, content),
    },
    {
      name: "no-placeholders",
      passed: !PLACEHOLDER_PATTERN.test(normalized.content),
      detail: PLACEHOLDER_PATTERN.test(normalized.content)
        ? "Output contains an unresolved placeholder"
        : "No unresolved placeholder pattern found",
    },
    {
      name: "bounded-output",
      passed: normalized.content.length <= MAX_EVALUATED_OUTPUT_LENGTH,
      detail: `${normalized.content.length} characters (limit ${MAX_EVALUATED_OUTPUT_LENGTH})`,
    },
  ]

  const passedChecks = checks.filter((check) => check.passed).length
  const score = Number((passedChecks / checks.length).toFixed(4))

  return {
    fixtureId: fixture.id,
    promptVersion: fixture.promptVersion,
    format: normalized.format,
    score,
    passed: checks.every((check) => check.passed),
    checks,
  }
}

export function compareEvaluationRuns(
  baseline: EvaluationReport[],
  candidate: EvaluationReport[],
): EvaluationComparison {
  const candidateByFixture = new Map(candidate.map((report) => [report.fixtureId, report]))
  const regressions = baseline.flatMap((baselineReport) => {
    const candidateReport = candidateByFixture.get(baselineReport.fixtureId)
    if (!candidateReport || candidateReport.score < baselineReport.score) {
      return [{
        fixtureId: baselineReport.fixtureId,
        baselineScore: baselineReport.score,
        candidateScore: candidateReport?.score ?? 0,
      }]
    }
    return []
  })

  return { passed: regressions.length === 0, regressions }
}

function missingKeywords(expected: string[], content: string): string {
  const missing = expected.filter((value) => !content.includes(value.toLowerCase()))
  return missing.length === 0 ? "All expected terms found" : `Missing: ${missing.join(", ")}`
}
