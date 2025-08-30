// Mock the dependencies
jest.mock('ai')
jest.mock('@/lib/openrouter')
jest.mock('@/lib/field-config')

import { generateText } from 'ai'
import { openrouter, selectModel } from '@/lib/openrouter'
import { getFieldConfiguration } from '@/lib/field-config'
import { FieldSpecificAIService } from '@/lib/ai-service'

const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>
const mockOpenrouter = openrouter as jest.MockedFunction<typeof openrouter>
const mockSelectModel = selectModel as jest.MockedFunction<typeof selectModel>
const mockGetFieldConfiguration = getFieldConfiguration as jest.MockedFunction<typeof getFieldConfiguration>

describe('FieldSpecificAIService', () => {
  let aiService: FieldSpecificAIService

  beforeEach(() => {
    jest.clearAllMocks()
    aiService = new FieldSpecificAIService()
  })

  const mockFieldConfig = {
    id: 'technology',
    name: 'Technology',
    workflows: {
      proposal: {
        sections: ['Executive Summary', 'Technical Approach', 'Timeline', 'Budget'],
        industryPrompts: ['Focus on technical implementation', 'Include scalability considerations'],
        suggestedLength: 2000
      },
      pitchDeck: {
        slides: ['Problem', 'Solution', 'Market', 'Business Model', 'Team', 'Financial Projections'],
        presentationStyle: 'Technical and data-driven',
        focusAreas: ['Technical innovation', 'Market disruption', 'Scalability']
      }
    }
  }

  const mockAIResult = {
    text: 'Generated content here...',
    usage: {
      totalTokens: 1500
    }
  }

  describe('generateProposal', () => {
    const validProposalRequest = {
      field: 'technology',
      clientName: 'John Doe',
      clientCompany: 'Tech Corp',
      projectTitle: 'Custom Software Development',
      projectDescription: 'Build a web application',
      goals: 'Improve efficiency',
      budget: '$50000',
      timeline: '3 months',
      services: ['Development', 'Testing'],
      fieldSpecificData: {
        technologies: 'React, Node.js'
      },
      modelPreference: 'primary' as const
    }

    it('should successfully generate a proposal', async () => {
      mockGetFieldConfiguration.mockReturnValue(mockFieldConfig)
      mockSelectModel.mockReturnValue('meta-llama/llama-3.1-8b-instruct:free')
      mockOpenrouter.mockReturnValue('mocked-model-instance')
      mockGenerateText.mockResolvedValue(mockAIResult)

      const result = await aiService.generateProposal(validProposalRequest)

      expect(result.success).toBe(true)
      expect(result.content).toBe(mockAIResult.text)
      expect(result.model).toBe('meta-llama/llama-3.1-8b-instruct:free')
      expect(result.tokensUsed).toBe(1500)
      expect(result.generationTime).toBeGreaterThanOrEqual(0)

      expect(mockGetFieldConfiguration).toHaveBeenCalledWith('technology')
      expect(mockSelectModel).toHaveBeenCalledWith('primary', 'complex')
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: 'mocked-model-instance',
        prompt: expect.stringContaining('Technology'),
        maxTokens: 4000,
        temperature: 0.7
      })
    })

    it('should handle unknown field gracefully', async () => {
      mockGetFieldConfiguration.mockReturnValue(null)

      await expect(aiService.generateProposal({
        ...validProposalRequest,
        field: 'unknown-field'
      })).rejects.toThrow('Unknown field: unknown-field')
    })

    it('should fallback to lightweight model on primary failure', async () => {
      mockGetFieldConfiguration.mockReturnValue(mockFieldConfig)
      mockSelectModel
        .mockReturnValueOnce('meta-llama/llama-3.1-8b-instruct:free')  // First call (primary)
        .mockReturnValueOnce('deepseek/deepseek-r1-distill-llama-70b:free')  // Second call (lightweight)
      mockOpenrouter.mockReturnValue('mocked-model-instance')
      mockGenerateText
        .mockRejectedValueOnce(new Error('Primary model failed'))
        .mockResolvedValueOnce(mockAIResult)

      const result = await aiService.generateProposal(validProposalRequest)

      expect(result.success).toBe(true)
      expect(result.content).toBe(mockAIResult.text)
      expect(mockGenerateText).toHaveBeenCalledTimes(2)
    })

    it('should return failure when both primary and fallback models fail', async () => {
      mockGetFieldConfiguration.mockReturnValue(mockFieldConfig)
      mockSelectModel.mockReturnValue('deepseek/deepseek-r1-distill-llama-70b:free')
      mockOpenrouter.mockReturnValue('mocked-model-instance')
      mockGenerateText.mockRejectedValue(new Error('Model unavailable'))

      const result = await aiService.generateProposal(validProposalRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Model unavailable')
      expect(result.content).toBe('')
      expect(result.tokensUsed).toBe(0)
    })
  })

  describe('generatePitchDeck', () => {
    const validPitchDeckRequest = {
      field: 'technology',
      startupName: 'TechCorp',
      tagline: 'Revolutionizing tech',
      problem: 'Existing solutions are slow',
      solution: 'Our fast platform',
      market: 'Global market',
      businessModel: 'SaaS',
      team: 'Experienced team',
      funding: '$1M',
      fieldSpecificData: {
        techStack: 'React, Node.js'
      },
      modelPreference: 'primary' as const,
      visualMode: false
    }

    it('should successfully generate a pitch deck', async () => {
      mockGetFieldConfiguration.mockReturnValue(mockFieldConfig)
      mockSelectModel.mockReturnValue('meta-llama/llama-3.1-8b-instruct:free')
      mockOpenrouter.mockReturnValue('mocked-model-instance')
      mockGenerateText.mockResolvedValue(mockAIResult)

      const result = await aiService.generatePitchDeck(validPitchDeckRequest)

      expect(result.success).toBe(true)
      expect(result.content).toBe(mockAIResult.text)
      expect(result.model).toBe('meta-llama/llama-3.1-8b-instruct:free')
      expect(result.tokensUsed).toBe(1500)
      expect(result.generationTime).toBeGreaterThanOrEqual(0)

      expect(mockGetFieldConfiguration).toHaveBeenCalledWith('technology')
      expect(mockSelectModel).toHaveBeenCalledWith('primary', 'complex')
    })

    it('should use visual model when visualMode is true', async () => {
      const visualRequest = {
        ...validPitchDeckRequest,
        visualMode: true
      }

      mockGetFieldConfiguration.mockReturnValue(mockFieldConfig)
      mockSelectModel.mockReturnValue('google/gemini-2.5-flash-image-preview:free')
      mockOpenrouter.mockReturnValue('mocked-visual-model-instance')
      mockGenerateText.mockResolvedValue(mockAIResult)

      const result = await aiService.generatePitchDeck(visualRequest)

      expect(result.success).toBe(true)
      expect(mockSelectModel).toHaveBeenCalledWith('visual', 'complex')
    })

    it('should fallback from visual to text when visual model fails', async () => {
      const visualRequest = {
        ...validPitchDeckRequest,
        visualMode: true
      }

      mockGetFieldConfiguration.mockReturnValue(mockFieldConfig)
      mockSelectModel
        .mockReturnValueOnce('google/gemini-2.5-flash-image-preview:free')  // Visual model
        .mockReturnValueOnce('meta-llama/llama-3.1-8b-instruct:free')       // Fallback model
      mockOpenrouter.mockReturnValue('mocked-model-instance')
      mockGenerateText
        .mockRejectedValueOnce(new Error('Visual model failed'))
        .mockResolvedValueOnce(mockAIResult)

      const result = await aiService.generatePitchDeck(visualRequest)

      expect(result.success).toBe(true)
      expect(result.content).toBe(mockAIResult.text)
      expect(mockGenerateText).toHaveBeenCalledTimes(2)
    })

    it('should handle unknown field gracefully', async () => {
      mockGetFieldConfiguration.mockReturnValue(null)

      await expect(aiService.generatePitchDeck({
        ...validPitchDeckRequest,
        field: 'unknown-field'
      })).rejects.toThrow('Unknown field: unknown-field')
    })

    it('should fallback to lightweight model on primary failure', async () => {
      mockGetFieldConfiguration.mockReturnValue(mockFieldConfig)
      mockSelectModel
        .mockReturnValueOnce('meta-llama/llama-3.1-8b-instruct:free')
        .mockReturnValueOnce('deepseek/deepseek-r1-distill-llama-70b:free')
      mockOpenrouter.mockReturnValue('mocked-model-instance')
      mockGenerateText
        .mockRejectedValueOnce(new Error('Primary model failed'))
        .mockResolvedValueOnce(mockAIResult)

      const result = await aiService.generatePitchDeck(validPitchDeckRequest)

      expect(result.success).toBe(true)
      expect(result.content).toBe(mockAIResult.text)
      expect(mockGenerateText).toHaveBeenCalledTimes(2)
    })
  })

  describe('generateVisualPitchDeck', () => {
    const validVisualRequest = {
      field: 'technology',
      startupName: 'TechCorp',
      tagline: 'Revolutionizing tech',
      problem: 'Existing solutions are slow',
      solution: 'Our fast platform',
      market: 'Global market',
      businessModel: 'SaaS',
      team: 'Experienced team',
      funding: '$1M',
      fieldSpecificData: {
        techStack: 'React, Node.js'
      },
      modelPreference: 'visual' as const,
      visualMode: true
    }

    it('should successfully generate visual pitch deck', async () => {
      mockGetFieldConfiguration.mockReturnValue(mockFieldConfig)
      mockSelectModel.mockReturnValue('google/gemini-2.5-flash-image-preview:free')
      mockOpenrouter.mockReturnValue('mocked-visual-model-instance')
      mockGenerateText.mockResolvedValue(mockAIResult)

      const result = await aiService.generateVisualPitchDeck(validVisualRequest)

      expect(result.success).toBe(true)
      expect(result.content).toBe(mockAIResult.text)
      expect(result.model).toBe('google/gemini-2.5-flash-image-preview:free')
      expect(mockSelectModel).toHaveBeenCalledWith('visual', 'complex')
    })

    it('should fallback to regular pitch deck on visual model failure', async () => {
      mockGetFieldConfiguration.mockReturnValue(mockFieldConfig)
      mockSelectModel
        .mockReturnValueOnce('google/gemini-2.5-flash-image-preview:free')  // Visual model fails
        .mockReturnValueOnce('meta-llama/llama-3.1-8b-instruct:free')       // Fallback model
      mockOpenrouter.mockReturnValue('mocked-model-instance')
      mockGenerateText
        .mockRejectedValueOnce(new Error('Visual model unavailable'))
        .mockResolvedValueOnce(mockAIResult)

      const result = await aiService.generateVisualPitchDeck(validVisualRequest)

      expect(result.success).toBe(true)
      expect(result.content).toBe(mockAIResult.text)
      expect(mockGenerateText).toHaveBeenCalledTimes(2)
    })
  })
})