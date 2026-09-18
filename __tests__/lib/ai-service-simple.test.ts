import { aiService } from '@/lib/ai-service';
import { selectModel } from '@/lib/openrouter';

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
      proposal: {
        sections: ['Overview'],
        industryPrompts: ['Be specific'],
        suggestedLength: 500,
      },
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
  const mockSelectModel = selectModel as jest.MockedFunction<typeof selectModel>;
  const originalE2eMode = process.env.E2E_TEST_MODE;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalE2eMode === undefined) delete process.env.E2E_TEST_MODE;
    else process.env.E2E_TEST_MODE = originalE2eMode;
  });

  it('returns deterministic structured fixtures in explicit E2E mode', async () => {
    process.env.E2E_TEST_MODE = 'true';

    const proposal = await aiService.generateProposal({
      field: 'technology',
      clientName: 'E2E Client',
      projectTitle: 'E2E Project',
      projectDescription: 'A deterministic project brief',
      goals: 'Validate the complete browser journey',
      budget: 'TBD',
      timeline: '6 weeks',
      services: ['Discovery'],
      fieldSpecificData: {},
    });
    const pitchDeck = await aiService.generatePitchDeck({
      field: 'technology',
      startupName: 'E2E Startup',
      problem: 'A measurable problem',
      solution: 'A focused solution',
      market: 'A clear market',
      fieldSpecificData: {},
    });

    expect(proposal).toMatchObject({ model: 'e2e/deterministic', success: true });
    expect(JSON.parse(proposal.content)).toHaveProperty('sections');
    expect(pitchDeck).toMatchObject({ model: 'e2e/deterministic', success: true });
    expect(JSON.parse(pitchDeck.content)).toHaveProperty('slides');
    expect(mockGenerateText).not.toHaveBeenCalled();
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
      temperature: 0.7,
      abortSignal: expect.any(AbortSignal),
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
      temperature: 0.7,
      abortSignal: expect.any(AbortSignal),
    });
    expect(result.success).toBe(true);
  });

  it('repairs an invalid structured pitch response once', async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: JSON.stringify({ slides: [] }),
        usage: { totalTokens: 25 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          company: 'Test Startup',
          tagline: 'A clear direction',
          slides: [{ title: 'Problem', bullets: ['A costly gap'] }],
        }),
        usage: { totalTokens: 40 },
      });

    const result = await aiService.generatePitchDeck({
      field: 'technology',
      startupName: 'Test Startup',
      problem: 'A problem',
      solution: 'A solution',
      market: 'A market',
      fieldSpecificData: {},
    });

    expect(result.success).toBe(true);
    expect(result.repairAttempted).toBe(true);
    expect(result.content).toContain('"slides"');
    expect(result.tokensUsed).toBe(65);
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(mockGenerateText.mock.calls[1][0].prompt).toContain('Repair the previous model response');
  });

  it('fails closed when the repair response remains invalid', async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: JSON.stringify({ slides: [] }),
        usage: { totalTokens: 25 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ slides: [] }),
        usage: { totalTokens: 40 },
      });

    const result = await aiService.generatePitchDeck({
      field: 'technology',
      startupName: 'Test Startup',
      problem: 'A problem',
      solution: 'A solution',
      market: 'A market',
      fieldSpecificData: {},
    });

    expect(result.success).toBe(false);
    expect(result.repairAttempted).toBe(true);
    expect(result.error).toContain('invalid structured output');
  });

  it('falls back to the lightweight model when the primary provider fails', async () => {
    mockSelectModel
      .mockReturnValueOnce('primary-model')
      .mockReturnValueOnce('deepseek/deepseek-r1-distill-llama-70b:free');
    mockGenerateText
      .mockRejectedValueOnce(new Error('primary unavailable'))
      .mockRejectedValueOnce(new Error('primary unavailable'))
      .mockResolvedValueOnce({
        text: '# Recovered proposal',
        usage: { totalTokens: 30 },
      });

    const result = await aiService.generateProposal({
      field: 'technology',
      clientName: 'Client',
      projectTitle: 'Recovery',
      projectDescription: 'A project',
      goals: 'A goal',
      budget: 'TBD',
      timeline: 'TBD',
      services: [],
      fieldSpecificData: {},
    });

    expect(result.success).toBe(true);
    expect(result.model).toBe('deepseek/deepseek-r1-distill-llama-70b:free');
    expect(result.content).toBe('# Recovered proposal');
    expect(mockGenerateText).toHaveBeenCalledTimes(3);
  });

  it('retries a transient provider failure once before succeeding', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('upstream unavailable'))
      .mockResolvedValueOnce({
        text: '# Recovered after retry',
        usage: { totalTokens: 20 },
      })

    const result = await aiService.generateProposal({
      field: 'technology',
      clientName: 'Client',
      projectTitle: 'Retry',
      projectDescription: 'A project',
      goals: 'A goal',
      budget: 'TBD',
      timeline: 'TBD',
      services: [],
      fieldSpecificData: {},
    })

    expect(result.success).toBe(true)
    expect(result.content).toBe('# Recovered after retry')
    expect(mockGenerateText).toHaveBeenCalledTimes(2)
  })
});
