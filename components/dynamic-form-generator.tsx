"use client"

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormFieldConfig } from '@/lib/field-config';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface DynamicFormFieldProps {
  field: FormFieldConfig;
  value: string | string[];
  onChange: (value: string | string[]) => void;
}

export function DynamicFormField({ field, value, onChange }: DynamicFormFieldProps) {
  const handleMultiSelectChange = (optionValue: string) => {
    const currentValues = Array.isArray(value) ? value : [];
    const newValues = currentValues.includes(optionValue)
      ? currentValues.filter(v => v !== optionValue)
      : [...currentValues, optionValue];
    onChange(newValues);
  };

  const removeMultiSelectValue = (optionValue: string) => {
    const currentValues = Array.isArray(value) ? value : [];
    onChange(currentValues.filter(v => v !== optionValue));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}

      {field.type === 'text' && (
        <Input
          id={field.id}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
        />
      )}

      {field.type === 'textarea' && (
        <Textarea
          id={field.id}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          rows={3}
        />
      )}

      {field.type === 'select' && field.options && (
        <Select 
          value={typeof value === 'string' ? value : ''} 
          onValueChange={(val) => onChange(val)}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === 'multiselect' && field.options && (
        <div className="space-y-2">
          <Select onValueChange={handleMultiSelectChange}>
            <SelectTrigger>
              <SelectValue placeholder={`Add ${field.label.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              {field.options
                .filter(option => !Array.isArray(value) || !value.includes(option))
                .map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {Array.isArray(value) && value.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {value.map((selectedValue) => (
                <Badge 
                  key={selectedValue} 
                  variant="secondary" 
                  className="text-xs px-2 py-1 cursor-pointer hover:bg-secondary/80"
                  onClick={() => removeMultiSelectValue(selectedValue)}
                >
                  {selectedValue}
                  <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DynamicFormGeneratorProps {
  fields: FormFieldConfig[];
  values: Record<string, string | string[]>;
  onChange: (fieldId: string, value: string | string[]) => void;
  className?: string;
}

export function DynamicFormGenerator({ 
  fields, 
  values, 
  onChange, 
  className 
}: DynamicFormGeneratorProps) {
  return (
    <div className={className}>
      <div className="space-y-6">
        {fields.map((field) => (
          <DynamicFormField
            key={field.id}
            field={field}
            value={values[field.id] || (field.type === 'multiselect' ? [] : '')}
            onChange={(value) => onChange(field.id, value)}
          />
        ))}
      </div>
    </div>
  );
}