/**
 * @fileoverview AI enhancement command for improving existing templates
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Template enhancement, AI-powered improvements, optimization
 * Main APIs: execute(), enhanceTemplate(), suggestImprovements()
 * Constraints: Requires AI provider API key, existing templates
 * Patterns: AI integration, template analysis, enhancement suggestions
 */

import { BaseCommand } from '../../../src/cli/base-command';
import { ICommand } from '../../../src/cli/command-registry';
import * as fs from 'fs/promises';
import * as path from 'path';

export class AIEnhanceCommand extends BaseCommand implements ICommand {
  name = 'ai-enhance';
  description = 'Enhance existing templates using AI suggestions';
  aliases = ['enhance', 'ai-improve'];
  
  options = [
    {
      flags: '-t, --template <name>',
      description: 'Template to enhance'
    },
    {
      flags: '--provider <provider>',
      description: 'AI provider (openai, anthropic)',
      defaultValue: 'openai'
    },
    {
      flags: '--aspect <aspect>',
      description: 'Enhancement aspect (readability, structure, variables, all)',
      defaultValue: 'all'
    },
    {
      flags: '--apply',
      description: 'Apply enhancements automatically',
      defaultValue: false
    },
    {
      flags: '--backup',
      description: 'Create backup before applying changes',
      defaultValue: true
    }
  ];

  async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options);
  }

  async execute(_args: string, options: Record<string, unknown>): Promise<void> {
    try {
      this.info('Analyzing template for AI enhancements...');
      
      if (!options.template) {
        this.error('Template name is required. Use -t or --template');
        return;
      }

      const templatePath = await this.findTemplate(options.template);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      
      const enhancements = await this.generateEnhancements(templateContent, options);
      
      if (options.apply) {
        await this.applyEnhancements(templatePath, templateContent, enhancements, options);
      } else {
        this.displayEnhancements(enhancements);
      }
      
      this.success('Template enhancement analysis completed!');
    } catch (error) {
      this.error(`Failed to enhance template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async findTemplate(templateName: string): Promise<string> {
    const possiblePaths = [
      path.join(process.cwd(), 'templates', `${templateName}.md`),
      path.join(process.cwd(), '.cursor-prompt', 'templates', `${templateName}.md`),
      path.join(__dirname, '..', '..', '..', 'templates', `${templateName}.md`)
    ];

    for (const templatePath of possiblePaths) {
      try {
        await fs.access(templatePath);
        return templatePath;
      } catch {
        continue;
      }
    }

    throw new Error(`Template not found: ${templateName}`);
  }

  private async generateEnhancements(template: string, options: Record<string, unknown>): Promise<TemplateEnhancement[]> {
    const prompt = this.buildEnhancementPrompt(template, options.aspect);
    
    try {
      const response = await this.callAIProvider(prompt, options.provider);
      return this.parseEnhancements(response);
    } catch (error) {
      this.warn('AI provider unavailable, using rule-based enhancements');
      return this.generateRuleBasedEnhancements(template, options.aspect);
    }
  }

  private buildEnhancementPrompt(template: string, aspect: string): string {
    const aspectInstructions = {
      readability: 'Focus on improving readability, clarity, and documentation',
      structure: 'Focus on template structure, organization, and flow',
      variables: 'Focus on template variables, placeholders, and dynamic content',
      all: 'Provide comprehensive enhancements across all aspects'
    };

    return `Analyze the following template and suggest enhancements:

Template:
\`\`\`
${template}
\`\`\`

Enhancement Focus: ${aspectInstructions[aspect as keyof typeof aspectInstructions] || aspectInstructions.all}

Please provide specific suggestions for improving this template. Consider:
1. Template structure and organization
2. Variable naming and usage
3. Documentation and comments
4. Conditional logic and includes
5. User experience and clarity

Format your response as a JSON array of enhancement suggestions:
{
  "enhancements": [
    {
      "type": "structure|readability|variables|documentation",
      "priority": "high|medium|low",
      "description": "What needs to be improved",
      "suggestion": "Specific improvement suggestion",
      "before": "Current code/text (if applicable)",
      "after": "Improved code/text (if applicable)",
      "reason": "Why this improvement is beneficial"
    }
  ]
}`;
  }

  private async callAIProvider(prompt: string, provider: string): Promise<string> {
    switch (provider) {
      case 'openai':
        return this.callOpenAI(prompt);
      case 'anthropic':
        return this.callAnthropic(prompt);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    try {
      const { OpenAI } = await import('openai');
      const apiKey = process.env['OPENAI_API_KEY'];
      
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable not set');
      }

      const openai = new OpenAI({ apiKey });
      
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      throw new Error(`OpenAI API call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async callAnthropic(prompt: string): Promise<string> {
    try {
      const { Anthropic } = await import('@anthropic-ai/sdk');
      const apiKey = process.env['ANTHROPIC_API_KEY'];
      
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable not set');
      }

      const anthropic = new Anthropic({ apiKey });
      
      const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });

      return response.content[0]?.type === 'text' ? response.content[0].text : '';
    } catch (error) {
      throw new Error(`Anthropic API call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseEnhancements(response: string): TemplateEnhancement[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.enhancements || [];
    } catch {
      return this.extractEnhancementsFromText(response);
    }
  }

  private extractEnhancementsFromText(text: string): TemplateEnhancement[] {
    const enhancements: TemplateEnhancement[] = [];
    const lines = text.split('\n');
    
    let currentEnhancement: Partial<TemplateEnhancement> = {};
    
    for (const line of lines) {
      if (line.includes('Enhancement:') || line.includes('Suggestion:')) {
        if (currentEnhancement.description) {
          enhancements.push(currentEnhancement as TemplateEnhancement);
          currentEnhancement = {};
        }
        currentEnhancement.description = line.split(':')[1]?.trim();
        currentEnhancement.type = 'readability';
        currentEnhancement.priority = 'medium';
      } else if (line.includes('Reason:')) {
        currentEnhancement.reason = line.split(':')[1]?.trim();
      }
    }
    
    if (currentEnhancement.description) {
      enhancements.push(currentEnhancement as TemplateEnhancement);
    }
    
    return enhancements;
  }

  private generateRuleBasedEnhancements(template: string, aspect: string): TemplateEnhancement[] {
    const enhancements: TemplateEnhancement[] = [];
    
    // Check for common template issues
    if (!template.includes('{{') && !template.includes('#{')) {
      enhancements.push({
        type: 'variables',
        priority: 'medium',
        description: 'Template lacks dynamic variables',
        suggestion: 'Add template variables for dynamic content generation',
        reason: 'Variables make templates reusable and flexible'
      });
    }
    
    if (!template.includes('#')) {
      enhancements.push({
        type: 'structure',
        priority: 'low',
        description: 'Template lacks markdown headers',
        suggestion: 'Add structure with markdown headers',
        reason: 'Headers improve readability and organization'
      });
    }
    
    if (template.length < 50) {
      enhancements.push({
        type: 'documentation',
        priority: 'medium',
        description: 'Template is very short',
        suggestion: 'Add more comprehensive content and documentation',
        reason: 'Detailed templates provide better guidance'
      });
    }
    
    if (!template.includes('<!--') && !template.includes('/*')) {
      enhancements.push({
        type: 'documentation',
        priority: 'low',
        description: 'Template lacks comments',
        suggestion: 'Add comments to explain template sections',
        reason: 'Comments help users understand template purpose and usage'
      });
    }
    
    return enhancements;
  }

  private async applyEnhancements(
    templatePath: string, 
    originalContent: string, 
    enhancements: TemplateEnhancement[], 
    options: Record<string, unknown>
  ): Promise<void> {
    if (options.backup) {
      const backupPath = `${templatePath}.backup.${Date.now()}`;
      await fs.writeFile(backupPath, originalContent, 'utf8');
      this.info(`Backup created: ${backupPath}`);
    }

    let enhancedContent = originalContent;
    
    for (const enhancement of enhancements) {
      if (enhancement.before && enhancement.after) {
        enhancedContent = enhancedContent.replace(enhancement.before, enhancement.after);
      }
    }
    
    await fs.writeFile(templatePath, enhancedContent, 'utf8');
    this.success(`Applied ${enhancements.length} enhancements to template`);
  }

  private displayEnhancements(enhancements: TemplateEnhancement[]): void {
    if (enhancements.length === 0) {
      this.warn('No enhancements suggested');
      return;
    }
    
    console.log('\n🔧 Template Enhancement Suggestions:\n');
    
    enhancements.forEach((enhancement, index) => {
      const priority = enhancement.priority === 'high' ? '🔥' : 
                     enhancement.priority === 'medium' ? '⚡' : '💡';
      
      console.log(`${index + 1}. ${priority} ${enhancement.type.toUpperCase()}: ${enhancement.description}`);
      console.log(`   💡 ${enhancement.suggestion}`);
      console.log(`   🎯 ${enhancement.reason}`);
      
      if (enhancement.before && enhancement.after) {
        console.log(`   📝 Before: "${enhancement.before}"`);
        console.log(`   ✨ After: "${enhancement.after}"`);
      }
      
      console.log();
    });
    
    console.log('💡 Use --apply flag to automatically apply these enhancements');
  }
}

// Type definitions
interface TemplateEnhancement {
  type: 'structure' | 'readability' | 'variables' | 'documentation';
  priority: 'high' | 'medium' | 'low';
  description: string;
  suggestion: string;
  before?: string;
  after?: string;
  reason: string;
}

export default new AIEnhanceCommand();