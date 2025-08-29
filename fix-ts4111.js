#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get all files with TS4111 errors
const { execSync } = require('child_process');

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // This is complex regex replacement for property access patterns
  // We need to handle: obj.property -> obj['property']
  // But be careful not to replace method calls or other patterns
  
  let fixed = content;
  
  // Common patterns for Record<string, unknown> access
  const patterns = [
    // process.env.PROPERTY -> process.env['PROPERTY']
    /process\.env\.(\w+)/g,
    // options.property (when options is Record<string, unknown>)
    /\b(options|config|templateObj|variable|fileObj|commandObj|filters|data|obj)\.(\w+)/g,
    // Other generic patterns
    /\b(\w+Obj)\.(\w+)/g,
  ];
  
  for (const pattern of patterns) {
    if (pattern.source.includes('process.env')) {
      fixed = fixed.replace(pattern, "process.env['$1']");
    } else {
      fixed = fixed.replace(pattern, "$1['$2']");
    }
  }
  
  fs.writeFileSync(filePath, fixed, 'utf8');
  console.log(`Fixed: ${filePath}`);
}

// Files to fix based on TS4111 errors
const filesToFix = [
  'src/analytics/optimization-tracker.ts',
  'src/cli/flags/auto-optimize.ts',
  'src/cli/plugin-loader.ts',
  'src/commands/generate-enhanced.ts',
  'src/commands/list.ts',
  'src/commands/marketplace/author.ts',
  'src/commands/marketplace/author/author-profile.command.ts',
  'src/commands/marketplace/list.ts',
  'src/commands/marketplace/publish.ts',
  'src/commands/marketplace/version.ts',
  'src/commands/validate.ts',
  'src/config/config-manager.ts',
  'src/config/promptwizard.config.ts',
  'src/core/feedback-loop.ts',
  'src/core/optimization-pipeline.ts',
  'src/core/template-validator.ts',
  'src/integrations/cursor-extension-bridge.ts',
  'src/integrations/cursor/context-bridge.ts',
  'src/integrations/promptwizard/client.ts',
  'src/integrations/promptwizard/config-mapper.ts',
  'src/marketplace/api/marketplace.api.ts',
  'src/marketplace/core/author.service.ts',
  'src/marketplace/core/marketplace.service.ts',
  'src/marketplace/core/template.registry.ts',
  'src/marketplace/database/database.factory.ts',
  'src/middleware/auth.middleware.ts',
  'src/middleware/security-headers.middleware.ts',
  'src/middleware/security.middleware.ts',
  'src/optimizers/models/gemini-optimizer.ts',
  'src/optimizers/platforms/anthropic-adapter.ts',
  'src/plugins/plugin-registry.ts',
  'src/plugins/sandbox/enhanced-plugin-sandbox.ts',
  'src/security/audit-logger.service.ts',
  'src/security/authorization-middleware.ts',
  'src/security/cryptographic.service.ts',
  'src/security/index.ts',
  'src/security/jwt-auth.service.ts',
  'src/security/secrets-vault.service.ts',
  'src/security/security-audit.ts',
  'src/security/security-testing.service.ts',
  'src/services/file-context-service.ts',
  'src/services/optimized-template.service.ts',
  'src/services/template.service.ts',
  'src/services/terminal-capture.ts',
  'src/utils/config.ts',
  'src/utils/performance-monitor.ts'
];

for (const file of filesToFix) {
  try {
    fixFile(file);
  } catch (error) {
    console.error(`Error fixing ${file}:`, error.message);
  }
}
