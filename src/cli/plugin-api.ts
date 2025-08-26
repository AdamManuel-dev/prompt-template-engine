/**
 * @fileoverview Plugin API for creating cursor-prompt plugins
 * @lastmodified 2025-08-23T02:35:00Z
 *
 * Features: Plugin development API, helpers, utilities
 * Main APIs: PluginAPI, createPlugin(), extensionHelpers
 * Constraints: API stability, backward compatibility
 * Patterns: API design, plugin development utilities
 */

import {
  TemplateProcessor,
  TemplateValidator,
  TemplateTransformer,
  MarketplaceHook,
  ContextProvider,
  FileGenerator,
  PluginLifecycleHooks,
} from './enhanced-plugin-manager';
import { ICommand } from './command-registry';
import { logger } from '../utils/logger';

export interface PluginConfig {
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: Record<string, string>;
}

export interface PluginBuilder {
  config: PluginConfig;
  addCommand(command: ICommand): PluginBuilder;
  addProcessor(processor: TemplateProcessor): PluginBuilder;
  addValidator(validator: TemplateValidator): PluginBuilder;
  addTransformer(transformer: TemplateTransformer): PluginBuilder;
  addMarketplaceHook(hook: MarketplaceHook): PluginBuilder;
  addContextProvider(provider: ContextProvider): PluginBuilder;
  addFileGenerator(generator: FileGenerator): PluginBuilder;
  setLifecycleHooks(hooks: PluginLifecycleHooks): PluginBuilder;
  build(): PluginDefinition;
}

export interface PluginDefinition {
  metadata: PluginConfig;
  commands?: ICommand[];
  processors?: TemplateProcessor[];
  validators?: TemplateValidator[];
  transformers?: TemplateTransformer[];
  marketplaceHooks?: MarketplaceHook[];
  contextProviders?: ContextProvider[];
  fileGenerators?: FileGenerator[];
  lifecycle?: PluginLifecycleHooks;
}

/**
 * Create a new plugin with the builder pattern
 */
export function createPlugin(config: PluginConfig): PluginBuilder {
  return new PluginBuilderImpl(config);
}

class PluginBuilderImpl implements PluginBuilder {
  config: PluginConfig;

  private commands: ICommand[] = [];

  private processors: TemplateProcessor[] = [];

  private validators: TemplateValidator[] = [];

  private transformers: TemplateTransformer[] = [];

  private marketplaceHooks: MarketplaceHook[] = [];

  private contextProviders: ContextProvider[] = [];

  private fileGenerators: FileGenerator[] = [];

  private lifecycle?: PluginLifecycleHooks;

  constructor(config: PluginConfig) {
    this.config = config;
  }

  addCommand(command: ICommand): PluginBuilder {
    this.commands.push(command);
    return this;
  }

  addProcessor(processor: TemplateProcessor): PluginBuilder {
    this.processors.push(processor);
    return this;
  }

  addValidator(validator: TemplateValidator): PluginBuilder {
    this.validators.push(validator);
    return this;
  }

  addTransformer(transformer: TemplateTransformer): PluginBuilder {
    this.transformers.push(transformer);
    return this;
  }

  addMarketplaceHook(hook: MarketplaceHook): PluginBuilder {
    this.marketplaceHooks.push(hook);
    return this;
  }

  addContextProvider(provider: ContextProvider): PluginBuilder {
    this.contextProviders.push(provider);
    return this;
  }

  addFileGenerator(generator: FileGenerator): PluginBuilder {
    this.fileGenerators.push(generator);
    return this;
  }

  setLifecycleHooks(hooks: PluginLifecycleHooks): PluginBuilder {
    this.lifecycle = hooks;
    return this;
  }

  build(): PluginDefinition {
    return {
      metadata: this.config,
      commands: this.commands.length > 0 ? this.commands : undefined,
      processors: this.processors.length > 0 ? this.processors : undefined,
      validators: this.validators.length > 0 ? this.validators : undefined,
      transformers:
        this.transformers.length > 0 ? this.transformers : undefined,
      marketplaceHooks:
        this.marketplaceHooks.length > 0 ? this.marketplaceHooks : undefined,
      contextProviders:
        this.contextProviders.length > 0 ? this.contextProviders : undefined,
      fileGenerators:
        this.fileGenerators.length > 0 ? this.fileGenerators : undefined,
      lifecycle: this.lifecycle,
    };
  }
}

/**
 * Helper utilities for plugin development
 */
export const PluginUtils = {
  /**
   * Create a simple template processor
   */
  createProcessor: (
    name: string,
    description: string,
    processFn: (
      content: string,
      context: Record<string, unknown>
    ) => Promise<string> | string,
    priority?: number
  ): TemplateProcessor => ({
    name,
    description,
    priority,
    async process(
      content: string,
      context: Record<string, unknown>
    ): Promise<string> {
      const result = processFn(content, context);
      return typeof result === 'string' ? result : result;
    },
  }),

  /**
   * Create a simple template validator
   */
  createValidator: (
    name: string,
    description: string,
    validateFn: (
      template: unknown
    ) =>
      | Promise<{ valid: boolean; errors: string[]; warnings?: string[] }>
      | { valid: boolean; errors: string[]; warnings?: string[] }
  ): TemplateValidator => ({
    name,
    description,
    async validate(template: unknown) {
      const result = validateFn(template);
      return result instanceof Promise ? result : result;
    },
  }),

  /**
   * Create a simple context provider
   */
  createContextProvider: (
    name: string,
    description: string,
    providerFn: () =>
      | Promise<Record<string, unknown>>
      | Record<string, unknown>,
    priority?: number
  ): ContextProvider => ({
    name,
    description,
    priority,
    async provideContext() {
      const result = providerFn();
      return typeof result === 'object' && result.then ? result : result;
    },
  }),

  /**
   * Create a simple marketplace hook
   */
  createMarketplaceHook: (
    name: string,
    description: string,
    hooks: Partial<MarketplaceHook>
  ): MarketplaceHook => ({
    name,
    description,
    ...hooks,
  }),

  /**
   * Log from plugin context
   */
  log: {
    info: (pluginName: string, message: string) =>
      logger.info(`[${pluginName}] ${message}`),
    warn: (pluginName: string, message: string) =>
      logger.warn(`[${pluginName}] ${message}`),
    error: (pluginName: string, message: string) =>
      logger.error(`[${pluginName}] ${message}`),
    debug: (pluginName: string, message: string) =>
      logger.debug(`[${pluginName}] ${message}`),
  },
};

/**
 * Plugin development examples and documentation
 */
export const PluginExamples = {
  /**
   * Example: Simple text processor plugin
   */
  simpleProcessor: createPlugin({
    name: 'example-processor',
    version: '1.0.0',
    description: 'Example processor plugin',
    author: 'Plugin Developer',
  })
    .addProcessor(
      PluginUtils.createProcessor(
        'uppercase-processor',
        'Converts template content to uppercase',
        async (content: string) => content.toUpperCase(),
        10 // Priority
      )
    )
    .build(),

  /**
   * Example: Context provider plugin
   */
  contextProvider: createPlugin({
    name: 'git-context-provider',
    version: '1.0.0',
    description: 'Provides Git repository context',
  })
    .addContextProvider(
      PluginUtils.createContextProvider(
        'git-info',
        'Provides current Git branch and commit info',
        async () => {
          try {
            const { execSync } = require('child_process');
            return {
              gitBranch: execSync('git branch --show-current', {
                encoding: 'utf8',
              }).trim(),
              gitCommit: execSync('git rev-parse HEAD', { encoding: 'utf8' })
                .trim()
                .substring(0, 8),
            };
          } catch {
            return { gitBranch: 'unknown', gitCommit: 'unknown' };
          }
        },
        5 // Priority
      )
    )
    .build(),

  /**
   * Example: Marketplace hook plugin
   */
  marketplaceHook: createPlugin({
    name: 'slack-notifier',
    version: '1.0.0',
    description: 'Sends Slack notifications for marketplace events',
  })
    .addMarketplaceHook(
      PluginUtils.createMarketplaceHook(
        'slack-notifications',
        'Sends Slack notifications for template installations',
        {
          async onAfterInstall(templateId: string, _result: unknown) {
            PluginUtils.log.info(
              'slack-notifier',
              `Template ${templateId} was installed`
            );
            // Here you would integrate with Slack API
          },
          async onAfterPublish(templateId: string, _result: unknown) {
            PluginUtils.log.info(
              'slack-notifier',
              `Template ${templateId} was published`
            );
            // Here you would integrate with Slack API
          },
        }
      )
    )
    .build(),
};

/**
 * Export the main API for plugin development
 */
export {
  TemplateProcessor,
  TemplateValidator,
  TemplateTransformer,
  MarketplaceHook,
  ContextProvider,
  FileGenerator,
  PluginLifecycleHooks,
  ICommand,
};
