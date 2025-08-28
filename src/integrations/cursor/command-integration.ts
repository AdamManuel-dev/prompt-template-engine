/**
 * @fileoverview Cursor IDE Command Integration
 * @lastmodified 2025-08-23T14:30:00Z
 *
 * Features: Register and manage Cursor command palette commands
 * Main APIs: CursorCommandIntegration class
 * Constraints: Handle VS Code API compatibility
 * Patterns: Command pattern with handlers
 */

import * as vscode from 'vscode';
import { TemplateToRulesConverter } from './template-to-rules-converter';
import { ContextBridge, CursorContext } from './context-bridge';
import { TemplateEngine } from '../../core/template-engine';
import { TemplateService } from '../../services/template.service';
import { logger } from '../../utils/logger';
import type { Template, TemplateVariable } from '../../types';

export interface CommandOptions {
  enableQuickFix?: boolean;
  enableAutoSuggest?: boolean;
  showPreview?: boolean;
  keybindings?: boolean;
}

export interface CommandHandler {
  id: string;
  title: string;
  handler: (...args: unknown[]) => Promise<void>;
  keybinding?: string;
  when?: string;
}

export class CursorCommandIntegration {
  private commands: Map<string, vscode.Disposable> = new Map();

  private converter: TemplateToRulesConverter;

  private bridge: ContextBridge;

  private templateEngine: TemplateEngine;

  private templateService: TemplateService;

  constructor(
    private context: vscode.ExtensionContext,
    private options: CommandOptions = {}
  ) {
    this.converter = new TemplateToRulesConverter();
    this.bridge = new ContextBridge();
    this.templateEngine = new TemplateEngine();
    this.templateService = new TemplateService();
  }

  /**
   * Register all Cursor commands
   */
  async registerCommands(): Promise<void> {
    const handlers = this.getCommandHandlers();

    for (const handler of handlers) {
      await this.registerCommand(handler);
    }

    // Register quick fix provider if enabled
    if (this.options.enableQuickFix) {
      this.registerQuickFixProvider();
    }

    // Register auto-suggest if enabled
    if (this.options.enableAutoSuggest) {
      this.registerAutoSuggest();
    }

    logger.info(`Registered ${handlers.length} Cursor commands`);
  }

  /**
   * Get all command handlers
   */
  private getCommandHandlers(): CommandHandler[] {
    return [
      {
        id: 'cursorPrompt.generate',
        title: 'Cursor Prompt: Generate from Template',
        handler: this.handleGenerateCommand.bind(this),
        keybinding: 'cmd+shift+g',
        when: 'editorTextFocus',
      },
      {
        id: 'cursorPrompt.listTemplates',
        title: 'Cursor Prompt: List Templates',
        handler: this.handleListTemplatesCommand.bind(this),
        keybinding: 'cmd+shift+l',
      },
      {
        id: 'cursorPrompt.syncRules',
        title: 'Cursor Prompt: Sync Templates to Rules',
        handler: this.handleSyncRulesCommand.bind(this),
      },
      {
        id: 'cursorPrompt.configure',
        title: 'Cursor Prompt: Configure',
        handler: this.handleConfigureCommand.bind(this),
      },
      {
        id: 'cursorPrompt.quickFix',
        title: 'Cursor Prompt: Quick Fix with Template',
        handler: this.handleQuickFixCommand.bind(this),
        when: 'editorHasError',
      },
      {
        id: 'cursorPrompt.createTemplate',
        title: 'Cursor Prompt: Create New Template',
        handler: this.handleCreateTemplateCommand.bind(this),
      },
      {
        id: 'cursorPrompt.refreshContext',
        title: 'Cursor Prompt: Refresh Context',
        handler: this.handleRefreshContextCommand.bind(this),
      },
      {
        id: 'cursorPrompt.previewRule',
        title: 'Cursor Prompt: Preview Generated Rule',
        handler: this.handlePreviewRuleCommand.bind(this),
      },
    ];
  }

  /**
   * Register a single command
   */
  private async registerCommand(handler: CommandHandler): Promise<void> {
    const disposable = vscode.commands.registerCommand(
      handler.id,
      async (...args) => {
        try {
          await handler.handler(...args);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Command failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          logger.error(`Command ${handler.id} failed`);
        }
      }
    );

    this.commands.set(handler.id, disposable);
    this.context.subscriptions.push(disposable);

    // Register keybinding if specified
    if (handler.keybinding && this.options.keybindings !== false) {
      await this.registerKeybinding(handler);
    }
  }

  /**
   * Handle generate command
   */
  private async handleGenerateCommand(): Promise<void> {
    // Get current context
    const context = await this.getCurrentContext();
    const bridgedContext = await this.bridge.bridgeContext(context);

    // Get available templates
    const templates = await this.templateService.listTemplates();
    const templateNames = templates.map(t => ({
      label: t.name,
      description: t.description,
      detail: '', // Tags not available in list
    }));

    // Show template picker
    const selected = await vscode.window.showQuickPick(templateNames, {
      placeHolder: 'Select a template to generate prompt',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!selected) return;

    // Get template info
    const templateInfo = templates.find(t => t.name === selected.label);
    if (!templateInfo) return;

    // Load full template
    const template = await this.templateService.loadTemplate(templateInfo.path);

    // Collect variables if needed
    const variables = await this.collectVariables(
      template,
      bridgedContext.variables
    );

    // Generate prompt using template service
    const renderedTemplate = await this.templateService.renderTemplate(
      template,
      {
        ...bridgedContext.variables,
        ...variables,
      }
    );
    const prompt = renderedTemplate.files?.map(f => f.content).join('\n') || '';

    // Show preview if enabled
    if (this.options.showPreview) {
      await this.showPromptPreview(prompt);
    } else {
      // Insert into active editor or copy to clipboard
      await this.insertPrompt(prompt);
    }
  }

  /**
   * Handle list templates command
   */
  private async handleListTemplatesCommand(): Promise<void> {
    const templates = await this.templateService.listTemplates();

    const items = templates.map(template => ({
      label: `$(file-text) ${template.name}`,
      description: template.description,
      detail: `Path: ${template.path}`,
      template,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a template to view details',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selected) {
      await this.showTemplateDetails(selected.template);
    }
  }

  /**
   * Handle sync rules command
   */
  private async handleSyncRulesCommand(): Promise<void> {
    const progressOptions = {
      location: vscode.ProgressLocation.Notification,
      title: 'Syncing templates to Cursor rules',
      cancellable: true,
    };

    await vscode.window.withProgress(
      progressOptions,
      async (progress, token) => {
        progress.report({ increment: 0, message: 'Loading templates...' });

        // Get all templates
        const templates = await this.templateService.listTemplates();
        const total = templates.length;

        for (let i = 0; i < templates.length; i++) {
          if (token.isCancellationRequested) {
            break;
          }

          const template = templates[i];
          progress.report({
            increment: 100 / total,
            message: `Converting ${template.name}...`,
          });

          // Convert and write rule
          const rule = await this.converter.convertTemplate(template);
          await this.converter.writeRule(rule);
        }

        progress.report({ increment: 100, message: 'Sync complete!' });
      }
    );

    vscode.window.showInformationMessage(
      'Templates successfully synced to Cursor rules'
    );
  }

  /**
   * Handle configure command
   */
  private async handleConfigureCommand(): Promise<void> {
    const configOptions = [
      'Open Configuration File',
      'Toggle Quick Fix',
      'Toggle Auto Suggest',
      'Toggle Preview Mode',
      'Reset to Defaults',
    ];

    const selected = await vscode.window.showQuickPick(configOptions, {
      placeHolder: 'Select configuration option',
    });

    switch (selected) {
      case 'Open Configuration File':
        await this.openConfigFile();
        break;
      case 'Toggle Quick Fix':
        this.options.enableQuickFix = !this.options.enableQuickFix;
        vscode.window.showInformationMessage(
          `Quick Fix ${this.options.enableQuickFix ? 'enabled' : 'disabled'}`
        );
        break;
      case 'Toggle Auto Suggest':
        this.options.enableAutoSuggest = !this.options.enableAutoSuggest;
        vscode.window.showInformationMessage(
          `Auto Suggest ${this.options.enableAutoSuggest ? 'enabled' : 'disabled'}`
        );
        break;
      case 'Toggle Preview Mode':
        this.options.showPreview = !this.options.showPreview;
        vscode.window.showInformationMessage(
          `Preview Mode ${this.options.showPreview ? 'enabled' : 'disabled'}`
        );
        break;
      case 'Reset to Defaults':
        await this.resetConfiguration();
        break;
      default:
        // User cancelled or selected an unknown option
        break;
    }
  }

  /**
   * Handle quick fix command
   */
  private async handleQuickFixCommand(): Promise<void> {
    const context = await this.getCurrentContext();

    if (!context.errors || context.errors.length === 0) {
      vscode.window.showInformationMessage('No errors to fix');
      return;
    }

    // Find appropriate template for error
    const error = context.errors[0];
    const errorObj = new Error(error.message);
    errorObj.name = `${error.severity}Error`;
    const errorType = this.categorizeError(errorObj);
    const template = await this.findTemplateForError(errorType);

    if (!template) {
      vscode.window.showWarningMessage(
        'No suitable template found for this error'
      );
      return;
    }

    // Generate fix prompt
    const bridgedContext = await this.bridge.bridgeContext(context);
    const variables = {
      ...bridgedContext.variables,
      error: context.errors[0].message,
      errorFile: context.errors[0].file,
      errorLine: context.errors[0].line,
    };

    const prompt = await this.templateEngine.render(
      template.content || '',
      variables
    );
    await this.insertPrompt(prompt);
  }

  /**
   * Handle create template command
   */
  private async handleCreateTemplateCommand(): Promise<void> {
    // Get template name
    const name = await vscode.window.showInputBox({
      prompt: 'Enter template name',
      placeHolder: 'my-template',
      validateInput: value => {
        if (!value) return 'Name is required';
        if (!/^[a-z0-9-]+$/.test(value)) {
          return 'Name must contain only lowercase letters, numbers, and hyphens';
        }
        return null;
      },
    });

    if (!name) return;

    // Get description
    const description = await vscode.window.showInputBox({
      prompt: 'Enter template description',
      placeHolder: 'Description of what this template does',
    });

    // Create template file
    const templateContent = this.generateTemplateBoilerplate(
      name,
      description || ''
    );
    const uri = vscode.Uri.file(`.cursor/templates/${name}.yaml`);

    await vscode.workspace.fs.writeFile(uri, Buffer.from(templateContent));
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);

    vscode.window.showInformationMessage(
      `Template ${name} created successfully`
    );
  }

  /**
   * Handle refresh context command
   */
  private async handleRefreshContextCommand(): Promise<void> {
    this.bridge.clearCache();
    vscode.window.showInformationMessage('Context cache cleared');
  }

  /**
   * Handle preview rule command
   */
  private async handlePreviewRuleCommand(): Promise<void> {
    const templates = await this.templateService.listTemplates();
    const selected = await vscode.window.showQuickPick(
      templates.map(t => t.name),
      { placeHolder: 'Select template to preview as rule' }
    );

    if (!selected) return;

    const template = templates.find(t => t.name === selected);
    if (!template) return;

    const rule = await this.converter.convertTemplate(template);
    const validation = this.converter.validateRule(rule);

    // Create preview document
    const content =
      `# Rule Preview: ${rule.name}\n\n` +
      `## Validation\n` +
      `Valid: ${validation.valid}\n${
        validation.errors.length > 0
          ? `Errors:\n${validation.errors.map(e => `- ${e}`).join('\n')}\n`
          : ''
      }\n## Frontmatter\n\`\`\`yaml\n${JSON.stringify(rule.frontmatter, null, 2)}\n\`\`\`\n\n` +
      `## Content\n${rule.content}\n\n` +
      `## References\n${rule.references?.map(r => `- ${r}`).join('\n') || 'None'}`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc, { preview: true });
  }

  /**
   * Get current Cursor context
   */
  private async getCurrentContext(): Promise<CursorContext> {
    const activeEditor = vscode.window.activeTextEditor;
    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

    const context: CursorContext = {
      workspaceRoot,
      openFiles: vscode.workspace.textDocuments
        .filter(doc => !doc.isUntitled && doc.uri.scheme === 'file')
        .map(doc => doc.uri.fsPath),
      errors: [],
    };

    if (activeEditor) {
      context.activeFile = activeEditor.document.uri.fsPath;

      if (!activeEditor.selection.isEmpty) {
        context.selection = {
          start: {
            line: activeEditor.selection.start.line,
            character: activeEditor.selection.start.character,
          },
          end: {
            line: activeEditor.selection.end.line,
            character: activeEditor.selection.end.character,
          },
        };
      }

      // Get diagnostics (errors/warnings)
      const diagnostics = vscode.languages.getDiagnostics(
        activeEditor.document.uri
      );
      context.errors = diagnostics.map(d => ({
        file: activeEditor.document.uri.fsPath,
        line: d.range.start.line,
        message: d.message,
        severity:
          d.severity === vscode.DiagnosticSeverity.Error
            ? 'error'
            : d.severity === vscode.DiagnosticSeverity.Warning
              ? 'warning'
              : 'info',
      }));
    }

    // Get git status if available
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (gitExtension) {
        const git = gitExtension.exports.getAPI(1);
        const repo = git.repositories[0];
        if (repo) {
          context.gitStatus = {
            branch: repo.state.HEAD?.name || 'unknown',
            modified: repo.state.workingTreeChanges.map(
              (c: vscode.SourceControlResourceState) => c.resourceUri.fsPath
            ),
            staged: repo.state.indexChanges.map(
              (c: vscode.SourceControlResourceState) => c.resourceUri.fsPath
            ),
            untracked: repo.state.untrackedChanges.map(
              (c: vscode.SourceControlResourceState) => c.resourceUri.fsPath
            ),
          };
        }
      }
    } catch (_error) {
      logger.warn('Failed to get git status');
    }

    return context;
  }

  /**
   * Collect variables from user
   */
  private async collectVariables(
    template: Template,
    existingVars: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const variables: Record<string, unknown> = { ...existingVars };

    if (!template.variables) return variables;

    for (const [key, config] of Object.entries(template.variables)) {
      if (variables[key] !== undefined) continue;

      const varConfig: TemplateVariable | unknown =
        typeof config === 'object' ? config : { default: config };
      const defaultValue =
        (varConfig as TemplateVariable)?.default?.toString() || '';
      const value = await vscode.window.showInputBox({
        prompt: `Enter value for ${key}`,
        placeHolder: defaultValue,
        value: defaultValue,
        ignoreFocusOut: true,
      });

      if (value !== undefined) {
        variables[key] = value;
      }
    }

    return variables;
  }

  /**
   * Insert prompt into editor or clipboard
   */
  private async insertPrompt(prompt: string): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor) {
      // Insert at cursor position
      const position = activeEditor.selection.active;
      await activeEditor.edit(editBuilder => {
        editBuilder.insert(position, prompt);
      });
    } else {
      // Copy to clipboard
      await vscode.env.clipboard.writeText(prompt);
      vscode.window.showInformationMessage('Prompt copied to clipboard');
    }
  }

  /**
   * Show prompt preview
   */
  private async showPromptPreview(prompt: string): Promise<void> {
    const doc = await vscode.workspace.openTextDocument({
      content: prompt,
      language: 'markdown',
    });

    await vscode.window.showTextDocument(doc, {
      preview: true,
      viewColumn: vscode.ViewColumn.Two,
    });

    const action = await vscode.window.showInformationMessage(
      'Prompt generated',
      'Insert',
      'Copy',
      'Cancel'
    );

    switch (action) {
      case 'Insert':
        await this.insertPrompt(prompt);
        break;
      case 'Copy':
        await vscode.env.clipboard.writeText(prompt);
        vscode.window.showInformationMessage('Copied to clipboard');
        break;
      default:
        // User cancelled or selected an unknown action
        break;
    }
  }

  /**
   * Register quick fix provider
   */
  private registerQuickFixProvider(): void {
    const provider = vscode.languages.registerCodeActionsProvider(
      { pattern: '**/*' },
      {
        provideCodeActions: async (
          _document: vscode.TextDocument,
          _range: vscode.Range,
          context: vscode.CodeActionContext
        ) => {
          if (context.diagnostics.length === 0) return [];

          const action = new vscode.CodeAction(
            'Fix with Cursor Prompt Template',
            vscode.CodeActionKind.QuickFix
          );
          action.command = {
            command: 'cursorPrompt.quickFix',
            title: 'Fix with Template',
          };

          return [action];
        },
      }
    );

    this.context.subscriptions.push(provider);
  }

  /**
   * Register auto-suggest provider
   */
  private registerAutoSuggest(): void {
    // Monitor for errors and suggest templates
    vscode.languages.onDidChangeDiagnostics(async event => {
      if (!this.options.enableAutoSuggest) return;

      for (const uri of event.uris) {
        const diagnostics = vscode.languages.getDiagnostics(uri);
        const errors = diagnostics.filter(
          d => d.severity === vscode.DiagnosticSeverity.Error
        );

        if (errors.length > 0) {
          const message = `${errors.length} error(s) detected. Generate fix with template?`;
          const action = await vscode.window.showInformationMessage(
            message,
            'Fix Now',
            'Later'
          );

          if (action === 'Fix Now') {
            await this.handleQuickFixCommand();
          }
        }
      }
    });
  }

  /**
   * Helper methods
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('type') || message.includes('typescript')) {
      return 'type-error';
    }
    if (message.includes('undefined') || message.includes('null')) {
      return 'reference-error';
    }
    if (message.includes('syntax')) {
      return 'syntax-error';
    }
    if (message.includes('import') || message.includes('module')) {
      return 'import-error';
    }

    return 'generic-error';
  }

  private async findTemplateForError(
    errorType: string
  ): Promise<Template | null> {
    const templates = await this.templateService.listTemplates();

    // Look for exact match
    let template = templates.find(t => t.name === `fix-${errorType}`);
    if (template) return template;

    // Look for tagged match (need to load full template to check tags)
    for (const templateInfo of templates) {
      const fullTemplate = await this.templateService.loadTemplate(
        templateInfo.path
      );
      if (fullTemplate.metadata?.tags?.includes(errorType)) {
        template = templateInfo;
        break;
      }
    }
    if (template) return template;

    // Default to bug-fix template
    return templates.find(t => t.name === 'bug-fix') || null;
  }

  private generateTemplateBoilerplate(
    name: string,
    description: string
  ): string {
    return `name: ${name}
version: 1.0.0
description: ${description}
tags:
  - custom
  - ${name}

variables:
  context:
    type: string
    description: Context for the prompt
    required: true

content: |
  # ${name}
  
  ## Context
  {{context}}
  
  ## Task
  [Describe what needs to be done]
  
  ## Requirements
  - [Requirement 1]
  - [Requirement 2]
  
  ## Expected Output
  [Describe expected output]

commands:
  generate: Generate prompt from this template
  
filePatterns:
  - "**/*.ts"
  - "**/*.tsx"

examples:
  - |
    Example usage of this template
`;
  }

  private async openConfigFile(): Promise<void> {
    const configPath = vscode.Uri.file('.cursorprompt.json');
    const doc = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(doc);
  }

  private async resetConfiguration(): Promise<void> {
    this.options = {
      enableQuickFix: true,
      enableAutoSuggest: false,
      showPreview: false,
      keybindings: true,
    };
    vscode.window.showInformationMessage('Configuration reset to defaults');
  }

  private async registerKeybinding(handler: CommandHandler): Promise<void> {
    // Note: Keybindings need to be defined in package.json
    // This is a placeholder for dynamic keybinding registration
    logger.info(
      `Keybinding ${handler.keybinding} registered for ${handler.id}`
    );
  }

  private async showTemplateDetails(template: Template): Promise<void> {
    const details =
      `# ${template.name}\n\n` +
      `**Description:** ${template.description || 'No description'}\n\n` +
      `**Version:** ${template.version || '1.0.0'}\n\n` +
      `**Tags:** ${template.tags?.join(', ') || 'None'}\n\n` +
      `**Variables:**\n${Object.entries(template.variables || {})
        .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
        .join('\n')}\n\n` +
      `**File Patterns:**\n${(template.filePatterns || [])
        .map((p: string) => `- ${p}`)
        .join('\n')}`;

    const doc = await vscode.workspace.openTextDocument({
      content: details,
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc, { preview: true });
  }

  /**
   * Dispose all registered commands
   */
  dispose(): void {
    for (const disposable of this.commands.values()) {
      disposable.dispose();
    }
    this.commands.clear();
  }
}
