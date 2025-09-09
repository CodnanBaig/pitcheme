# Kimi-K2 Visual Pitch Deck Generation & PDF Export Guide

## Overview

This guide explains how to use the enhanced AI service with the MoonshotAI Kimi-K2 model for generating visual pitch decks optimized for PDF export.

## Key Features

- **Kimi-K2 Model**: Uses `moonshotai/kimi-k2:free` for visual content generation
- **PDF Optimization**: Automatically generates HTML-structured content for seamless PDF conversion
- **Visual Layout**: Includes detailed visual descriptions and styling for professional presentations
- **Fallback Support**: Graceful fallback to alternative models if Kimi-K2 is unavailable

## Usage

### 1. Visual Pitch Deck Generation

```typescript
import { aiService } from '@/lib/ai-service';

const request = {
  field: 'technology',
  startupName: 'TechCorp',
  tagline: 'Revolutionizing AI',
  problem: 'Existing AI solutions are too complex',
  solution: 'Our simplified AI platform',
  market: 'Global AI market worth $500B',
  businessModel: 'SaaS subscription',
  team: 'Experienced AI engineers',
  funding: '$2M Series A',
  fieldSpecificData: {
    techStack: 'React, TensorFlow, AWS',
    competitors: 'OpenAI, Google',
    traction: '1000+ users, $50K MRR'
  },
  visualMode: true // This will use Kimi-K2 model
};

const result = await aiService.generatePitchDeck(request);
```

### 2. PDF-Optimized Generation

```typescript
const request = {
  field: 'technology',
  startupName: 'TechCorp',
  tagline: 'Revolutionizing AI',
  problem: 'Existing AI solutions are too complex',
  solution: 'Our simplified AI platform',
  market: 'Global AI market worth $500B',
  businessModel: 'SaaS subscription',
  team: 'Experienced AI engineers',
  funding: '$2M Series A',
  fieldSpecificData: {
    techStack: 'React, TensorFlow, AWS',
    competitors: 'OpenAI, Google',
    traction: '1000+ users, $50K MRR'
  },
  exportFormat: 'pdf' // This will use PDF-optimized generation
};

const result = await aiService.generatePitchDeck(request);
```

### 3. Direct PDF-Optimized Generation

```typescript
const result = await aiService.generatePDFOptimizedPitchDeck(request);
```

## API Response

The service returns a structured response:

```typescript
interface OpenRouterGenerationResponse {
  content: string;           // Generated content (HTML for PDF-optimized)
  model: string;            // Model used (e.g., 'moonshotai/kimi-k2:free')
  tokensUsed: number;       // Tokens consumed
  generationTime: number;   // Generation time in milliseconds
  success: boolean;          // Whether generation was successful
  error?: string;           // Error message if failed
}
```

## PDF Export Features

### HTML Structure

The PDF-optimized content includes:

- **Professional Styling**: Gradient backgrounds, proper typography
- **Page Breaks**: Automatic slide separation for PDF
- **Visual Elements**: Detailed descriptions for charts, graphs, images
- **Responsive Layout**: Flexbox-based layouts that work well in PDF
- **Speaker Notes**: Embedded presentation notes

### Example Output Structure

```html
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
      <p style="font-size: 16px; line-height: 1.5;">[Detailed visual description]</p>
    </div>
  </div>
  
  <div style="margin-top: 30px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px;">
    <h3 style="font-size: 18px; margin-bottom: 10px; color: #f8f9fa;">Speaker Notes</h3>
    <p style="font-size: 16px; line-height: 1.5;">[Compelling talking points]</p>
  </div>
</div>
```

## Configuration

### Model Selection

The service automatically selects the Kimi-K2 model for visual content:

```typescript
// In lib/openrouter.ts
export const openRouterConfig = {
  models: {
    visual: 'moonshotai/kimi-k2:free'  // Kimi-K2 for visual content
  }
};
```

### Token Limits

- **Visual Generation**: 6000 tokens
- **PDF-Optimized**: 8000 tokens (higher for comprehensive content)

## Error Handling

The service includes robust error handling:

1. **Model Failure**: Falls back to alternative models
2. **Content Validation**: Ensures generated content is properly formatted
3. **PDF Compatibility**: Validates HTML structure for PDF export

## Best Practices

1. **Provide Rich Data**: Include specific metrics, market data, and field-specific information
2. **Use Visual Mode**: Enable `visualMode: true` for enhanced visual content
3. **Specify Export Format**: Use `exportFormat: 'pdf'` for PDF-optimized generation
4. **Include Field-Specific Data**: Add relevant industry data for better content quality

## Integration with Export API

The generated content automatically works with the existing PDF export API:

```typescript
// The export API automatically detects HTML-formatted content
// and handles it appropriately for PDF generation
GET /api/export/pitch-deck/[id]
```

## Performance Considerations

- **Token Usage**: Kimi-K2 uses more tokens but produces higher quality content
- **Generation Time**: Visual content takes longer but results in better PDFs
- **Memory Usage**: PDF-optimized content is larger but more comprehensive

## Troubleshooting

### Common Issues

1. **Model Unavailable**: Service automatically falls back to alternative models
2. **Content Format**: Ensure field-specific data is properly structured
3. **PDF Rendering**: Generated HTML is optimized for Puppeteer PDF conversion

### Debugging

Check the response metadata for debugging:

```typescript
console.log('Model used:', result.model);
console.log('Tokens consumed:', result.tokensUsed);
console.log('Generation time:', result.generationTime);
```

## Future Enhancements

- **Custom Templates**: Support for custom visual templates
- **Brand Integration**: Company branding and color schemes
- **Interactive Elements**: Support for interactive PDF features
- **Multi-language**: Support for international content generation

