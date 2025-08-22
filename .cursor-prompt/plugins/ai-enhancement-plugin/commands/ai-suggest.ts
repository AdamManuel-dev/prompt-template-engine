/**
 * @fileoverview AI suggestion command for template recommendations
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: AI-powered template suggestions, context analysis
 * Main APIs: execute(), generateSuggestions(), analyzeContext()
 * Constraints: Requires AI provider API key, context analysis
 * Patterns: AI integration, template recommendation, context analysis
 */

import { BaseCommand } from '../../../src/cli/base-command';
import { ICommand } from '../../../src/cli/command-registry';
import * as fs from 'fs/promises';
import * as path from 'path';

export class AISuggestCommand extends BaseCommand implements ICommand {
  name = 'ai-suggest';
  description = 'Get AI-powered template suggestions based on context';
  aliases = ['suggest', 'ai-rec'];
  
  options = [
    {
      flags: '--context <type>',
      description: 'Context type (git, file, project, cursor)',
      defaultValue: 'project'
    },
    {
      flags: '--provider <provider>',
      description: 'AI provider (openai, anthropic, local)',
      defaultValue: 'openai'
    },
    {
      flags: '--model <model>',
      description: 'AI model to use'
    },
    {
      flags: '--max-suggestions <count>',
      description: 'Maximum number of suggestions',
      defaultValue: 5
    },
    {
      flags: '--include-examples',
      description: 'Include example templates in suggestions',
      defaultValue: false
    }
  ];

  async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options);
  }

  async execute(_args: string, options: any): Promise<void> {
    try {
      this.info('Analyzing context and generating AI suggestions...');
      
      const context = await this.gatherContext(options.context);
      const suggestions = await this.generateSuggestions(context, options);
      
      this.displaySuggestions(suggestions);
      this.success('AI suggestions generated successfully!');
    } catch (error) {
      this.error(`Failed to generate suggestions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async gatherContext(contextType: string): Promise<ProjectContext> {
    const context: ProjectContext = {
      type: contextType,
      files: [],
      git: null,
      project: null,
      cursor: null
    };

    switch (contextType) {
      case 'git':
        context.git = await this.gatherGitContext();
        break;
      case 'file':
        context.files = await this.gatherFileContext();
        break;
      case 'cursor':
        context.cursor = await this.gatherCursorContext();
        break;
      case 'project':
      default:
        context.project = await this.gatherProjectContext();
        context.git = await this.gatherGitContext();
        context.files = await this.gatherRecentFiles();
        break;
    }

    return context;
  }

  private async gatherProjectContext(): Promise<ProjectInfo> {
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      return {
        name: packageJson.name || path.basename(process.cwd()),
        description: packageJson.description || '',
        type: this.detectProjectType(packageJson),
        dependencies: Object.keys(packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {}),
        scripts: Object.keys(packageJson.scripts || {}),
        framework: this.detectFramework(packageJson)
      };
    } catch {
      return {
        name: path.basename(process.cwd()),
        description: '',
        type: 'unknown',
        dependencies: [],
        devDependencies: [],
        scripts: [],
        framework: 'none'
      };
    }
  }

  private async gatherGitContext(): Promise<GitInfo | null> {
    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit();
      
      const isRepo = await git.checkIsRepo();
      if (!isRepo) return null;

      const branch = await git.branch(['-v']);
      const status = await git.status();
      const log = await git.log({ maxCount: 3 });

      return {
        branch: branch.current,
        clean: status.isClean(),
        recentCommits: log.all.map((commit: any) => ({
          message: commit.message,
          author: commit.author_name
        })),
        modifiedFiles: status.modified,
        stagedFiles: status.staged
      };
    } catch {
      return null;
    }
  }

  private async gatherFileContext(): Promise<FileInfo[]> {
    // Get recently modified files
    return this.gatherRecentFiles();
  }

  private async gatherRecentFiles(): Promise<FileInfo[]> {
    try {
      const files = await fs.readdir(process.cwd(), { recursive: true });
      const fileStats = await Promise.all(
        files.slice(0, 20).map(async (file) => {
          try {
            const filePath = path.join(process.cwd(), file.toString());
            const stats = await fs.stat(filePath);
            return {
              path: file.toString(),
              size: stats.size,
              modified: stats.mtime,
              type: path.extname(file.toString()),
              isDirectory: stats.isDirectory()
            };
          } catch {
            return null;
          }
        })
      );

      return fileStats
        .filter((file): file is FileInfo => file !== null && !file.isDirectory)
        .sort((a, b) => b.modified.getTime() - a.modified.getTime())
        .slice(0, 10);
    } catch {
      return [];
    }
  }

  private async gatherCursorContext(): Promise<CursorInfo | null> {
    // This would integrate with Cursor IDE if available
    // For now, return null as it requires deeper integration
    return null;
  }

  private detectProjectType(packageJson: any): string {
    if (packageJson.dependencies?.react) return 'react';
    if (packageJson.dependencies?.vue) return 'vue';
    if (packageJson.dependencies?.angular) return 'angular';
    if (packageJson.dependencies?.express) return 'node-api';
    if (packageJson.dependencies?.next) return 'nextjs';
    if (packageJson.type === 'module') return 'esm';
    return 'node';
  }

  private detectFramework(packageJson: any): string {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.react) return 'React';
    if (deps.vue) return 'Vue';
    if (deps.angular) return 'Angular';
    if (deps.svelte) return 'Svelte';
    if (deps.express) return 'Express';
    if (deps.fastify) return 'Fastify';
    if (deps.nest) return 'NestJS';
    if (deps.next) return 'Next.js';
    if (deps.nuxt) return 'Nuxt.js';
    
    return 'none';
  }

  private async generateSuggestions(context: ProjectContext, options: any): Promise<TemplateSuggestion[]> {
    const prompt = this.buildSuggestionPrompt(context, options);
    
    try {
      const response = await this.callAIProvider(prompt, options.provider, options.model);
      return this.parseSuggestions(response);
    } catch (error) {
      // Fallback to rule-based suggestions
      this.warn('AI provider unavailable, using rule-based suggestions');
      return this.generateRuleBasedSuggestions(context);
    }
  }

  private buildSuggestionPrompt(context: ProjectContext, options: any): string {
    return `Based on the following project context, suggest ${options.maxSuggestions} useful templates for development:

Project Context:
${JSON.stringify(context, null, 2)}

Please suggest templates that would be most helpful for this project. Consider:
1. Project type and framework
2. Current git status and recent commits
3. File structure and recent changes
4. Development workflow needs

Format your response as a JSON array of template suggestions with:
- name: Template name
- description: What the template does
- useCase: When to use it
- priority: high/medium/low
- category: The template category
- variables: Required template variables

Response format:
{
  "suggestions": [
    {
      "name": "feature-branch-pr",
      "description": "Template for creating feature branch pull requests",
      "useCase": "When creating a new feature branch and preparing for PR",
      "priority": "high",
      "category": "git",
      "variables": ["featureName", "description", "jiraTicket"]
    }
  ]
}`;
  }

  private async callAIProvider(prompt: string, provider: string, model?: string): Promise<string> {
    switch (provider) {
      case 'openai':
        return this.callOpenAI(prompt, model);
      case 'anthropic':
        return this.callAnthropic(prompt, model);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  private async callOpenAI(prompt: string, model?: string): Promise<string> {
    try {
      const { OpenAI } = await import('openai');
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable not set');
      }

      const openai = new OpenAI({ apiKey });
      
      const response = await openai.chat.completions.create({
        model: model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1500
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      throw new Error(`OpenAI API call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async callAnthropic(prompt: string, model?: string): Promise<string> {
    try {
      const { Anthropic } = await import('@anthropic-ai/sdk');
      const apiKey = process.env.ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable not set');
      }

      const anthropic = new Anthropic({ apiKey });
      
      const response = await anthropic.messages.create({
        model: model || 'claude-3-sonnet-20240229',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      });

      return response.content[0]?.type === 'text' ? response.content[0].text : '';
    } catch (error) {
      throw new Error(`Anthropic API call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseSuggestions(response: string): TemplateSuggestion[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.suggestions || [];
    } catch {
      // Try to extract suggestions from text response
      return this.extractSuggestionsFromText(response);
    }
  }

  private extractSuggestionsFromText(text: string): TemplateSuggestion[] {
    // Basic text parsing for fallback
    const suggestions: TemplateSuggestion[] = [];
    const lines = text.split('\n');
    
    let currentSuggestion: Partial<TemplateSuggestion> = {};
    
    for (const line of lines) {
      if (line.includes('Template:') || line.includes('Name:')) {
        if (currentSuggestion.name) {
          suggestions.push(currentSuggestion as TemplateSuggestion);
          currentSuggestion = {};
        }
        currentSuggestion.name = line.split(':')[1]?.trim();
      } else if (line.includes('Description:')) {
        currentSuggestion.description = line.split(':')[1]?.trim();
      } else if (line.includes('Use Case:')) {
        currentSuggestion.useCase = line.split(':')[1]?.trim();
      }
    }
    
    if (currentSuggestion.name) {
      suggestions.push(currentSuggestion as TemplateSuggestion);
    }
    
    return suggestions;
  }

  private generateRuleBasedSuggestions(context: ProjectContext): TemplateSuggestion[] {
    const suggestions: TemplateSuggestion[] = [];
    
    // Git-based suggestions
    if (context.git) {
      if (!context.git.clean) {
        suggestions.push({
          name: 'commit-message',
          description: 'Generate conventional commit messages',
          useCase: 'When committing changes with proper formatting',
          priority: 'high',
          category: 'git',
          variables: ['type', 'scope', 'description']
        });
      }
      
      if (context.git.branch !== 'main' && context.git.branch !== 'master') {
        suggestions.push({
          name: 'pull-request',
          description: 'Create comprehensive pull request template',
          useCase: 'When preparing to merge feature branch',
          priority: 'high',
          category: 'git',
          variables: ['title', 'description', 'changes', 'testing']
        });
      }
    }
    
    // Project-based suggestions
    if (context.project) {
      if (context.project.framework === 'React') {
        suggestions.push({
          name: 'react-component',
          description: 'Create new React component with TypeScript',
          useCase: 'When adding new UI components',
          priority: 'medium',
          category: 'code',
          variables: ['componentName', 'props', 'hasState']
        });
      }
      
      if (context.project.type === 'node-api') {
        suggestions.push({
          name: 'api-endpoint',
          description: 'Create REST API endpoint with documentation',
          useCase: 'When adding new API endpoints',
          priority: 'medium',
          category: 'code',
          variables: ['method', 'path', 'description', 'parameters']
        });
      }
    }
    
    // Always useful suggestions
    suggestions.push({
      name: 'bug-report',
      description: 'Create detailed bug report template',
      useCase: 'When documenting issues or bugs',
      priority: 'low',
      category: 'documentation',
      variables: ['title', 'description', 'steps', 'expected', 'actual']
    });
    
    return suggestions.slice(0, 5);
  }

  private displaySuggestions(suggestions: TemplateSuggestion[]): void {
    if (suggestions.length === 0) {
      this.warn('No suggestions generated');
      return;
    }
    
    console.log('\n🤖 AI Template Suggestions:\n');
    
    suggestions.forEach((suggestion, index) => {
      const priority = suggestion.priority === 'high' ? '🔥' : 
                     suggestion.priority === 'medium' ? '⚡' : '💡';
      
      console.log(`${index + 1}. ${priority} ${suggestion.name}`);
      console.log(`   📝 ${suggestion.description}`);
      console.log(`   🎯 ${suggestion.useCase}`);
      console.log(`   📂 Category: ${suggestion.category}`);
      
      if (suggestion.variables?.length > 0) {
        console.log(`   🔧 Variables: ${suggestion.variables.join(', ')}`);
      }
      
      console.log();
    });
    
    console.log('💡 Use "cursor-prompt generate <template-name>" to create these templates');
  }
}

// Type definitions
interface ProjectContext {
  type: string;
  files: FileInfo[];
  git: GitInfo | null;
  project: ProjectInfo | null;
  cursor: CursorInfo | null;
}

interface ProjectInfo {
  name: string;
  description: string;
  type: string;
  dependencies: string[];
  devDependencies: string[];
  scripts: string[];
  framework: string;
}

interface GitInfo {
  branch: string;
  clean: boolean;
  recentCommits: Array<{
    message: string;
    author: string;
  }>;
  modifiedFiles: string[];
  stagedFiles: string[];
}

interface FileInfo {
  path: string;
  size: number;
  modified: Date;
  type: string;
  isDirectory: boolean;
}

interface CursorInfo {
  // Placeholder for Cursor IDE integration
  activeFile?: string;
  selection?: string;
  openFiles?: string[];
}

interface TemplateSuggestion {
  name: string;
  description: string;
  useCase: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  variables: string[];
}

export default new AISuggestCommand();