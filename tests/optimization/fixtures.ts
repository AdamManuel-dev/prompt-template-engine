/**
 * @fileoverview Test fixtures and mock data for optimization tests
 * @lastmodified 2025-08-26T19:00:00Z
 *
 * Features: Test data fixtures, mock factories, template generators
 * Main APIs: Template fixtures, optimization result mocks, configuration factories
 * Constraints: TypeScript test fixtures for Jest testing framework
 * Patterns: Factory pattern for test data, fixture management
 */

import { Template } from '../../src/types';
import { 
  OptimizationConfig,
  OptimizedResult,
  QualityScore,
  PromptComparison,
  OptimizationJob
} from '../../src/integrations/promptwizard/types';
import { 
  OptimizationRequest, 
  OptimizationResult,
  BatchOptimizationRequest,
  BatchOptimizationResult,
  OptimizationOptions 
} from '../../src/services/prompt-optimization.service';

/**
 * Template fixture categories for different test scenarios
 */
export enum TemplateCategory {
  SIMPLE = 'simple',
  COMPLEX = 'complex',
  CODING = 'coding',
  ANALYSIS = 'analysis',
  CREATIVE = 'creative',
  ASSISTANT = 'assistant',
  DOCUMENTATION = 'documentation',
  CONVERSATION = 'conversation'
}

/**
 * Test template fixtures organized by category
 */
export class TemplateFixtures {
  /**
   * Simple template with basic variables
   */
  static createSimpleTemplate(id: string = 'simple-template'): Template {
    return {
      id,
      name: 'Simple Greeting Template',
      content: 'Hello {{name}}, welcome to {{platform}}! How can I help you with {{task}} today?',
      variables: {
        name: 'string',
        platform: 'string', 
        task: 'string'
      },
      category: TemplateCategory.SIMPLE,
      version: '1.0.0',
      author: 'test@example.com',
      description: 'A simple greeting template for testing basic optimization'
    };
  }

  /**
   * Complex template with conditionals, loops, and partials
   */
  static createComplexTemplate(id: string = 'complex-template'): Template {
    return {
      id,
      name: 'Advanced Customer Support Template',
      content: `# Customer Support Assistant

Hello {{customer.name}},

{{#if customer.isPremium}}
Thank you for being a premium customer! We prioritize your support requests.
{{else}}
Thank you for contacting our support team.
{{/if}}

## Issue Details
- Category: {{issue.category}}
- Priority: {{issue.priority}}
- Reported: {{issue.timestamp}}

{{#if issue.category === "technical"}}
### Technical Support Process
1. Initial diagnosis
2. Solution implementation
3. Testing and validation
4. Follow-up confirmation

{{#each troubleshooting.steps}}
**Step {{@index}}:** {{this.description}}
{{#if this.codeExample}}
\`\`\`{{this.language}}
{{this.codeExample}}
\`\`\`
{{/if}}
{{/each}}
{{/if}}

{{#if customer.previousTickets}}
### Previous Interactions
{{#each customer.previousTickets}}
- Ticket #{{this.id}}: {{this.subject}} ({{this.status}})
{{/each}}
{{/if}}

## Contact Information
- Email: {{support.email}}
- Phone: {{support.phone}}
- Available: {{support.hours}}

{{> footer}}

Best regards,
{{agent.name}}
{{agent.department}}`,
      variables: {
        'customer.name': 'string',
        'customer.isPremium': 'boolean',
        'customer.previousTickets': 'array',
        'issue.category': 'string',
        'issue.priority': 'string',
        'issue.timestamp': 'string',
        'troubleshooting.steps': 'array',
        'support.email': 'string',
        'support.phone': 'string',
        'support.hours': 'string',
        'agent.name': 'string',
        'agent.department': 'string'
      },
      category: TemplateCategory.COMPLEX,
      version: '2.1.0',
      author: 'support@example.com',
      description: 'Complex customer support template with conditionals and loops'
    };
  }

  /**
   * Coding assistant template
   */
  static createCodingTemplate(id: string = 'coding-template'): Template {
    return {
      id,
      name: 'Code Review Assistant',
      content: `# Code Review for {{project.name}}

You are an expert {{language}} developer reviewing code for a {{project.type}} project.

## Review Context
- Repository: {{project.repository}}
- Branch: {{git.branch}}
- Author: {{code.author}}
- Files Changed: {{code.filesChanged}}

## Code to Review
\`\`\`{{language}}
{{code.content}}
\`\`\`

## Review Criteria
{{#each reviewCriteria}}
- **{{this.category}}**: {{this.description}}
{{/each}}

## Instructions
1. Analyze the code for bugs, security issues, and performance problems
2. Check code style and best practices for {{language}}
3. Suggest improvements and optimizations
4. Provide specific examples where needed
5. Rate the overall code quality (1-10)

## Expected Output Format
### Issues Found
- **[Severity]** Issue description and location
- **Suggestion**: Specific improvement recommendation

### Overall Assessment
- Code Quality Score: X/10
- Key Strengths: [List]
- Areas for Improvement: [List]
- Recommended Next Steps: [List]

Please provide a thorough review focusing on {{focus.areas}}.`,
      variables: {
        'project.name': 'string',
        'project.type': 'string',
        'project.repository': 'string',
        'git.branch': 'string',
        'code.author': 'string',
        'code.filesChanged': 'number',
        'code.content': 'string',
        'language': 'string',
        'reviewCriteria': 'array',
        'focus.areas': 'string'
      },
      category: TemplateCategory.CODING,
      version: '1.2.0',
      author: 'dev@example.com',
      description: 'Code review template for development workflows'
    };
  }

  /**
   * Data analysis template
   */
  static createAnalysisTemplate(id: string = 'analysis-template'): Template {
    return {
      id,
      name: 'Data Analysis Report',
      content: `# {{report.title}} - Data Analysis Report

## Executive Summary
Analysis of {{dataset.name}} covering {{analysis.period}} with {{dataset.recordCount}} records.

## Key Findings
{{#each keyFindings}}
**{{this.category}}**: {{this.description}}
- Impact: {{this.impact}}
- Confidence: {{this.confidence}}%
{{/each}}

## Methodology
- Data Source: {{dataset.source}}
- Analysis Period: {{analysis.period}}
- Tools Used: {{analysis.tools}}
- Statistical Methods: {{analysis.methods}}

## Detailed Results
{{#each analysisResults}}
### {{this.section}}
{{this.description}}

{{#if this.visualizations}}
#### Visualizations
{{#each this.visualizations}}
- {{this.type}}: {{this.description}}
{{/each}}
{{/if}}

{{#if this.statistics}}
#### Key Statistics
{{#each this.statistics}}
- {{this.metric}}: {{this.value}} ({{this.significance}})
{{/each}}
{{/if}}
{{/each}}

## Recommendations
{{#each recommendations}}
{{@index}}. **{{this.priority}}**: {{this.action}}
   - Expected Impact: {{this.impact}}
   - Timeline: {{this.timeline}}
   - Resources Needed: {{this.resources}}
{{/each}}

## Appendix
- Data Dictionary: {{appendix.dataDictionary}}
- Statistical Tests: {{appendix.tests}}
- Confidence Intervals: {{appendix.confidence}}

Generated on {{report.timestamp}} by {{analyst.name}}`,
      variables: {
        'report.title': 'string',
        'report.timestamp': 'string',
        'dataset.name': 'string',
        'dataset.source': 'string',
        'dataset.recordCount': 'number',
        'analysis.period': 'string',
        'analysis.tools': 'string',
        'analysis.methods': 'string',
        'keyFindings': 'array',
        'analysisResults': 'array',
        'recommendations': 'array',
        'appendix.dataDictionary': 'string',
        'appendix.tests': 'string',
        'appendix.confidence': 'string',
        'analyst.name': 'string'
      },
      category: TemplateCategory.ANALYSIS,
      version: '1.3.0',
      author: 'analyst@example.com',
      description: 'Data analysis report template with statistical content'
    };
  }

  /**
   * Creative writing template
   */
  static createCreativeTemplate(id: string = 'creative-template'): Template {
    return {
      id,
      name: 'Story Writing Assistant',
      content: `# {{story.title}}

{{#if story.genre}}
*Genre: {{story.genre}}*
{{/if}}

## Story Premise
{{story.premise}}

## Characters
{{#each characters}}
**{{this.name}}** - {{this.role}}
- Age: {{this.age}}
- Background: {{this.background}}
- Motivation: {{this.motivation}}
{{#if this.traits}}
- Key Traits: {{this.traits}}
{{/if}}
{{/each}}

## Setting
- **Time**: {{setting.time}}
- **Place**: {{setting.place}}
- **Atmosphere**: {{setting.atmosphere}}

{{#if story.outline}}
## Plot Outline
{{#each story.outline}}
### {{this.chapter}} - {{this.title}}
{{this.summary}}

Key events:
{{#each this.events}}
- {{this}}
{{/each}}
{{/each}}
{{/if}}

## Writing Style Guidelines
- **Tone**: {{style.tone}}
- **Perspective**: {{style.perspective}}
- **Target Length**: {{style.targetLength}} words
- **Target Audience**: {{style.audience}}

{{#if constraints}}
## Writing Constraints
{{#each constraints}}
- {{this.type}}: {{this.description}}
{{/each}}
{{/if}}

## Task
Write {{task.type}} focusing on {{task.focus}}. Ensure the content {{task.requirements}}.

{{#if examples}}
## Style Examples
{{#each examples}}
### Example {{@index}}
{{this.content}}
*Note: {{this.explanation}}*
{{/each}}
{{/if}}

Begin writing your {{task.type}} below:`,
      variables: {
        'story.title': 'string',
        'story.genre': 'string',
        'story.premise': 'string',
        'story.outline': 'array',
        'characters': 'array',
        'setting.time': 'string',
        'setting.place': 'string',
        'setting.atmosphere': 'string',
        'style.tone': 'string',
        'style.perspective': 'string',
        'style.targetLength': 'number',
        'style.audience': 'string',
        'task.type': 'string',
        'task.focus': 'string',
        'task.requirements': 'string',
        'constraints': 'array',
        'examples': 'array'
      },
      category: TemplateCategory.CREATIVE,
      version: '1.1.0',
      author: 'writer@example.com',
      description: 'Creative writing template for story development'
    };
  }

  /**
   * Generate templates for batch testing
   */
  static createBatchTemplates(count: number, category: TemplateCategory = TemplateCategory.SIMPLE): Template[] {
    const templates: Template[] = [];
    
    for (let i = 0; i < count; i++) {
      const id = `batch-${category}-${i}`;
      
      switch (category) {
        case TemplateCategory.SIMPLE:
          templates.push(this.createSimpleTemplate(id));
          break;
        case TemplateCategory.COMPLEX:
          templates.push(this.createComplexTemplate(id));
          break;
        case TemplateCategory.CODING:
          templates.push(this.createCodingTemplate(id));
          break;
        case TemplateCategory.ANALYSIS:
          templates.push(this.createAnalysisTemplate(id));
          break;
        case TemplateCategory.CREATIVE:
          templates.push(this.createCreativeTemplate(id));
          break;
        default:
          templates.push(this.createSimpleTemplate(id));
      }
    }
    
    return templates;
  }

  /**
   * Get template by category
   */
  static getTemplateByCategory(category: TemplateCategory, id?: string): Template {
    const templateId = id || `${category}-template`;
    
    switch (category) {
      case TemplateCategory.SIMPLE:
        return this.createSimpleTemplate(templateId);
      case TemplateCategory.COMPLEX:
        return this.createComplexTemplate(templateId);
      case TemplateCategory.CODING:
        return this.createCodingTemplate(templateId);
      case TemplateCategory.ANALYSIS:
        return this.createAnalysisTemplate(templateId);
      case TemplateCategory.CREATIVE:
        return this.createCreativeTemplate(templateId);
      default:
        return this.createSimpleTemplate(templateId);
    }
  }
}

/**
 * Factory for creating optimization configuration mocks
 */
export class OptimizationConfigFactory {
  static createBasicConfig(): OptimizationConfig {
    return {
      task: 'General purpose optimization',
      prompt: 'Test prompt for optimization',
      targetModel: 'gpt-4',
      mutateRefineIterations: 3,
      fewShotCount: 5,
      generateReasoning: true
    };
  }

  static createAdvancedConfig(): OptimizationConfig {
    return {
      task: 'Advanced template optimization',
      prompt: 'Complex test prompt with multiple variables and conditions',
      targetModel: 'gpt-4',
      mutateRefineIterations: 7,
      fewShotCount: 15,
      generateReasoning: true,
      metadata: {
        templateId: 'advanced-template',
        templateName: 'Advanced Template',
        complexity: 'high',
        domain: 'technical',
        priority: 'high'
      }
    };
  }

  static createMinimalConfig(): OptimizationConfig {
    return {
      task: 'Basic optimization',
      prompt: 'Simple prompt',
      targetModel: 'gpt-3.5-turbo',
      mutateRefineIterations: 1,
      fewShotCount: 2,
      generateReasoning: false
    };
  }
}

/**
 * Factory for creating optimization result mocks - using PromptWizard OptimizedResult type
 */
export class OptimizationResultFactory {
  static createSuccessfulResult(templateId: string = 'test-template'): OptimizedResult {
    const jobId = `job-${templateId}-${Date.now()}`;
    const originalPrompt = this.generateRealisticPrompt();
    
    return {
      jobId,
      originalPrompt,
      optimizedPrompt: this.optimizeContent(originalPrompt),
      status: 'completed',
      metrics: {
        accuracyImprovement: 8.7,
        tokenReduction: 22.5,
        costReduction: 0.18,
        processingTime: 2.5,
        apiCallsUsed: 3
      },
      examples: [
        {
          input: 'Example task input',
          output: 'Example expected output'
        }
      ],
      reasoning: [
        'Step 1: Analyzed prompt structure', 
        'Step 2: Identified optimization opportunities',
        'Step 3: Applied token reduction techniques'
      ],
      createdAt: new Date('2025-08-26T19:00:00Z'),
      completedAt: new Date('2025-08-26T19:02:30Z')
    };
  }
  
  private static generateRealisticPrompt(): string {
    const prompts = [
      'You are a helpful assistant. Please {{task}} for the user.',
      'Generate a detailed response about {{topic}} including {{requirements}}.',
      'Act as {{role}} and provide {{output_type}} for {{context}}.',
      'Please analyze {{data}} and provide {{analysis_type}} with {{format}} format.',
      'Create {{deliverable}} for {{audience}} focusing on {{key_points}}.'
    ];
    return prompts[Math.floor(Math.random() * prompts.length)];
  }
  
  private static optimizeContent(content: string): string {
    return content
      .replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
        return `{{${variable.trim()}}}`;
      })
      .replace(/You are a helpful assistant\. Please/g, 'Please')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static createPartialSuccessResult(templateId: string = 'partial-template'): OptimizedResult {
    const result = this.createSuccessfulResult(templateId);
    
    // Modify to show partial success
    result.metrics.tokenReduction = 5.2;
    result.metrics.accuracyImprovement = 2.1;
    result.metrics.costReduction = 0.08;
    
    return result;
  }

  static createFailedOptimizationResult(templateId: string = 'failed-template'): OptimizedResult {
    const jobId = `job-${templateId}-${Date.now()}`;
    const originalPrompt = this.generateRealisticPrompt();
    
    return {
      jobId,
      originalPrompt,
      optimizedPrompt: originalPrompt, // No optimization occurred
      status: 'failed',
      metrics: {
        accuracyImprovement: -3.2, // Accuracy loss
        tokenReduction: -8.5, // Token increase
        costReduction: -0.15, // Cost increase
        processingTime: 8.5,
        apiCallsUsed: 12 // More attempts
      },
      error: {
        code: 'OPTIMIZATION_FAILED',
        message: 'Unable to improve prompt quality',
        details: {
          reason: 'Semantic similarity check failed',
          attempts: 5
        }
      },
      createdAt: new Date('2025-08-26T19:00:00Z'),
      completedAt: new Date('2025-08-26T19:08:30Z')
    };
  }

  static createBatchResults(templateIds: string[]): OptimizedResult[] {
    return templateIds.map((id, index) => {
      // Mix success and failure results
      if (index % 5 === 0) {
        return this.createFailedOptimizationResult(id);
      } else if (index % 3 === 0) {
        return this.createPartialSuccessResult(id);
      } else {
        return this.createSuccessfulResult(id);
      }
    });
  }
}

/**
 * Factory for creating PromptWizard API response mocks
 */
export class PromptWizardResponseFactory {
  static createOptimizedResult(jobId: string = 'job-123'): OptimizedResult {
    return {
      jobId,
      originalPrompt: 'You are a helpful assistant. Please provide detailed assistance.',
      optimizedPrompt: 'Provide detailed assistance as a helpful assistant.',
      status: 'completed',
      metrics: {
        accuracyImprovement: 12,
        tokenReduction: 18,
        costReduction: 0.12,
        processingTime: 3.2,
        apiCallsUsed: 4
      },
      examples: [
        {
          input: 'Help me with a task',
          output: 'I\'ll help you with that task. What specifically do you need assistance with?'
        }
      ],
      reasoning: [
        'Identified redundant phrasing in original prompt',
        'Simplified structure while maintaining meaning',
        'Reduced token count by 18% through optimization'
      ],
      createdAt: new Date(),
      completedAt: new Date()
    };
  }

  static createProcessingResult(jobId: string = 'job-processing'): OptimizedResult {
    return {
      jobId,
      originalPrompt: 'Processing template...',
      optimizedPrompt: '',
      status: 'processing',
      metrics: {
        accuracyImprovement: 0,
        tokenReduction: 0,
        costReduction: 0,
        processingTime: 0,
        apiCallsUsed: 2
      },
      createdAt: new Date()
    };
  }

  static createQualityScore(overall: number = 0.85): QualityScore {
    return {
      overall,
      metrics: {
        clarity: overall + 0.05,
        taskAlignment: overall - 0.03,
        tokenEfficiency: overall + 0.02,
        exampleQuality: overall - 0.01
      },
      suggestions: [
        'Consider adding more specific task context',
        'Optimize for target model capabilities'
      ],
      confidence: overall * 0.9
    };
  }

  static createPromptComparison(): PromptComparison {
    const originalScore = this.createQualityScore(0.75);
    const optimizedScore = this.createQualityScore(0.87);
    
    return {
      comparisonId: `comp-${Date.now()}`,
      original: {
        prompt: 'You are a helpful assistant. Please provide detailed assistance.',
        score: originalScore,
        estimatedTokens: 42,
        estimatedCost: 0.001
      },
      optimized: {
        prompt: 'Provide detailed assistance as a helpful assistant.',
        score: optimizedScore,
        estimatedTokens: 36,
        estimatedCost: 0.0008
      },
      improvements: {
        qualityImprovement: 0.12,
        tokenReduction: 6,
        costSavings: 0.0002
      },
      analysis: {
        strengthsGained: ['Clearer instruction structure', 'Reduced redundancy'],
        potentialRisks: ['Slightly less formal tone'],
        recommendations: ['Test with target audience', 'Monitor performance metrics']
      }
    };
  }

  static createOptimizationJob(jobId: string = 'job-test'): OptimizationJob {
    return {
      jobId,
      status: 'processing',
      progress: 60,
      currentStep: 'refining_output',
      estimatedCompletion: new Date(Date.now() + 120000),
      config: OptimizationConfigFactory.createBasicConfig(),
      result: undefined,
      error: undefined
    };
  }
}

/**
 * Mock data factory for various test scenarios
 */
export class TestDataFactory {
  static createOptimizationRequest(template?: Template): OptimizationRequest {
    const testTemplate = template || TemplateFixtures.createSimpleTemplate();
    
    return {
      templateId: testTemplate.id,
      template: testTemplate,
      config: OptimizationConfigFactory.createBasicConfig(),
      options: {
        priority: 'normal',
        skipCache: false,
        timeoutMs: 30000,
        maxRetries: 3
      }
    };
  }

  static createBatchOptimizationRequest(templateCount: number = 5): BatchOptimizationRequest {
    const templates = TemplateFixtures.createBatchTemplates(templateCount);
    
    return {
      templates: templates.map(template => ({
        id: template.id,
        template
      })),
      config: OptimizationConfigFactory.createBasicConfig(),
      options: {
        priority: 'normal',
        skipCache: false,
        timeoutMs: 60000,
        maxRetries: 2
      }
    };
  }

  static createBatchOptimizationResult(templateIds: string[]): BatchOptimizationResult {
    const results = OptimizationResultFactory.createBatchResults(templateIds);
    const successful = results.filter(r => r.status === 'completed');
    const failed = templateIds.length - successful.length;
    
    return {
      batchId: `batch-${Date.now()}`,
      total: templateIds.length,
      successful: successful.length,
      failed,
      results: successful.map(r => ({
        requestId: r.jobId,
        templateId: templateIds.find(id => r.jobId.includes(id)) || 'unknown',
        originalTemplate: TemplateFixtures.createSimpleTemplate(),
        optimizedTemplate: TemplateFixtures.createSimpleTemplate(),
        metrics: {
          tokenReduction: r.metrics.tokenReduction,
          accuracyImprovement: r.metrics.accuracyImprovement,
          optimizationTime: r.metrics.processingTime * 1000,
          apiCalls: r.metrics.apiCallsUsed
        },
        qualityScore: {
          overall: 0.85,
          confidence: 0.9
        },
        comparison: {
          improvements: {
            'Token reduction': `${r.metrics.tokenReduction}%`,
            'Quality improvement': 'Significant'
          },
          metrics: {
            originalTokens: 100,
            optimizedTokens: 100 - r.metrics.tokenReduction,
            readabilityImprovement: 0.1
          }
        },
        timestamp: r.createdAt
      })),
      errors: Array.from({ length: failed }, (_, i) => ({
        templateId: `failed-template-${i}`,
        error: 'Optimization failed: Template complexity too high'
      })),
      timestamp: new Date()
    };
  }

  static createLoadTestTemplates(count: number): Template[] {
    const categories = [
      TemplateCategory.SIMPLE,
      TemplateCategory.COMPLEX,
      TemplateCategory.CODING,
      TemplateCategory.ANALYSIS
    ];
    
    const templates: Template[] = [];
    
    for (let i = 0; i < count; i++) {
      const category = categories[i % categories.length];
      const template = TemplateFixtures.getTemplateByCategory(category, `load-test-${i}`);
      templates.push(template);
    }
    
    return templates;
  }

  static createPerformanceScenarios(): Array<{
    name: string;
    template: Template;
    config: OptimizationConfig;
    expectedDuration: number;
    expectedQuality: number;
  }> {
    return [
      {
        name: 'Simple Template - Fast Processing',
        template: TemplateFixtures.createSimpleTemplate('perf-simple'),
        config: OptimizationConfigFactory.createMinimalConfig(),
        expectedDuration: 1000,
        expectedQuality: 0.7
      },
      {
        name: 'Complex Template - Standard Processing',
        template: TemplateFixtures.createComplexTemplate('perf-complex'),
        config: OptimizationConfigFactory.createBasicConfig(),
        expectedDuration: 3000,
        expectedQuality: 0.85
      },
      {
        name: 'Technical Template - Advanced Processing',
        template: TemplateFixtures.createCodingTemplate('perf-coding'),
        config: OptimizationConfigFactory.createAdvancedConfig(),
        expectedDuration: 5000,
        expectedQuality: 0.9
      }
    ];
  }
}

/**
 * Export all fixtures and factories
 */
export {
  TemplateFixtures,
  OptimizationConfigFactory,
  OptimizationResultFactory,
  PromptWizardResponseFactory,
  TestDataFactory
};

/**
 * Convenience function to get all available fixture categories
 */
export function getAvailableCategories(): TemplateCategory[] {
  return Object.values(TemplateCategory);
}

/**
 * Utility function to create randomized test data
 */
export function createRandomizedTestData(seed: number = Date.now()): {
  templates: Template[];
  configs: OptimizationConfig[];
  results: OptimizedResult[];
} {
  // Simple pseudo-random generator for consistent test data
  const random = (seed: number) => {
    const a = 1664525;
    const c = 1013904223;
    const m = 2 ** 32;
    seed = (a * seed + c) % m;
    return seed / m;
  };

  let currentSeed = seed;
  const nextRandom = () => {
    currentSeed = Math.floor(random(currentSeed) * 1000000);
    return random(currentSeed);
  };

  const categories = getAvailableCategories();
  const templateCount = Math.floor(nextRandom() * 10) + 5; // 5-15 templates
  
  const templates: Template[] = [];
  const configs: OptimizationConfig[] = [];
  const results: OptimizationResult[] = [];
  
  for (let i = 0; i < templateCount; i++) {
    const category = categories[Math.floor(nextRandom() * categories.length)];
    const template = TemplateFixtures.getTemplateByCategory(category, `random-${i}`);
    templates.push(template);
    
    const configType = nextRandom();
    let config: OptimizationConfig;
    if (configType < 0.33) {
      config = OptimizationConfigFactory.createMinimalConfig();
    } else if (configType < 0.66) {
      config = OptimizationConfigFactory.createBasicConfig();
    } else {
      config = OptimizationConfigFactory.createAdvancedConfig();
    }
    configs.push(config);
    
    const resultType = nextRandom();
    let result: OptimizedResult;
    if (resultType < 0.1) {
      result = OptimizationResultFactory.createFailedOptimizationResult(template.id || `template-${i}`);
    } else if (resultType < 0.3) {
      result = OptimizationResultFactory.createPartialSuccessResult(template.id || `template-${i}`);
    } else {
      result = OptimizationResultFactory.createSuccessfulResult(template.id || `template-${i}`);
    }
    results.push(result);
  }
  
  return { templates, configs, results };
}