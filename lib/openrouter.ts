import { createOpenAI } from '@ai-sdk/openai';

// OpenRouter configuration for free models
export const openRouterConfig = {
  baseURL: 'https://openrouter.ai/api/v1',
  models: {
    primary: 'meta-llama/llama-3.1-8b-instruct:free',
    fallback: 'google/gemma-2-9b-it:free',
    lightweight: 'deepseek/deepseek-r1-distill-llama-70b:free',
    visual: 'google/gemini-2.5-flash-image-preview:free'
  },
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
  if (preference) {
    return openRouterConfig.models[preference];
  }
  
  // Auto-select based on complexity
  if (complexity === 'simple') {
    return openRouterConfig.models.lightweight;
  }
  
  return openRouterConfig.models.primary;
}

// Generation response interface
export interface OpenRouterGenerationResponse {
  content: string;
  model: string;
  tokensUsed: number;
  generationTime: number;
  success: boolean;
  error?: string;
}