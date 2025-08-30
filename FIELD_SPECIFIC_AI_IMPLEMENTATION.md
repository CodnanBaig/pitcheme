# Field-Specific AI Proposal and Pitch Deck Generator

## Overview

This implementation adds intelligent field-specific workflows to the PitchGenie application, allowing users to select their industry and receive customized AI-generated proposals and pitch decks tailored to their specific field requirements.

## 🚀 Key Features

### ✅ Implemented Features

1. **Industry Field Selection**
   - Interactive field selector with visual industry cards
   - Currently supports Technology and Healthcare fields
   - Extensible architecture for adding more industries

2. **OpenRouter Free Model Integration**
   - Primary: Meta Llama 3.1 8B Instruct (free)
   - Fallback: Google Gemma 2 9B IT (free)
   - Lightweight: Microsoft Phi-3 Mini (free)
   - Automatic model selection and fallback handling

3. **Field-Specific Workflows**
   - **Technology Field**: 10 proposal sections, 10 pitch deck slides
   - **Healthcare Field**: 9 proposal sections, 10 pitch deck slides
   - Industry-specific prompts and content generation

4. **Dynamic Form Generation**
   - Field-specific input forms that adapt based on selected industry
   - Support for text, textarea, select, and multiselect field types
   - Required field validation and form state management

5. **Enhanced User Experience**
   - Multi-step form with progress indicators
   - Real-time generation status updates
   - Professional industry-specific styling

## 📁 File Structure

### Core Components
```
lib/
├── openrouter.ts              # OpenRouter API client configuration
├── field-config.ts            # Industry field configurations
├── ai-service.ts             # AI content generation service
├── prompt-templates.ts        # Field-specific prompt templates
└── utils.ts                  # Utility functions

components/
├── field-selector.tsx         # Industry selection component
├── dynamic-form-generator.tsx # Dynamic form field generator
├── enhanced-proposal-form.tsx # Complete proposal form with field selection
├── enhanced-pitch-deck-form.tsx # Complete pitch deck form with field selection
└── ui/                       # Base UI components

app/api/generate/
├── proposal/route.ts         # Enhanced proposal generation API
└── pitch-deck/route.ts       # Enhanced pitch deck generation API

examples/
├── technology-proposal-example.md    # Technology field proposal example
└── healthcare-pitch-deck-example.md  # Healthcare field pitch deck example
```

## 🛠️ Setup Instructions

### 1. Environment Configuration

Add your OpenRouter API key to `.env.local`:

```bash
# OpenRouter Configuration (for free AI models)
OPENROUTER_API_KEY=your-openrouter-api-key-here
```

### 2. Get OpenRouter API Key (Free)

1. Visit [OpenRouter.ai](https://openrouter.ai/)
2. Sign up for a free account
3. Navigate to "Keys" section
4. Create a new API key
5. Add the key to your environment file

### 3. Install Dependencies

The implementation uses existing dependencies from the project:
- `@ai-sdk/openai` - AI SDK for OpenRouter integration
- `ai` - AI generation utilities
- Existing UI components (Button, Input, Card, etc.)

No additional package installation required.

## 🏗️ Architecture

### Field Configuration System

Each industry field contains:

```typescript
interface FieldConfiguration {
  id: string;                    // Unique field identifier
  name: string;                  // Display name
  description: string;           // Field description
  icon: LucideIcon;             // UI icon
  color: string;                // Theme color
  workflows: {
    proposal: ProposalWorkflow;  // Proposal-specific configuration
    pitchDeck: PitchDeckWorkflow; // Pitch deck-specific configuration
  };
  formFields: FormFieldConfig[]; // Dynamic form fields
}
```

### AI Service Architecture

```typescript
class FieldSpecificAIService {
  // Generate field-specific proposals
  async generateProposal(data: ProposalGenerationRequest): Promise<OpenRouterGenerationResponse>
  
  // Generate field-specific pitch decks
  async generatePitchDeck(data: PitchDeckGenerationRequest): Promise<OpenRouterGenerationResponse>
  
  // Build field-specific prompts
  private buildProposalPrompt(data, fieldConfig): string
  private buildPitchDeckPrompt(data, fieldConfig): string
}
```

## 📋 Field Configurations

### Technology & Software Development

**Proposal Sections (10 sections)**:
1. Technical Requirements Analysis
2. Solution Architecture
3. Development Methodology (Agile/Scrum)
4. Technology Stack Recommendations
5. Timeline & Milestones
6. Development Team Structure
7. Quality Assurance Process
8. Deployment & Maintenance
9. Security Considerations
10. Budget Breakdown

**Pitch Deck Slides (10 slides)**:
1. Problem & Market Gap
2. Technical Solution
3. Product Demo/MVP
4. Technology Competitive Advantage
5. Development Roadmap
6. Tech Team Expertise
7. Scalability Architecture
8. Market Validation & Metrics
9. Funding for R&D
10. Go-to-Market Strategy

**Field-Specific Form Fields**:
- Project Complexity (Simple/Medium/Complex/Enterprise)
- Technology Stack (React, Node.js, Python, AWS, etc.)
- Integration Requirements
- Security & Compliance Needs (GDPR, SOC 2, etc.)

### Healthcare & Medical Services

**Proposal Sections (9 sections)**:
1. Healthcare Compliance Overview
2. Patient Data Security (HIPAA)
3. Clinical Workflow Integration
4. Regulatory Requirements
5. Training & Implementation
6. Outcome Measurement
7. Risk Management
8. Compliance Monitoring
9. Support & Maintenance

**Pitch Deck Slides (10 slides)**:
1. Healthcare Problem
2. Clinical Solution
3. Regulatory Pathway
4. Clinical Validation
5. Healthcare Market Size
6. Reimbursement Strategy
7. Clinical Advisory Board
8. FDA/Regulatory Status
9. Healthcare Partnerships
10. Patient Impact Metrics

**Field-Specific Form Fields**:
- Compliance Requirements (HIPAA, FDA 510(k), etc.)
- Target Patient Population
- Expected Clinical Outcomes

## 🎯 Example Outputs

### Technology Proposal Example
- **Client**: TechMart Solutions
- **Project**: Cloud-Native E-commerce Platform
- **Sections**: Technical architecture, security implementation, development methodology
- **Length**: ~2,500 words with technical specifications

### Healthcare Pitch Deck Example
- **Company**: MediConnect AI
- **Problem**: Remote patient monitoring gaps
- **Solution**: AI-powered predictive monitoring
- **Slides**: Clinical evidence, regulatory pathway, reimbursement strategy

## 🔄 Usage Flow

1. **Field Selection**: User selects their industry from visual cards
2. **Dynamic Form**: Form adapts to show field-specific inputs
3. **Data Collection**: User fills in basic info + field-specific data
4. **AI Generation**: OpenRouter generates field-specific content
5. **Document Creation**: Professional document saved to database

## 🚀 API Integration

### Enhanced Proposal API

```typescript
POST /api/generate/proposal

Body: {
  field: string,                    // Selected industry field
  clientName: string,
  projectTitle: string,
  projectDescription: string,
  goals: string,
  fieldSpecificData: Record<string, any>,
  modelPreference?: 'primary' | 'fallback' | 'lightweight'
}

Response: {
  id: string,
  message: string,
  metadata: {
    field: string,
    model: string,
    tokensUsed: number,
    generationTime: number
  }
}
```

### Enhanced Pitch Deck API

```typescript
POST /api/generate/pitch-deck

Body: {
  field: string,                    // Selected industry field  
  startupName: string,
  problem: string,
  solution: string,
  market: string,
  fieldSpecificData: Record<string, any>,
  modelPreference?: 'primary' | 'fallback' | 'lightweight'
}
```

## 📈 Benefits

### For Users
- **Industry Expertise**: Content tailored to specific field requirements
- **Professional Quality**: Industry-standard sections and terminology
- **Time Savings**: No need to research field-specific best practices
- **Higher Success Rate**: Documents optimized for target audience

### For Developers
- **Modular Architecture**: Easy to add new fields and workflows
- **Cost Effective**: Uses free OpenRouter models
- **Extensible**: Simple configuration-based field definitions
- **Maintainable**: Clear separation of concerns

## 🔧 Extending the System

### Adding New Fields

1. **Add Field Configuration** in `lib/field-config.ts`:
```typescript
{
  id: 'finance',
  name: 'Financial Services',
  description: 'Investment banking, consulting, etc.',
  icon: DollarSign,
  color: 'green',
  workflows: { /* workflows */ },
  formFields: [ /* fields */ ]
}
```

2. **Add Prompts** in `lib/prompt-templates.ts`
3. **Test Integration** with existing components

### Model Configuration

Modify `lib/openrouter.ts` to add new models or change preferences:

```typescript
export const openRouterConfig = {
  models: {
    primary: 'meta-llama/llama-3.1-8b-instruct:free',
    fallback: 'google/gemma-2-9b-it:free',
    lightweight: 'microsoft/phi-3-mini-128k-instruct:free',
    // Add new models here
  }
}
```

## 🧪 Testing

The system has been tested with:
- ✅ Field selection functionality
- ✅ Dynamic form generation
- ✅ OpenRouter API integration
- ✅ Enhanced API endpoints
- ✅ Error handling and fallbacks
- ✅ Example document generation

## 🎉 Ready to Use

The field-specific AI system is now fully implemented and ready for use. Users can:

1. Select their industry (Technology or Healthcare)
2. Fill in customized forms with field-specific inputs
3. Generate professional, industry-tailored proposals and pitch decks
4. Export and share their documents

The system uses OpenRouter's free models, making it cost-effective while providing high-quality, field-specific content generation.