/**
 * @fileoverview Git Context Plugin main entry point
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Plugin initialization, command exports, git integration
 * Main APIs: Plugin registration, command discovery
 * Constraints: Requires git repository, plugin system
 * Patterns: Plugin architecture, command registration
 */

import GitContextCommand from './commands/git-context';
import GitTemplateCommand from './commands/git-template';

export const commands = [
  GitContextCommand,
  GitTemplateCommand
];

export const metadata = {
  name: 'git-context-plugin',
  version: '1.0.0',
  description: 'Automatically gather git information for templates',
  author: 'Cursor Prompt Template Engine'
};

export default {
  commands,
  metadata
};