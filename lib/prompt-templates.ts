export const FIELD_SPECIFIC_PROMPTS = {
  technology: {
    proposal: {
      systemPrompt: `You are a senior technical consultant with 15+ years of experience in software development and technology consulting. You specialize in creating comprehensive technical proposals that win enterprise contracts.`,
      
      contextPrompts: [
        "Focus on technical architecture, scalability, and security considerations",
        "Include specific technology stack recommendations with rationale",
        "Emphasize development methodology and best practices (Agile, DevOps, CI/CD)",
        "Address integration requirements and API specifications",
        "Highlight technical expertise and previous successful implementations",
        "Include comprehensive security and compliance frameworks",
        "Provide detailed technical specifications and system requirements"
      ],
      
      sectionPrompts: {
        "Technical Requirements Analysis": "Analyze technical requirements, system constraints, performance needs, integration points, and scalability requirements. Include technical feasibility assessment.",
        "Solution Architecture": "Design comprehensive solution architecture with system diagrams, technology stack, database design, API structure, and deployment architecture.",
        "Development Methodology": "Outline Agile/Scrum methodology, sprint planning, code review process, testing procedures, and delivery timeline with milestones.",
        "Technology Stack Recommendations": "Recommend specific technologies, frameworks, tools with detailed rationale for each choice. Include version specifications and licensing considerations.",
        "Security Considerations": "Address security architecture, data protection, access control, compliance requirements (GDPR, SOC2), vulnerability management, and security testing.",
        "Quality Assurance Process": "Detail testing strategy including unit testing, integration testing, performance testing, security testing, and automated testing procedures."
      }
    },
    
    pitchDeck: {
      systemPrompt: `You are a technology entrepreneur and investor with deep expertise in software startups. You've successfully raised multiple funding rounds and know what investors look for in tech companies.`,
      
      slidePrompts: {
        "Problem & Market Gap": "Define a significant technical or market problem that affects a large addressable market. Include market size, current pain points, and why existing solutions fail.",
        "Technical Solution": "Present your innovative technical solution with clear differentiation. Explain the technology advantage and why it's superior to alternatives.",
        "Product Demo/MVP": "Showcase your product capabilities, user interface, key features, and technical achievements. Include metrics and user feedback.",
        "Technology Competitive Advantage": "Explain your technical moat - proprietary algorithms, patents, technical barriers to entry, or unique technical capabilities.",
        "Development Roadmap": "Present technical milestones, feature development timeline, scalability plans, and technology evolution strategy.",
        "Tech Team Expertise": "Highlight technical team credentials, previous successful projects, technical leadership, and advisory board expertise."
      }
    }
  },
  
  healthcare: {
    proposal: {
      systemPrompt: `You are a healthcare industry expert and compliance consultant with extensive experience in medical device development, clinical services, and healthcare regulations.`,
      
      contextPrompts: [
        "Prioritize patient safety and clinical outcomes in all recommendations",
        "Include comprehensive regulatory compliance framework (FDA, HIPAA, etc.)",
        "Reference clinical evidence, medical literature, and best practices",
        "Address healthcare workflow integration and provider adoption",
        "Emphasize quality assurance and risk management protocols",
        "Include healthcare-specific terminology and standards",
        "Focus on measurable clinical outcomes and patient impact"
      ],
      
      sectionPrompts: {
        "Healthcare Compliance Overview": "Detail regulatory compliance requirements, quality management systems, and healthcare standards applicable to the project.",
        "Patient Data Security (HIPAA)": "Comprehensive HIPAA compliance plan including data encryption, access controls, audit trails, and breach prevention protocols.",
        "Clinical Workflow Integration": "Analyze existing clinical workflows, integration points with EHR systems, provider training requirements, and workflow optimization.",
        "Regulatory Requirements": "Identify FDA regulations, medical device classifications, clinical trial requirements, and regulatory pathway to market.",
        "Outcome Measurement": "Define clinical endpoints, quality metrics, patient outcome measures, and data collection methodologies for effectiveness evaluation.",
        "Risk Management": "Clinical risk assessment, patient safety protocols, adverse event reporting, and risk mitigation strategies."
      }
    },
    
    pitchDeck: {
      systemPrompt: `You are a healthcare investor and medical advisor with expertise in medical device investing, clinical development, and healthcare market dynamics.`,
      
      slidePrompts: {
        "Healthcare Problem": "Present a significant clinical need with patient impact statistics, current treatment limitations, and unmet medical needs in the target population.",
        "Clinical Solution": "Explain your medical innovation, treatment mechanism, clinical benefits, and how it improves patient outcomes compared to current standard of care.",
        "Regulatory Pathway": "Outline FDA approval strategy, regulatory classification, clinical trial requirements, and timeline to market clearance.",
        "Clinical Validation": "Present clinical evidence, pilot study results, key opinion leader endorsements, and validation from medical professionals.",
        "Healthcare Market Size": "Analyze patient population, market opportunity, reimbursement landscape, and healthcare spending in your target area.",
        "Reimbursement Strategy": "Explain payment model, insurance coverage strategy, health economics, and value-based care alignment."
      }
    }
  }
};

export function getPromptTemplate(field: string, documentType: 'proposal' | 'pitchDeck'): any {
  const fieldPrompts = FIELD_SPECIFIC_PROMPTS[field as keyof typeof FIELD_SPECIFIC_PROMPTS];
  if (!fieldPrompts) {
    // Return generic template for unknown fields
    return {
      systemPrompt: "You are a professional business consultant creating high-quality business documents.",
      contextPrompts: ["Focus on professionalism and clarity", "Include specific details and actionable insights"]
    };
  }
  
  return fieldPrompts[documentType];
}