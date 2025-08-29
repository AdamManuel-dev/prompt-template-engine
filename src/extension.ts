/**
 * @fileoverview VS Code extension entry point for Cursor Prompt Template Engine
 * @lastmodified 2025-08-23T16:05:00Z
 *
 * Features: Extension activation, command registration, integration initialization
 * Main APIs: activate(), deactivate(), registerCommands()
 * Constraints: VS Code extension context, singleton integration
 * Patterns: VS Code extension lifecycle, command pattern, disposable pattern
 */

import * as vscode from 'vscode';
import { CursorIntegration } from './integrations/cursor';
import { CursorCommandIntegration } from './integrations/cursor/command-integration';
import { logger } from './utils/logger';

let integration: CursorIntegration | undefined;
let commandIntegration: CursorCommandIntegration | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Handle configuration changes
 */
async function handleConfigurationChange(): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration('cursorPrompt');

    if (integration) {
      integration.updateConfig({
        autoSync: config.get<boolean>('autoSync', true),
        syncInterval: config.get<number>('syncInterval', 30000),
        rulesOutputDir: config.get<string>('rulesOutputDir', '.cursor/rules'),
        legacySupport: config.get<boolean>('legacySupport', true),
        enableCommands: config.get<boolean>('enableCommands', true),
        enableQuickFix: config.get<boolean>('enableQuickFix', true),
      });

      logger.info('Configuration updated');
      vscode.window.showInformationMessage(
        'Cursor Prompt configuration updated'
      );
    }
  } catch (error: unknown) {
    logger.error('Failed to update configuration');
    vscode.window.showErrorMessage(`Failed to update configuration: ${error}`);
  }
}

/**
 * Extension activation entry point
 */
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    logger.info('Cursor Prompt Template Engine extension activating...');

    // Initialize the Cursor integration
    const config = vscode.workspace.getConfiguration('cursorPrompt');
    integration = CursorIntegration.getInstance({
      autoSync: config.get<boolean>('autoSync', true),
      syncInterval: config.get<number>('syncInterval', 30000),
      rulesOutputDir: config.get<string>('rulesOutputDir', '.cursor/rules'),
      legacySupport: config.get<boolean>('legacySupport', true),
      enableCommands: config.get<boolean>('enableCommands', true),
      enableQuickFix: config.get<boolean>('enableQuickFix', true),
    });

    await integration.initialize(context);

    // Initialize command integration if available
    if (config.get<boolean>('enableCommands', true)) {
      commandIntegration = new CursorCommandIntegration(context);
      await commandIntegration.registerCommands();
    }

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    statusBarItem.text = '$(symbol-misc) Cursor Prompt';
    statusBarItem.tooltip = 'Cursor Prompt Template Engine is active';
    statusBarItem.command = 'cursorPrompt.listTemplates';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Register configuration change listener
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(async e => {
        if (e.affectsConfiguration('cursorPrompt')) {
          await handleConfigurationChange();
        }
      })
    );

    // Register file system watcher for template changes
    const templateWatcher = vscode.workspace.createFileSystemWatcher(
      '**/*.{yaml,yml,json,md}',
      false,
      false,
      false
    );

    context.subscriptions.push(
      templateWatcher.onDidCreate(async uri => {
        logger.debug(`Template file created: ${uri.fsPath}`);
        if (integration && config.get<boolean>('autoSync', true)) {
          await integration.syncTemplates();
        }
      }),
      templateWatcher.onDidChange(async uri => {
        logger.debug(`Template file changed: ${uri.fsPath}`);
        if (integration && config.get<boolean>('autoSync', true)) {
          await integration.syncTemplates();
        }
      }),
      templateWatcher.onDidDelete(async uri => {
        logger.debug(`Template file deleted: ${uri.fsPath}`);
        if (integration && config.get<boolean>('autoSync', true)) {
          await integration.syncTemplates();
        }
      })
    );

    context.subscriptions.push(templateWatcher);

    // Register quick fix provider
    if (config.get<boolean>('enableQuickFix', true)) {
      const quickFixProvider = vscode.languages.registerCodeActionsProvider(
        { scheme: 'file' },
        new CursorPromptQuickFixProvider(),
        {
          providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
        }
      );
      context.subscriptions.push(quickFixProvider);
    }

    // Show activation message
    const message = 'Cursor Prompt Template Engine extension is now active!';
    logger.info(message);
    vscode.window.showInformationMessage(message);

    // Perform initial sync if auto-sync is enabled
    if (config.get<boolean>('autoSync', true)) {
      setTimeout(async () => {
        try {
          await integration?.syncTemplates();
          logger.info('Initial template sync completed');
        } catch (_error) {
          logger.error('Initial sync failed');
        }
      }, 1000);
    }
  } catch (_error) {
    logger.error('Failed to activate extension');
    vscode.window.showErrorMessage(
      `Failed to activate Cursor Prompt Template Engine: ${_error}`
    );
  }
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  try {
    logger.info('Cursor Prompt Template Engine extension deactivating...');

    // Dispose of the integration
    if (integration) {
      integration.dispose();
      integration = undefined;
    }

    // Dispose of command integration
    if (commandIntegration) {
      commandIntegration.dispose();
      commandIntegration = undefined;
    }

    // Dispose of status bar item
    if (statusBarItem) {
      statusBarItem.dispose();
      statusBarItem = undefined;
    }

    logger.info('Extension deactivated successfully');
  } catch (_error) {
    logger.error('Error during deactivation');
  }
}

/**
 * Quick Fix Provider for template suggestions
 */
class CursorPromptQuickFixProvider implements vscode.CodeActionProvider {
  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    const actions: vscode.CodeAction[] = [];

    // Check if there are any diagnostics in the range
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
        const action = new vscode.CodeAction(
          'Fix with Cursor Prompt Template',
          vscode.CodeActionKind.QuickFix
        );

        action.command = {
          command: 'cursorPrompt.quickFix',
          title: 'Apply Template Fix',
          arguments: [document, range, diagnostic],
        };

        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        actions.push(action);
      }
    }

    // Add general template suggestion action
    if (actions.length === 0) {
      const generalAction = new vscode.CodeAction(
        'Generate with Cursor Prompt Template',
        vscode.CodeActionKind.RefactorRewrite
      );

      generalAction.command = {
        command: 'cursorPrompt.generate',
        title: 'Generate from Template',
        arguments: [document, range],
      };

      actions.push(generalAction);
    }

    return actions;
  }
}

// Export a getter function instead of the mutable variable
export function getIntegration(): CursorIntegration | undefined {
  return integration;
}
