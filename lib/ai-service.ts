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
  exportFormat?: 'pdf' | 'html';
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
    // Use PDF-optimized generation if PDF export is requested
    if (data.exportFormat === 'pdf') {
      return this.generatePDFOptimizedPitchDeck(data);
    }
    
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
        maxTokens: 6000, // Increased for visual content
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

  async generatePDFOptimizedPitchDeck(data: PitchDeckGenerationRequest): Promise<OpenRouterGenerationResponse> {
    const fieldConfig = getFieldConfiguration(data.field);
    if (!fieldConfig) {
      throw new Error(`Unknown field: ${data.field}`);
    }

    const model = selectModel('visual', 'complex'); // Use Kimi-K2 for visual content
    const prompt = this.buildPDFOptimizedPitchDeckPrompt(data, fieldConfig);
    
    const startTime = Date.now();
    
    try {
      const result = await generateText({
        model: openrouter(model),
        prompt,
        maxTokens: 8000, // Higher limit for comprehensive PDF content
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
      // Fallback to regular visual pitch deck generation if PDF-optimized fails
      console.warn('PDF-optimized generation failed, falling back to visual generation:', error);
      return this.generateVisualPitchDeck({
        ...data,
        exportFormat: 'html'
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
You are creating a compelling visual ${fieldConfig.name.toLowerCase()} pitch deck for investors using the MoonshotAI Kimi-K2 model. This will be exported as a professional PDF document.

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
Presentation Style: Professional, visually engaging, PDF-ready format

Field-Specific Data:
${Object.entries(data.fieldSpecificData).map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n')}

Create a ${fieldConfig.workflows.pitchDeck.slides.length}-slide visual pitch deck optimized for PDF export with these slides:
${fieldConfig.workflows.pitchDeck.slides.map((slide: string, index: number) => `**Slide ${index + 1}: ${slide}**`).join('\n')}

For each slide, provide:
1. **Slide Title**: A compelling, concise headline (max 60 characters)
2. **Key Points**: 2-4 impactful bullet points with specific data/metrics
3. **Visual Layout**: Detailed description for PDF rendering:
   - Chart/graph specifications (type, data points, colors)
   - Image placement and sizing recommendations
   - Color scheme (primary, secondary, accent colors)
   - Typography hierarchy (headings, body text, captions)
   - Layout structure (grid, columns, sections)
4. **Visual Elements**: Specific components for PDF generation:
   - Data visualization types (bar charts, pie charts, line graphs, infographics)
   - Icon and graphic recommendations
   - Product mockups or UI screenshots descriptions
   - Team photos or company logo placement
   - Before/after comparisons or process flows
5. **Speaker Notes**: Compelling talking points for presentation
6. **PDF Optimization**: Notes for clean PDF export:
   - Font sizes and styles
   - Spacing and margins
   - Page breaks and layout considerations

Focus on creating content that:
- Translates well to PDF format
- Is visually engaging and investor-focused
- Contains clear, actionable data and metrics
- Maintains professional appearance in print
- ${fieldConfig.id === 'technology' ? 'Demonstrates technical credibility with clear product value' : 'Shows evidence-based value propositions with measurable impact'}

Format the output with clear HTML-like structure for easy PDF conversion.
`;

    return baseContext;
  }

  private buildPDFOptimizedPitchDeckPrompt(data: PitchDeckGenerationRequest, fieldConfig: any): string {
    const baseContext = `
You are creating a premium ${fieldConfig.name.toLowerCase()} pitch deck specifically optimized for PDF export using the MoonshotAI Kimi-K2 model. This will be a professional, print-ready document.

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
Output Format: HTML-structured content optimized for PDF conversion

Field-Specific Data:
${Object.entries(data.fieldSpecificData).map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n')}

Create a ${fieldConfig.workflows.pitchDeck.slides.length}-slide pitch deck with this exact HTML structure for each slide:

<div class="slide" style="page-break-after: always; margin: 20px; padding: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
  <h1 style="font-size: 32px; font-weight: bold; margin-bottom: 20px; text-align: center;">[SLIDE TITLE]</h1>
  
  <div style="display: flex; gap: 20px; margin-top: 30px;">
    <div style="flex: 1;">
      <h2 style="font-size: 24px; margin-bottom: 15px; color: #f8f9fa;">Key Points</h2>
      <ul style="font-size: 18px; line-height: 1.6;">
        <li>[Point 1 with specific data/metrics]</li>
        <li>[Point 2 with specific data/metrics]</li>
        <li>[Point 3 with specific data/metrics]</li>
      </ul>
    </div>
    
    <div style="flex: 1; background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px;">
      <h3 style="font-size: 20px; margin-bottom: 10px; color: #f8f9fa;">Visual Elements</h3>
      <p style="font-size: 16px; line-height: 1.5;">[Detailed visual description for charts, graphs, images]</p>
    </div>
  </div>
  
  <div style="margin-top: 30px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px;">
    <h3 style="font-size: 18px; margin-bottom: 10px; color: #f8f9fa;">Speaker Notes</h3>
    <p style="font-size: 16px; line-height: 1.5;">[Compelling talking points for presentation]</p>
  </div>
</div>

For each slide, provide:
1. **Slide Title**: Compelling headline (max 50 characters)
2. **Key Points**: 3-4 bullet points with specific metrics/data
3. **Visual Elements**: Detailed descriptions for:
   - Data visualizations (charts, graphs, infographics)
   - Product mockups or screenshots
   - Team photos or company branding
   - Process flows or comparisons
4. **Speaker Notes**: Engaging talking points for presentation

Slides to create:
${fieldConfig.workflows.pitchDeck.slides.map((slide: string, index: number) => `**Slide ${index + 1}: ${slide}**`).join('\n')}

Focus on creating content that:
- Uses professional, investor-focused language
- Includes specific, measurable data and metrics
- Provides clear visual descriptions for PDF rendering
- Maintains consistent styling and layout
- ${fieldConfig.id === 'technology' ? 'Demonstrates technical innovation and market potential' : 'Shows evidence-based solutions and measurable impact'}

Ensure each slide is self-contained and will render properly in PDF format.
`;

    return baseContext;
  }
}

// Export singleton instance
export const aiService = new FieldSpecificAIService();