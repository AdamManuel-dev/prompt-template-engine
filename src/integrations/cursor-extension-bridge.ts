/**
 * @fileoverview Bridge for Cursor IDE extension communication
 * @lastmodified 2025-08-22T20:45:00Z
 *
 * Features: VSCode extension API bridge, command palette integration
 * Main APIs: CursorExtensionBridge.register(), execute(), getContext()
 * Constraints: Requires Cursor IDE extension to be installed
 * Patterns: Command pattern, extension API wrapper
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { CursorIntegration } from './cursor-ide';

export interface ExtensionCommand {
  command: string;
  title: string;
  category?: string;
  icon?: string;
  enablement?: string;
  when?: string;
}

export interface ExtensionContext {
  extensionPath: string;
  globalState: Map<string, unknown>;
  workspaceState: Map<string, unknown>;
  subscriptions: unknown[];
}

export interface WorkspaceFolder {
  uri: string;
  name: string;
  index: number;
}

// Interface declaration to resolve no-use-before-define
interface ICursorExtensionBridge {
  initialize(): Promise<void>;
  registerCommands(commands: Record<string, ExtensionCommand>): Promise<void>;
  executeCommand(commandId: string, args?: unknown[]): Promise<unknown>;
  getCommands(): ExtensionCommand[];
  isInitialized(): boolean;
}

export class CursorExtensionBridge
  extends EventEmitter
  implements ICursorExtensionBridge
{
  // eslint-disable-next-line no-use-before-define
  private static instance: CursorExtensionBridge;

  private commands: Map<string, ExtensionCommand> = new Map();

  // private context?: ExtensionContext; // Currently unused
  private cursorIntegration: CursorIntegration;

  private initialized = false;

  private constructor() {
    super();
    this.cursorIntegration = CursorIntegration.getInstance();
    this.initialize();
  }

  static getInstance(): CursorExtensionBridge {
    if (!CursorExtensionBridge.instance) {
      CursorExtensionBridge.instance = new CursorExtensionBridge();
    }
    return CursorExtensionBridge.instance as CursorExtensionBridge;
  }

  /**
   * Initialize the extension bridge
   */
  async initialize(): Promise<void> {
    try {
      await this.detectCursorInstallation();
      await this.loadExtensionManifest();
      await this.registerAllCommands();
      this.initialized = true;
      this.emit('initialized');
    } catch (error: unknown) {
      logger.error(
        `Failed to initialize Cursor extension bridge:${String(error)}`
      );
    }
  }

  /**
   * Detect Cursor IDE installation
   */
  private async detectCursorInstallation(): Promise<void> {
    const possiblePaths = [
      // macOS
      '/Applications/Cursor.app',
      path.join(HOME.$2 || '', 'Applications', 'Cursor.app'),
      // Windows
      path.join(LOCALAPPDATA.$2 || '', 'Programs', 'cursor'),
      path.join(PROGRAMFILES.$2 || '', 'Cursor'),
      // Linux
      '/usr/share/cursor',
      '/opt/cursor',
      path.join(HOME.$2 || '', '.local', 'share', 'cursor'),
    ];

    // eslint-disable-next-line no-restricted-syntax
    for (const cursorPath of possiblePaths) {
      if (fs.existsSync(cursorPath)) {
        logger.info(`Cursor IDE detected at: ${cursorPath}`);
        this.emit('cursor:detected', cursorPath);
        return;
      }
    }

    logger.warn('Cursor IDE installation not found');
  }

  /**
   * Load extension manifest
   */
  private async loadExtensionManifest(): Promise<void> {
    const manifestPath = path.join(__dirname, '../../extension/package.json');

    if (!fs.existsSync(manifestPath)) {
      logger.debug('Extension manifest not found, creating default');
      await this.createDefaultManifest();
      return;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      if (manifest.contributes && manifest.contributes.commands) {
        manifest.contributes.commands.forEach((command: ExtensionCommand) => {
          this.commands.set(command.command, command);
        });
      }

      logger.info(`Loaded ${this.commands.size} extension commands`);
    } catch (error: unknown) {
      logger.error(`Failed to load extension manifest:${String(error)}`);
    }
  }

  /**
   * Create default extension manifest
   */
  private async createDefaultManifest(): Promise<void> {
    const manifest = {
      name: 'cursor-prompt-template-engine',
      displayName: 'Cursor Prompt Template Engine',
      description: 'Automated prompt template management for Cursor IDE',
      version: '0.1.0',
      engines: {
        vscode: '^1.74.0',
      },
      categories: ['Other'],
      activationEvents: [
        'onCommand:cursorPrompt.generateTemplate',
        'onCommand:cursorPrompt.applyTemplate',
        'onCommand:cursorPrompt.syncTemplates',
        'onCommand:cursorPrompt.showTemplates',
      ],
      main: './dist/extension.js',
      contributes: {
        commands: [
          {
            command: 'cursorPrompt.generateTemplate',
            title: 'Generate Template',
            category: 'Cursor Prompt',
          },
          {
            command: 'cursorPrompt.applyTemplate',
            title: 'Apply Template',
            category: 'Cursor Prompt',
          },
          {
            command: 'cursorPrompt.syncTemplates',
            title: 'Sync Templates',
            category: 'Cursor Prompt',
          },
          {
            command: 'cursorPrompt.showTemplates',
            title: 'Show Templates',
            category: 'Cursor Prompt',
          },
          {
            command: 'cursorPrompt.configureSettings',
            title: 'Configure Settings',
            category: 'Cursor Prompt',
          },
        ],
        configuration: {
          title: 'Cursor Prompt Template Engine',
          properties: {
            'cursorPrompt.templatesPath': {
              type: 'string',
              default: './templates',
              description: 'Path to templates directory',
            },
            'cursorPrompt.autoSync': {
              type: 'boolean',
              default: false,
              description: 'Automatically sync templates with Cursor',
            },
            'cursorPrompt.syncInterval': {
              type: 'number',
              default: 30,
              description: 'Sync interval in seconds',
            },
          },
        },
        keybindings: [
          {
            command: 'cursorPrompt.generateTemplate',
            key: 'ctrl+shift+g',
            mac: 'cmd+shift+g',
            when: 'editorTextFocus',
          },
          {
            command: 'cursorPrompt.applyTemplate',
            key: 'ctrl+shift+a',
            mac: 'cmd+shift+a',
            when: 'editorTextFocus',
          },
        ],
      },
    };

    const extensionDir = path.join(__dirname, '../../extension');
    if (!fs.existsSync(extensionDir)) {
      fs.mkdirSync(extensionDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(extensionDir, 'package.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Load the created manifest
    manifest.contributes.commands.forEach(command => {
      this.commands.set(command.command, command);
    });
  }

  /**
   * Register commands with Cursor
   */
  public async registerCommands(
    commands?: Record<string, ExtensionCommand>
  ): Promise<void> {
    // If commands provided, add them first
    if (commands) {
      Object.entries(commands).forEach(([id, command]) => {
        this.commands.set(id, command);
      });
    }

    // Then register all commands
    await this.registerAllCommands();
  }

  private async registerAllCommands(): Promise<void> {
    if (!this.cursorIntegration.isConnected()) {
      logger.debug('Cursor not connected, skipping command registration');
      return;
    }

    // Register commands sequentially to avoid conflicts
    // eslint-disable-next-line no-restricted-syntax
    for (const [commandId, command] of this.commands.entries()) {
      // eslint-disable-next-line no-await-in-loop
      await this.registerCommand(commandId, command);
    }
  }

  /**
   * Register a single command
   */
  async registerCommand(
    commandId: string,
    command: ExtensionCommand
  ): Promise<void> {
    this.commands.set(commandId, command);

    // Create command handler
    const handler = this.createCommandHandler(commandId);

    // Register with Cursor if connected
    if (this.cursorIntegration.isConnected()) {
      // This would normally use the VSCode API
      // For now, we'll emit an event
      this.emit('command:registered', { commandId, command, handler });
    }

    logger.debug(`Registered command: ${commandId}`);
  }

  /**
   * Create command handler
   */
  private createCommandHandler(
    commandId: string
  ): (...args: unknown[]) => Promise<void> {
    return async (...args: unknown[]) => {
      try {
        await this.executeCommand(commandId, args);
      } catch (error: unknown) {
        logger.error(`Command ${commandId} failed:${String(error)}`);
        throw error;
      }
    };
  }

  /**
   * Execute a command
   */
  async executeCommand(commandId: string, args?: unknown[]): Promise<unknown> {
    const command = this.commands.get(commandId);

    if (!command) {
      throw new Error(`Command not found: ${commandId}`);
    }

    logger.info(`Executing command: ${commandId}`);
    this.emit('command:executing', { commandId, args });

    try {
      // Handle built-in commands
      switch (commandId) {
        case 'cursorPrompt.generateTemplate':
          return await this.handleGenerateTemplate(args);
        case 'cursorPrompt.applyTemplate':
          return await this.handleApplyTemplate(args);
        case 'cursorPrompt.syncTemplates':
          return await this.handleSyncTemplates();
        case 'cursorPrompt.showTemplates':
          return await this.handleShowTemplates();
        case 'cursorPrompt.configureSettings':
          return await this.handleConfigureSettings();
        default:
          // Custom command handler
          this.emit('command:execute', { commandId, args });
          return undefined;
      }
    } finally {
      this.emit('command:executed', { commandId, args });
    }
  }

  /**
   * Handle generate template command
   */
  private async handleGenerateTemplate(args?: unknown[]): Promise<void> {
    const templateName = args?.[0] as string | undefined;

    if (!templateName) {
      throw new Error('Template name is required');
    }

    // Get current editor content (simulated)
    const content = await this.getEditorContent();

    // Create template
    const template = {
      id: templateName,
      name: templateName,
      content,
      metadata: {
        author: USER.$2 || 'unknown',
        version: '1.0.0',
        description: 'Generated from Cursor IDE',
        tags: ['generated'],
      },
    };

    // Save template
    await this.cursorIntegration.updateTemplate(template);

    logger.info(`Generated template: ${templateName}`);
  }

  /**
   * Handle apply template command
   */
  private async handleApplyTemplate(args?: unknown[]): Promise<void> {
    const templateId = args?.[0] as string | undefined;
    const variables = args?.[1] as Record<string, string> | undefined;

    if (!templateId) {
      // Show template picker (simulated)
      const templates = this.cursorIntegration.getTemplates();
      logger.info(
        `Available templates: ${templates.map(t => t.name).join(', ')}`
      );
      return;
    }

    await this.cursorIntegration.inject(templateId, variables);
    logger.info(`Applied template: ${templateId}`);
  }

  /**
   * Handle sync templates command
   */
  private async handleSyncTemplates(): Promise<void> {
    await this.cursorIntegration.sync();
    logger.info('Templates synchronized');
  }

  /**
   * Handle show templates command
   */
  private async handleShowTemplates(): Promise<void> {
    const templates = this.cursorIntegration.getTemplates();

    // This would normally open a view in Cursor
    // For now, we'll just log them
    logger.info('\nAvailable Templates:');
    logger.info('===================');

    templates.forEach(template => {
      logger.info(`\n📄 ${template.name}`);
      if (template.metadata?.description) {
        logger.info(`   ${template.metadata.description}`);
      }
      if (template.metadata?.tags) {
        logger.info(`   Tags: ${template.metadata.tags.join(', ')}`);
      }
    });
  }

  /**
   * Handle configure settings command
   */
  private async handleConfigureSettings(): Promise<void> {
    // This would normally open settings in Cursor
    logger.info('Opening settings...');
    this.emit('settings:open');
  }

  /**
   * Get current editor content (simulated)
   */
  // eslint-disable-next-line class-methods-use-this
  private async getEditorContent(): Promise<string> {
    // In a real implementation, this would get content from the active editor
    // For now, return a placeholder
    return `# Template Content\n\nThis is a template generated from the current editor content.`;
  }

  /**
   * Get workspace folders
   */
  // eslint-disable-next-line class-methods-use-this
  async getWorkspaceFolders(): Promise<WorkspaceFolder[]> {
    // This would normally use the VSCode API
    // For now, return current directory
    return [
      {
        uri: `file://${process.cwd()}`,
        name: path.basename(process.cwd()),
        index: 0,
      },
    ];
  }

  /**
   * Show information message
   */
  // eslint-disable-next-line class-methods-use-this
  showInformationMessage(
    message: string,
    ...actions: string[]
  ): Promise<string | undefined> {
    logger.info(`ℹ️  ${message}`);
    if (actions.length > 0) {
      logger.info(`   Actions: ${actions.join(', ')}`);
    }
    return Promise.resolve(undefined);
  }

  /**
   * Show error message
   */
  // eslint-disable-next-line class-methods-use-this
  showErrorMessage(
    message: string,
    ...actions: string[]
  ): Promise<string | undefined> {
    logger.error(`❌ ${message}`);
    if (actions.length > 0) {
      logger.info(`   Actions: ${actions.join(', ')}`);
    }
    return Promise.resolve(undefined);
  }

  /**
   * Show warning message
   */
  // eslint-disable-next-line class-methods-use-this
  showWarningMessage(
    message: string,
    ...actions: string[]
  ): Promise<string | undefined> {
    logger.warn(message);
    if (actions.length > 0) {
      logger.info(`   Actions: ${actions.join(', ')}`);
    }
    return Promise.resolve(undefined);
  }

  /**
   * Show quick pick
   */
  // eslint-disable-next-line class-methods-use-this
  async showQuickPick<T extends { label: string }>(
    items: T[],
    options?: { placeHolder?: string; canPickMany?: boolean }
  ): Promise<T | T[] | undefined> {
    logger.info(options?.placeHolder || 'Select an item:');
    items.forEach((item, index) => {
      logger.info(`  ${index + 1}. ${item.label}`);
    });

    // In a real implementation, this would show a picker UI
    return undefined;
  }

  /**
   * Show input box
   */
  // eslint-disable-next-line class-methods-use-this
  async showInputBox(options?: {
    prompt?: string;
    placeHolder?: string;
    value?: string;
    validateInput?: (value: string) => string | undefined;
  }): Promise<string | undefined> {
    logger.info(options?.prompt || 'Enter value:');
    if (options?.placeHolder) {
      logger.info(`  Placeholder: ${options.placeHolder}`);
    }

    // In a real implementation, this would show an input UI
    return options?.value;
  }

  /**
   * Get all registered commands
   */
  getCommands(): ExtensionCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
