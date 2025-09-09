"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FieldSelector } from '@/components/field-selector';
import { DynamicFormGenerator } from '@/components/dynamic-form-generator';
import { getFieldConfiguration } from '@/lib/field-config';

interface ProposalFormData {
  clientName: string;
  clientCompany: string;
  projectTitle: string;
  projectDescription: string;
  goals: string;
  budget: string;
  timeline: string;
  services: string[];
  field: string;
  fieldSpecificData: Record<string, string | string[]>;
}

export function EnhancedProposalForm() {
  const [step, setStep] = useState<'field' | 'form' | 'generation'>('field');
  const [formData, setFormData] = useState<ProposalFormData>({
    clientName: '',
    clientCompany: '',
    projectTitle: '',
    projectDescription: '',
    goals: '',
    budget: '',
    timeline: '',
    services: [],
    field: '',
    fieldSpecificData: {}
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

  const handleInputChange = (field: keyof ProposalFormData, value: string | string[]) => {
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
    if (!formData.clientName || !formData.projectTitle || !formData.projectDescription || !formData.goals) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields to generate your proposal.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setStep('generation');

    try {
      const response = await fetch("/api/generate/proposal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to generate proposal");
      }

      const result = await response.json();
      router.push(`/proposal/${result.id}`);
    } catch (error) {
      console.error("Error generating proposal:", error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating your proposal. Please try again.",
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
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Generating Your Proposal</h3>
            <p className="text-muted-foreground">
              Our AI is creating a customized {fieldConfig?.name.toLowerCase()} proposal for you...
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
        <div className={`flex items-center space-x-2 ${step === 'field' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'field' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}>1</div>
          <span className="text-sm font-medium">Select Industry</span>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <div className={`flex items-center space-x-2 ${step === 'form' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'form' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}>2</div>
          <span className="text-sm font-medium">Project Details</span>
        </div>
      </div>

      {step === 'field' && (
        <Card>
          <CardContent className="p-6">
            <FieldSelector
              selectedField={formData.field}
              onFieldSelect={handleFieldSelect}
              documentType="proposal"
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

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Client & Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">
                    Client Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="clientName"
                    value={formData.clientName}
                    onChange={(e) => handleInputChange('clientName', e.target.value)}
                    placeholder="Enter client's name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientCompany">Company Name</Label>
                  <Input
                    id="clientCompany"
                    value={formData.clientCompany}
                    onChange={(e) => handleInputChange('clientCompany', e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="projectTitle">
                  Project Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="projectTitle"
                  value={formData.projectTitle}
                  onChange={(e) => handleInputChange('projectTitle', e.target.value)}
                  placeholder="Enter project title"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="projectDescription">
                  Project Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="projectDescription"
                  value={formData.projectDescription}
                  onChange={(e) => handleInputChange('projectDescription', e.target.value)}
                  placeholder="Describe the project scope and requirements..."
                  rows={4}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="goals">
                  Project Goals <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="goals"
                  value={formData.goals}
                  onChange={(e) => handleInputChange('goals', e.target.value)}
                  placeholder="What are the key objectives and success criteria?"
                  rows={3}
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budget">Budget Range</Label>
                  <Input
                    id="budget"
                    value={formData.budget}
                    onChange={(e) => handleInputChange('budget', e.target.value)}
                    placeholder="e.g., $10,000 - $25,000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeline">Timeline</Label>
                  <Input
                    id="timeline"
                    value={formData.timeline}
                    onChange={(e) => handleInputChange('timeline', e.target.value)}
                    placeholder="e.g., 3-4 months"
                  />
                </div>
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
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Sparkles className="w-5 h-5" />
                  <span className="font-medium">Ready to generate your {fieldConfig.name.toLowerCase()} proposal?</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Our AI will create a professional, industry-specific proposal with {fieldConfig.workflows.proposal.sections.length} customized sections.
                </p>
                <Button 
                  type="submit" 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 px-8" 
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Proposal...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Proposal
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