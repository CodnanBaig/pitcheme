"use client"

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FIELD_CONFIGURATIONS, FieldConfiguration } from '@/lib/field-config';
import { cn } from '@/lib/utils';

interface FieldSelectorProps {
  selectedField?: string;
  onFieldSelect: (fieldId: string) => void;
  documentType: 'proposal' | 'pitch-deck';
  className?: string;
}

export function FieldSelector({ 
  selectedField, 
  onFieldSelect, 
  documentType,
  className 
}: FieldSelectorProps) {
  const handleFieldSelect = (field: FieldConfiguration) => {
    onFieldSelect(field.id);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-foreground">
          Select Your Industry
        </h3>
        <p className="text-sm text-muted-foreground">
          Choose your field to get a customized {documentType.replace('-', ' ')} template
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELD_CONFIGURATIONS.map((field) => {
          const isSelected = selectedField === field.id;
          const Icon = field.icon;
          
          return (
            <Card 
              key={field.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md",
                isSelected ? "ring-2 ring-primary border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
              onClick={() => handleFieldSelect(field)}
            >
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                    field.color === 'blue' && "bg-blue-100 text-blue-600",
                    field.color === 'red' && "bg-red-100 text-red-600",
                    field.color === 'green' && "bg-green-100 text-green-600",
                    field.color === 'purple' && "bg-purple-100 text-purple-600"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-foreground text-sm leading-tight">
                        {field.name}
                      </h4>
                      {isSelected && (
                        <Badge variant="secondary" className="text-xs">
                          Selected
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {field.description}
                    </p>
                    
                    {documentType === 'proposal' && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {field.workflows.proposal.sections.length} sections
                      </div>
                    )}
                    
                    {documentType === 'pitch-deck' && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {field.workflows.pitchDeck.slides.length} slides
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {selectedField && (
        <div className="text-center">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onFieldSelect('')}
          >
            Clear Selection
          </Button>
        </div>
      )}
    </div>
  );
}