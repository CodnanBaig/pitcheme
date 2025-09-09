import { aiService } from '@/lib/ai-service';

// Mock the AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn()
}));

// Mock OpenRouter
jest.mock('@/lib/openrouter', () => ({
  openrouter: jest.fn(() => 'mocked-model-instance'),
  selectModel: jest.fn(() => 'moonshotai/kimi-k2:free')
}));

// Mock field config
jest.mock('@/lib/field-config', () => ({
  getFieldConfiguration: jest.fn(() => ({
    name: 'Technology',
    id: 'technology',
    workflows: {
      pitchDeck: {
        slides: ['Problem', 'Solution', 'Market'],
        presentationStyle: 'Professional',
        focusAreas: ['Innovation', 'Market potential']
      }
    }
  }))
}));

describe('AI Service - Kimi-K2 Integration', () => {
  const mockGenerateText = require('ai').generateText;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use Kimi-K2 model for visual pitch deck generation', async () => {
    const mockResponse = {
      text: '<div class="slide">Mock content</div>',
      usage: { totalTokens: 1000 }
    };
    mockGenerateText.mockResolvedValue(mockResponse);

    const request = {
      field: 'technology',
      startupName: 'Test Startup',
      problem: 'Test problem',
      solution: 'Test solution',
      market: 'Test market',
      fieldSpecificData: {},
      visualMode: true
    };

    const result = await aiService.generateVisualPitchDeck(request);

    expect(mockGenerateText).toHaveBeenCalledWith({
      model: 'mocked-model-instance',
      prompt: expect.stringContaining('MoonshotAI Kimi-K2 model'),
      maxTokens: 6000,
      temperature: 0.7
    });
    expect(result.success).toBe(true);
    expect(result.model).toBe('moonshotai/kimi-k2:free');
  });

  it('should route to PDF-optimized generation when exportFormat is pdf', async () => {
    const mockResponse = {
      text: '<div class="slide" style="page-break-after: always;">PDF content</div>',
      usage: { totalTokens: 1500 }
    };
    mockGenerateText.mockResolvedValue(mockResponse);

    const request = {
      field: 'technology',
      startupName: 'Test Startup',
      problem: 'Test problem',
      solution: 'Test solution',
      market: 'Test market',
      fieldSpecificData: {},
      exportFormat: 'pdf'
    };

    const result = await aiService.generatePitchDeck(request);

    expect(mockGenerateText).toHaveBeenCalledWith({
      model: 'mocked-model-instance',
      prompt: expect.stringContaining('HTML-structured content optimized for PDF conversion'),
      maxTokens: 8000,
      temperature: 0.7
    });
    expect(result.success).toBe(true);
  });
});
