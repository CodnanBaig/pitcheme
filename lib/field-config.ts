import { 
  Code, 
  Heart, 
  DollarSign, 
  Megaphone, 
  Users, 
  GraduationCap, 
  Building, 
  Scale, 
  Palette, 
  Cog 
} from 'lucide-react';

export interface FormFieldConfig {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect';
  required: boolean;
  placeholder?: string;
  options?: string[];
  description?: string;
}

export interface ProposalWorkflow {
  sections: string[];
  requiredFields: string[];
  suggestedLength: number;
  industryPrompts: string[];
}

export interface PitchDeckWorkflow {
  slides: string[];
  requiredFields: string[];
  presentationStyle: string;
  focusAreas: string[];
}

export interface FieldConfiguration {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  workflows: {
    proposal: ProposalWorkflow;
    pitchDeck: PitchDeckWorkflow;
  };
  formFields: FormFieldConfig[];
}

export const FIELD_CONFIGURATIONS: FieldConfiguration[] = [
  {
    id: 'technology',
    name: 'Technology & Software Development',
    description: 'Software development, SaaS products, technical consulting',
    icon: Code,
    color: 'blue',
    workflows: {
      proposal: {
        sections: [
          'Technical Requirements Analysis',
          'Solution Architecture',
          'Development Methodology',
          'Technology Stack Recommendations',
          'Timeline & Milestones',
          'Development Team Structure',
          'Quality Assurance Process',
          'Deployment & Maintenance',
          'Security Considerations',
          'Budget Breakdown'
        ],
        requiredFields: ['projectComplexity', 'techStack', 'timeline', 'budget'],
        suggestedLength: 2500,
        industryPrompts: [
          'Focus on technical architecture and scalability',
          'Include security and compliance considerations',
          'Emphasize development methodology and best practices',
          'Highlight technical expertise and experience'
        ]
      },
      pitchDeck: {
        slides: [
          'Problem & Market Gap',
          'Technical Solution',
          'Product Demo/MVP',
          'Technology Competitive Advantage',
          'Development Roadmap',
          'Tech Team Expertise',
          'Scalability Architecture',
          'Market Validation & Metrics',
          'Funding for R&D',
          'Go-to-Market Strategy'
        ],
        requiredFields: ['problemStatement', 'technicalSolution', 'marketSize'],
        presentationStyle: 'technical',
        focusAreas: ['innovation', 'scalability', 'technical_expertise', 'market_disruption']
      }
    },
    formFields: [
      {
        id: 'projectComplexity',
        label: 'Project Complexity',
        type: 'select',
        required: true,
        options: ['Simple', 'Medium', 'Complex', 'Enterprise'],
        description: 'How complex is the technical implementation?'
      },
      {
        id: 'techStack',
        label: 'Preferred Technology Stack',
        type: 'multiselect',
        required: false,
        options: ['React/Next.js', 'Node.js', 'Python/Django', 'Java/Spring', 'AWS', 'Azure', 'Docker', 'Kubernetes'],
        description: 'Select preferred technologies for the project'
      },
      {
        id: 'integrationNeeds',
        label: 'Integration Requirements',
        type: 'textarea',
        required: false,
        placeholder: 'Describe any third-party integrations, APIs, or existing systems...'
      },
      {
        id: 'securityRequirements',
        label: 'Security & Compliance Needs',
        type: 'multiselect',
        required: false,
        options: ['GDPR', 'SOC 2', 'HIPAA', 'PCI DSS', 'ISO 27001', 'Custom Security Requirements']
      }
    ]
  },
  {
    id: 'healthcare',
    name: 'Healthcare & Medical Services',
    description: 'Medical devices, healthcare software, clinical services',
    icon: Heart,
    color: 'red',
    workflows: {
      proposal: {
        sections: [
          'Healthcare Compliance Overview',
          'Patient Data Security (HIPAA)',
          'Clinical Workflow Integration',
          'Regulatory Requirements',
          'Training & Implementation',
          'Outcome Measurement',
          'Risk Management',
          'Compliance Monitoring',
          'Support & Maintenance'
        ],
        requiredFields: ['complianceType', 'patientPopulation', 'regulatoryPath'],
        suggestedLength: 3000,
        industryPrompts: [
          'Prioritize patient safety and outcomes',
          'Include relevant regulatory considerations',
          'Reference clinical evidence and best practices',
          'Address compliance and risk management'
        ]
      },
      pitchDeck: {
        slides: [
          'Healthcare Problem',
          'Clinical Solution',
          'Regulatory Pathway',
          'Clinical Validation',
          'Healthcare Market Size',
          'Reimbursement Strategy',
          'Clinical Advisory Board',
          'FDA/Regulatory Status',
          'Healthcare Partnerships',
          'Patient Impact Metrics'
        ],
        requiredFields: ['healthcareProblem', 'clinicalSolution', 'regulatoryStatus'],
        presentationStyle: 'clinical',
        focusAreas: ['patient_outcomes', 'clinical_evidence', 'regulatory_compliance', 'market_access']
      }
    },
    formFields: [
      {
        id: 'complianceType',
        label: 'Compliance Requirements',
        type: 'multiselect',
        required: true,
        options: ['HIPAA', 'FDA 510(k)', 'FDA PMA', 'MDR (EU)', 'ISO 13485', 'Other'],
        description: 'Which regulatory standards apply?'
      },
      {
        id: 'patientPopulation',
        label: 'Target Patient Population',
        type: 'text',
        required: true,
        placeholder: 'e.g., Diabetes patients, Elderly care, Pediatric oncology...'
      },
      {
        id: 'clinicalOutcomes',
        label: 'Expected Clinical Outcomes',
        type: 'textarea',
        required: false,
        placeholder: 'Describe the clinical benefits and measurable outcomes...'
      }
    ]
  }
];

export function getFieldConfiguration(fieldId: string): FieldConfiguration | undefined {
  return FIELD_CONFIGURATIONS.find(field => field.id === fieldId);
}

export function getDefaultField(): string {
  return 'technology';
}