import { createOpenAI } from '@ai-sdk/openai';
import modelConfiguration from '@/config/openrouter-models.json';

function configuredModel(name: string, fallback: string): string {
  const value = process.env[name]?.trim()
  return value && value.length <= 160 && !/\s/.test(value) ? value : fallback
}

export function getConfiguredModels() {
  return Object.fromEntries(
    Object.entries(modelConfiguration).map(([role, config]) => [
      role,
      configuredModel(config.environment, config.default),
    ]),
  ) as Record<keyof typeof modelConfiguration, string>
}

// OpenRouter configuration for free models
export const openRouterConfig = {
  baseURL: 'https://openrouter.ai/api/v1',
  models: getConfiguredModels(),
  maxTokens: 4000,
  temperature: 0.7
} as const;

// Create OpenRouter client
export const openrouter = createOpenAI({
  baseURL: openRouterConfig.baseURL,
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

// Model selection utility
export function selectModel(preference?: 'primary' | 'fallback' | 'lightweight' | 'visual', complexity: 'simple' | 'complex' = 'complex'): string {
  const models = getConfiguredModels()
  if (preference) {
    return models[preference];
  }
  
  // Auto-select based on complexity
  if (complexity === 'simple') {
    return models.lightweight;
  }
  
  return models.primary;
}

// Generation response interface
export interface OpenRouterGenerationResponse {
  content: string;
  model: string;
  tokensUsed: number;
  generationTime: number;
  success: boolean;
  repairAttempted?: boolean;
  error?: string;
}
