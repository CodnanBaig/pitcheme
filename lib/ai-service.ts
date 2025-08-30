import { generateText } from 'ai';
import { openrouter, selectModel, OpenRouterGenerationResponse } from './openrouter';
import { getFieldConfiguration } from './field-config';

export interface ProposalGenerationRequest {
  field: string;
  clientName: string;
  clientCompany?: string;
  projectTitle: string;
  projectDescription: string;
  goals: string;
  budget: string;
  timeline: string;
  services: string[];
  fieldSpecificData: Record<string, string | string[]>;
  modelPreference?: 'primary' | 'fallback' | 'lightweight' | 'visual';
}

export interface PitchDeckGenerationRequest {
  field: string;
  startupName: string;
  tagline?: string;
  problem: string;
  solution: string;
  market: string;
  businessModel?: string;
  team?: string;
  funding?: string;
  fieldSpecificData: Record<string, string | string[]>;
  modelPreference?: 'primary' | 'fallback' | 'lightweight' | 'visual';
  visualMode?: boolean;
}

export class FieldSpecificAIService {
  
  async generateProposal(data: ProposalGenerationRequest): Promise<OpenRouterGenerationResponse> {
    const fieldConfig = getFieldConfiguration(data.field);
    if (!fieldConfig) {
      throw new Error(`Unknown field: ${data.field}`);
    }

    const model = selectModel(data.modelPreference, 'complex');
    const prompt = this.buildProposalPrompt(data, fieldConfig);
    
    const startTime = Date.now();
    
    try {
      const result = await generateText({
        model: openrouter(model),
        prompt,
        maxTokens: 4000,
        temperature: 0.7,
      });

      return {
        content: result.text,
        model,
        tokensUsed: result.usage?.totalTokens || 0,
        generationTime: Date.now() - startTime,
        success: true
      };
    } catch (error) {
      // Fallback to alternative model if primary fails
      if (model !== 'deepseek/deepseek-r1-distill-llama-70b:free') {
        return this.generateProposal({
          ...data,
          modelPreference: 'lightweight'
        });
      }
      
      return {
        content: '',
        model,
        tokensUsed: 0,
        generationTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async generatePitchDeck(data: PitchDeckGenerationRequest): Promise<OpenRouterGenerationResponse> {
    // Use visual model if requested or auto-detect if we want visual content
    if (data.visualMode || data.modelPreference === 'visual') {
      return this.generateVisualPitchDeck(data);
    }
    
    const fieldConfig = getFieldConfiguration(data.field);
    if (!fieldConfig) {
      throw new Error(`Unknown field: ${data.field}`);
    }

    const model = selectModel(data.modelPreference, 'complex');
    const prompt = this.buildPitchDeckPrompt(data, fieldConfig);
    
    const startTime = Date.now();
    
    try {
      const result = await generateText({
        model: openrouter(model),
        prompt,
        maxTokens: 4000,
        temperature: 0.7,
      });

      return {
        content: result.text,
        model,
        tokensUsed: result.usage?.totalTokens || 0,
        generationTime: Date.now() - startTime,
        success: true
      };
    } catch (error) {
      // Fallback to alternative model if primary fails
      if (model !== 'deepseek/deepseek-r1-distill-llama-70b:free') {
        return this.generatePitchDeck({
          ...data,
          modelPreference: 'lightweight'
        });
      }
      
      return {
        content: '',
        model,
        tokensUsed: 0,
        generationTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async generateVisualPitchDeck(data: PitchDeckGenerationRequest): Promise<OpenRouterGenerationResponse> {
    const fieldConfig = getFieldConfiguration(data.field);
    if (!fieldConfig) {
      throw new Error(`Unknown field: ${data.field}`);
    }

    const model = selectModel('visual', 'complex');
    const prompt = this.buildVisualPitchDeckPrompt(data, fieldConfig);
    
    const startTime = Date.now();
    
    try {
      const result = await generateText({
        model: openrouter(model),
        prompt,
        maxTokens: 4000,
        temperature: 0.7,
      });

      return {
        content: result.text,
        model,
        tokensUsed: result.usage?.totalTokens || 0,
        generationTime: Date.now() - startTime,
        success: true
      };
    } catch (error) {
      // Fallback to regular pitch deck generation if visual model fails
      console.warn('Visual model failed, falling back to text-based generation:', error);
      return this.generatePitchDeck({
        ...data,
        visualMode: false,
        modelPreference: 'primary'
      });
    }
  }

  private buildProposalPrompt(data: ProposalGenerationRequest, fieldConfig: any): string {
    const { workflow } = fieldConfig.workflows.proposal;
    
    const baseContext = `
You are a professional ${fieldConfig.name.toLowerCase()} consultant creating a comprehensive business proposal.

Client Information:
- Client Name: ${data.clientName}
- Company: ${data.clientCompany || 'Not specified'}
- Project: ${data.projectTitle}
- Description: ${data.projectDescription}
- Goals: ${data.goals}
- Budget: ${data.budget}
- Timeline: ${data.timeline}
- Services Requested: ${data.services.join(', ')}

Industry Focus: ${fieldConfig.name}
Tone: Professional, ${fieldConfig.id === 'technology' ? 'technically precise, solution-oriented' : 'empathetic, evidence-based, authoritative'}

Field-Specific Data:
${Object.entries(data.fieldSpecificData).map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n')}

Generate a comprehensive proposal with these sections:
${fieldConfig.workflows.proposal.sections.map((section: string, index: number) => `${index + 1}. ${section}`).join('\n')}

Industry Guidelines:
${fieldConfig.workflows.proposal.industryPrompts.map((prompt: string) => `- ${prompt}`).join('\n')}

Format as a professional document with clear headings and detailed content for each section.
Target length: ~${fieldConfig.workflows.proposal.suggestedLength} words.
`;

    return baseContext;
  }

  private buildPitchDeckPrompt(data: PitchDeckGenerationRequest, fieldConfig: any): string {
    const baseContext = `
You are creating a compelling ${fieldConfig.name.toLowerCase()} pitch deck for investors.

Startup Information:
- Company: ${data.startupName}
- Tagline: ${data.tagline || 'Not specified'}
- Problem: ${data.problem}
- Solution: ${data.solution}
- Market: ${data.market}
- Business Model: ${data.businessModel || 'To be refined'}
- Team: ${data.team || 'Strong founding team'}
- Funding Ask: ${data.funding || 'Seeking investment'}

Industry Focus: ${fieldConfig.name}
Presentation Style: ${fieldConfig.workflows.pitchDeck.presentationStyle}

Field-Specific Data:
${Object.entries(data.fieldSpecificData).map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n')}

Create a ${fieldConfig.workflows.pitchDeck.slides.length}-slide pitch deck with these slides:
${fieldConfig.workflows.pitchDeck.slides.map((slide: string, index: number) => `**Slide ${index + 1}: ${slide}**`).join('\n')}

Focus Areas: ${fieldConfig.workflows.pitchDeck.focusAreas.join(', ')}

For each slide, provide:
1. A compelling headline
2. 2-4 key bullet points
3. Suggested visuals description
4. Speaker notes with talking points

Make it investor-focused, data-driven, and ${fieldConfig.id === 'technology' ? 'technically credible' : 'clinically validated'}.
`;

    return baseContext;
  }

  private buildVisualPitchDeckPrompt(data: PitchDeckGenerationRequest, fieldConfig: any): string {
    const baseContext = `
You are creating a compelling visual ${fieldConfig.name.toLowerCase()} pitch deck for investors that includes detailed visual descriptions and layouts.

Startup Information:
- Company: ${data.startupName}
- Tagline: ${data.tagline || 'Not specified'}
- Problem: ${data.problem}
- Solution: ${data.solution}
- Market: ${data.market}
- Business Model: ${data.businessModel || 'To be refined'}
- Team: ${data.team || 'Strong founding team'}
- Funding Ask: ${data.funding || 'Seeking investment'}

Industry Focus: ${fieldConfig.name}
Presentation Style: Visual and engaging for investor presentations

Field-Specific Data:
${Object.entries(data.fieldSpecificData).map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n')}

Create a ${fieldConfig.workflows.pitchDeck.slides.length}-slide visual pitch deck with these slides:
${fieldConfig.workflows.pitchDeck.slides.map((slide: string, index: number) => `**Slide ${index + 1}: ${slide}**`).join('\n')}

For each slide, provide:
1. **Slide Title**: A compelling, concise headline
2. **Key Points**: 2-4 impactful bullet points with data/metrics when possible
3. **Visual Layout**: Detailed description of the slide layout, including:
   - Chart/graph types (bar charts, pie charts, line graphs, etc.)
   - Image placements and types
   - Color schemes and visual hierarchy
   - Text positioning and sizing
4. **Visual Elements**: Specific visual components like:
   - Infographics and icons
   - Data visualizations
   - Product mockups or screenshots
   - Team photos or company logos
   - Before/after comparisons
5. **Speaker Notes**: Compelling talking points for presentation

Focus on creating slides that are:
- Visually engaging and investor-focused
- Data-driven with clear metrics and evidence
- Easy to understand at a glance
- Professional and polished
- ${fieldConfig.id === 'technology' ? 'technically credible with clear product demonstrations' : 'evidence-based with clear value propositions'}

Make each slide description detailed enough that a designer could recreate it visually.
`;

    return baseContext;
  }
}

// Export singleton instance
export const aiService = new FieldSpecificAIService();