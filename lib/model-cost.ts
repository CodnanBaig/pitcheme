const FREE_MODEL_SUFFIX = ":free"
const MAX_ESTIMATED_COST_USD = 1_000_000

/**
 * Estimate generation spend from total provider tokens without treating the
 * estimate as an accounting source of truth. Free OpenRouter aliases are
 * explicitly zero-cost; deployments using paid models can provide a blended
 * rate through AI_COST_PER_MILLION_TOKENS until provider-specific pricing is
 * configured.
 */
export function estimateGenerationCost(
  model: string | undefined,
  totalTokens: number | undefined,
): number | undefined {
  if (!model || !Number.isFinite(totalTokens) || (totalTokens ?? 0) < 0) return undefined

  const tokens = Math.min(Math.trunc(totalTokens ?? 0), Number.MAX_SAFE_INTEGER)
  if (model.endsWith(FREE_MODEL_SUFFIX)) return 0

  const configuredRate = Number(process.env.AI_COST_PER_MILLION_TOKENS)
  if (!Number.isFinite(configuredRate) || configuredRate < 0) return undefined

  const estimated = (tokens / 1_000_000) * configuredRate
  return Math.min(Math.round(estimated * 1_000_000) / 1_000_000, MAX_ESTIMATED_COST_USD)
}
