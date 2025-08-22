/**
 * @fileoverview AI Enhancement Plugin main entry point
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Plugin initialization, AI command exports, enhancement integration
 * Main APIs: Plugin registration, AI command discovery
 * Constraints: Requires AI provider API keys, plugin system
 * Patterns: Plugin architecture, AI integration, command registration
 */

import AISuggestCommand from './commands/ai-suggest';
import AIEnhanceCommand from './commands/ai-enhance';
import AIOptimizeCommand from './commands/ai-optimize';

export const commands = [
  AISuggestCommand,
  AIEnhanceCommand,
  AIOptimizeCommand
];

export const metadata = {
  name: 'ai-enhancement-plugin',
  version: '1.0.0',
  description: 'Add AI-powered template suggestions and enhancements',
  author: 'Cursor Prompt Template Engine'
};

export default {
  commands,
  metadata
};