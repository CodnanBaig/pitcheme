"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FieldSelector } from '@/components/field-selector';
import { DynamicFormGenerator } from '@/components/dynamic-form-generator';
import { getFieldConfiguration } from '@/lib/field-config';

interface PitchDeckFormData {
  startupName: string;
  tagline: string;
  problem: string;
  solution: string;
  market: string;
  businessModel: string;
  team: string;
  funding: string;
  field: string;
  fieldSpecificData: Record<string, string | string[]>;
  visualMode: boolean;
}

export function EnhancedPitchDeckForm() {
  const [step, setStep] = useState<'field' | 'form' | 'generation'>('field');
  const [formData, setFormData] = useState<PitchDeckFormData>({
    startupName: '',
    tagline: '',
    problem: '',
    solution: '',
    market: '',
    businessModel: '',
    team: '',
    funding: '',
    field: '',
    fieldSpecificData: {},
    visualMode: true
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleFieldSelect = (fieldId: string) => {
    setFormData(prev => ({ ...prev, field: fieldId }));
    if (fieldId) {
      setStep('form');
    }
  };

  const handleInputChange = (field: keyof PitchDeckFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFieldSpecificDataChange = (fieldId: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      fieldSpecificData: {
        ...prev.fieldSpecificData,
        [fieldId]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.startupName || !formData.problem || !formData.solution || !formData.market) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields to generate your pitch deck.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setStep('generation');

    try {
      const response = await fetch("/api/generate/pitch-deck", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to generate pitch deck");
      }

      const result = await response.json();
      router.push(`/pitch-deck/${result.id}`);
    } catch (error) {
      console.error("Error generating pitch deck:", error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating your pitch deck. Please try again.",
        variant: "destructive",
      });
      setStep('form');
    } finally {
      setIsGenerating(false);
    }
  };

  const fieldConfig = formData.field ? getFieldConfiguration(formData.field) : null;

  if (step === 'generation') {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="space-y-6">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Creating Your Pitch Deck</h3>
            <p className="text-muted-foreground">
              Our AI is crafting a compelling {fieldConfig?.name.toLowerCase()} pitch deck with {fieldConfig?.workflows.pitchDeck.slides.length} slides...
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            This usually takes 30-60 seconds
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        <div className={`flex items-center space-x-2 ${step === 'field' ? 'text-accent' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'field' ? 'bg-accent text-accent-foreground' : 'bg-muted'
          }`}>1</div>
          <span className="text-sm font-medium">Select Industry</span>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <div className={`flex items-center space-x-2 ${step === 'form' ? 'text-accent' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'form' ? 'bg-accent text-accent-foreground' : 'bg-muted'
          }`}>2</div>
          <span className="text-sm font-medium">Startup Details</span>
        </div>
      </div>

      {step === 'field' && (
        <Card>
          <CardContent className="p-6">
            <FieldSelector
              selectedField={formData.field}
              onFieldSelect={handleFieldSelect}
              documentType="pitch-deck"
            />
          </CardContent>
        </Card>
      )}

      {step === 'form' && fieldConfig && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Back Button */}
          <div className="flex items-center justify-between">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setStep('field')}
              className="text-muted-foreground"
            >
              ← Change Industry
            </Button>
            <div className="text-sm text-muted-foreground">
              Selected: {fieldConfig.name}
            </div>
          </div>

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startupName">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="startupName"
                    value={formData.startupName}
                    onChange={(e) => handleInputChange('startupName', e.target.value)}
                    placeholder="Enter your company name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={formData.tagline}
                    onChange={(e) => handleInputChange('tagline', e.target.value)}
                    placeholder="Brief company tagline or description"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Problem & Solution */}
          <Card>
            <CardHeader>
              <CardTitle>Problem & Solution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="problem">
                  Problem Statement <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="problem"
                  value={formData.problem}
                  onChange={(e) => handleInputChange('problem', e.target.value)}
                  placeholder="What problem are you solving? Why is it important?"
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="solution">
                  Solution <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="solution"
                  value={formData.solution}
                  onChange={(e) => handleInputChange('solution', e.target.value)}
                  placeholder="How does your product/service solve this problem?"
                  rows={3}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Market & Business Model */}
          <Card>
            <CardHeader>
              <CardTitle>Market & Business Model</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="market">
                  Target Market <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="market"
                  value={formData.market}
                  onChange={(e) => handleInputChange('market', e.target.value)}
                  placeholder="Describe your target market, size, and opportunity..."
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessModel">Business Model</Label>
                <Textarea
                  id="businessModel"
                  value={formData.businessModel}
                  onChange={(e) => handleInputChange('businessModel', e.target.value)}
                  placeholder="How do you make money? Revenue streams, pricing model..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Team & Funding */}
          <Card>
            <CardHeader>
              <CardTitle>Team & Funding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team">Team</Label>
                <Textarea
                  id="team"
                  value={formData.team}
                  onChange={(e) => handleInputChange('team', e.target.value)}
                  placeholder="Key team members, their roles and expertise..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="funding">Funding Ask</Label>
                <Input
                  id="funding"
                  value={formData.funding}
                  onChange={(e) => handleInputChange('funding', e.target.value)}
                  placeholder="e.g., Seeking $2M Series A"
                />
              </div>
            </CardContent>
          </Card>

          {/* Field-Specific Information */}
          {fieldConfig.formFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{fieldConfig.name} Specific Information</CardTitle>
              </CardHeader>
              <CardContent>
                <DynamicFormGenerator
                  fields={fieldConfig.formFields}
                  values={formData.fieldSpecificData}
                  onChange={handleFieldSpecificDataChange}
                />
              </CardContent>
            </Card>
          )}

          {/* Generate Button */}
          <Card className="border-accent/20 bg-accent/5">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                {/* Visual Mode Toggle */}
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Label htmlFor="visual-mode" className="text-sm font-medium">
                    Create Visual Pitch Deck
                  </Label>
                  <Switch
                    id="visual-mode"
                    checked={formData.visualMode}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, visualMode: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-center gap-2 text-accent">
                  <Sparkles className="w-5 h-5" />
                  <span className="font-medium">
                    Ready to create your {formData.visualMode ? 'visual ' : ''}{fieldConfig.name.toLowerCase()} pitch deck?
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Our AI will create a compelling {fieldConfig.workflows.pitchDeck.slides.length}-slide {formData.visualMode ? 'visual ' : ''}pitch deck tailored for {fieldConfig.name.toLowerCase()} investors.
                  {formData.visualMode && (
                    <span className="block mt-1 text-accent font-medium">
                      📊 Visual mode includes detailed slide layouts, charts, and visual descriptions!
                    </span>
                  )}
                </p>
                <Button 
                  type="submit" 
                  size="lg" 
                  className="bg-accent hover:bg-accent/90 text-accent-foreground px-8" 
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Pitch Deck...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Pitch Deck
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}