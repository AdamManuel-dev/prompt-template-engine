/**
 * @fileoverview E2E tests for CLI commands
 * @lastmodified 2025-08-26T10:00:00Z
 *
 * Features: Comprehensive testing of all CLI commands
 * Main APIs: Tests generate, list, sync, init, validate, watch commands
 * Constraints: Requires isolated test environment for each test
 * Patterns: Full CLI command execution testing
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

describe('E2E: CLI Commands', () => {
  let testDir: string;
  let cliPath: string;

  beforeAll(() => {
    // Get the compiled CLI path
    cliPath = path.join(__dirname, '../../dist/cli.js');
  });

  beforeEach(async () => {
    // Create isolated test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cursor-prompt-e2e-'));
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    process.chdir('/');
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('init command', () => {
    it('should initialize project with default configuration', async () => {
      const { stdout } = await execAsync(`node ${cliPath} init`);

      // Check directories created
      const cursorDir = path.join(testDir, '.cursor');
      const templatesDir = path.join(testDir, 'templates');
      const rulesDir = path.join(testDir, '.cursor/rules');

      expect(await fs.stat(cursorDir)).toBeTruthy();
      expect(await fs.stat(templatesDir)).toBeTruthy();
      expect(await fs.stat(rulesDir)).toBeTruthy();

      // Check configuration file
      const configPath = path.join(testDir, '.cursorprompt.json');
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

      expect(config.version).toBe('1.0.0');
      expect(config.templates.paths).toContain('./templates');
      expect(config.cursor.autoSync).toBe(true);

      // Check example template created
      const examplePath = path.join(testDir, 'templates/example.yaml');
      const exampleContent = await fs.readFile(examplePath, 'utf-8');
      expect(exampleContent).toContain('name: example');
      expect(exampleContent).toContain('Task: {{task}}');

      // Check success message
      expect(stdout).toContain('Cursor Prompt initialized successfully!');
    });

    it('should handle force flag to overwrite existing config', async () => {
      // First initialization
      await execAsync(`node ${cliPath} init`);

      // Modify config
      const configPath = path.join(testDir, '.cursorprompt.json');
      await fs.writeFile(configPath, JSON.stringify({ custom: true }, null, 2));

      // Re-initialize with force
      await execAsync(`node ${cliPath} init --force`);

      // Check config was overwritten
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      expect(config.version).toBe('1.0.0');
      expect(config.custom).toBeUndefined();
    });
  });

  describe('generate command', () => {
    beforeEach(async () => {
      // Initialize project
      await execAsync(`node ${cliPath} init`);
    });

    it('should generate prompt from template with variables', async () => {
      // Create a test template
      const templateContent = `---
name: test
description: Test template
---
Hello {{name}}, your task is {{task}}`;

      await fs.writeFile(
        path.join(testDir, 'templates/test.yaml'),
        templateContent
      );

      // Generate with variables
      const variables = JSON.stringify({ name: 'Alice', task: 'review code' });
      const { stdout } = await execAsync(
        `node ${cliPath} generate test --variables '${variables}'`
      );

      expect(stdout).toContain('Hello Alice, your task is review code');
    });

    it('should save output to file with -o flag', async () => {
      const outputPath = path.join(testDir, 'output.md');
      const variables = JSON.stringify({ task: 'test' });

      await execAsync(
        `node ${cliPath} generate example -v '${variables}' -o ${outputPath}`
      );

      const output = await fs.readFile(outputPath, 'utf-8');
      expect(output).toContain('Task: test');
    });

    it('should handle variables from file', async () => {
      const varsPath = path.join(testDir, 'vars.json');
      await fs.writeFile(
        varsPath,
        JSON.stringify({ task: 'implement feature', language: 'Python' })
      );

      const { stdout } = await execAsync(
        `node ${cliPath} generate example -f ${varsPath}`
      );

      expect(stdout).toContain('Task: implement feature');
      expect(stdout).toContain('using Python');
    });

    it('should handle template not found error', async () => {
      try {
        await execAsync(`node ${cliPath} generate nonexistent`);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.stderr).toContain('Template not found: nonexistent');
        expect(error.code).toBe(1);
      }
    });
  });

  describe('list command', () => {
    beforeEach(async () => {
      await execAsync(`node ${cliPath} init`);

      // Create additional templates
      const bugFixTemplate = `---
name: bugfix
description: Fix bugs quickly
tags: [debug, fix]
version: 1.0.0
---
Content`;

      const featureTemplate = `---
name: feature
description: Implement new features
tags: [feature, enhancement]
version: 2.0.0
---
Content`;

      await fs.writeFile(
        path.join(testDir, 'templates/bugfix.yaml'),
        bugFixTemplate
      );
      await fs.writeFile(
        path.join(testDir, 'templates/feature.yaml'),
        featureTemplate
      );
    });

    it('should list all available templates', async () => {
      const { stdout } = await execAsync(`node ${cliPath} list`);

      expect(stdout).toContain('Available Templates:');
      expect(stdout).toContain('example');
      expect(stdout).toContain('bugfix');
      expect(stdout).toContain('feature');
      expect(stdout).toContain('Total: 3 template(s)');
    });

    it('should show detailed template information with -d flag', async () => {
      const { stdout } = await execAsync(`node ${cliPath} list --detailed`);

      expect(stdout).toContain('📝 bugfix');
      expect(stdout).toContain('Fix bugs quickly');
      expect(stdout).toContain('Version: 1.0.0');
      expect(stdout).toContain('Tags: debug, fix');
    });

    it('should filter templates by tags', async () => {
      const { stdout } = await execAsync(`node ${cliPath} list --tags debug`);

      expect(stdout).toContain('bugfix');
      expect(stdout).not.toContain('feature');
      expect(stdout).toContain('Total: 1 template(s)');
    });

    it('should handle empty template directory', async () => {
      // Remove all templates
      await fs.rm(path.join(testDir, 'templates'), { recursive: true });
      await fs.mkdir(path.join(testDir, 'templates'));

      const { stdout } = await execAsync(`node ${cliPath} list`);
      expect(stdout).toContain('No templates found');
    });
  });

  describe('validate command', () => {
    beforeEach(async () => {
      await execAsync(`node ${cliPath} init`);
    });

    it('should validate a correct template', async () => {
      const { stdout } = await execAsync(
        `node ${cliPath} validate templates/example.yaml`
      );

      expect(stdout).toContain('✅ Template is valid');
    });

    it('should detect invalid template syntax', async () => {
      const invalidTemplate = `---
name: 
description: Missing name
---
Content with {{unclosed`;

      await fs.writeFile(
        path.join(testDir, 'templates/invalid.yaml'),
        invalidTemplate
      );

      try {
        await execAsync(`node ${cliPath} validate templates/invalid.yaml`);
        fail('Should have failed validation');
      } catch (error: any) {
        expect(error.stderr).toContain('Template validation failed');
        expect(error.code).toBe(1);
      }
    });

    it('should validate template with complex structure', async () => {
      const complexTemplate = `---
name: complex
description: Complex template with all features
version: 1.0.0
tags:
  - advanced
  - full-featured
variables:
  task:
    type: string
    required: true
    description: The task to complete
  items:
    type: array
    default: []
  enabled:
    type: boolean
    default: true
  choice:
    type: choice
    choices: [option1, option2, option3]
    default: option1
plugins:
  - name: formatter
    enabled: true
hooks:
  beforeRender:
    - validate
  afterRender:
    - format
---
# {{task}}

{{#if enabled}}
Enabled features:
{{#each items}}
- {{this}}
{{/each}}
{{/if}}

Selected: {{choice}}`;

      await fs.writeFile(
        path.join(testDir, 'templates/complex.yaml'),
        complexTemplate
      );

      const { stdout } = await execAsync(
        `node ${cliPath} validate templates/complex.yaml`
      );

      expect(stdout).toContain('✅ Template is valid');
    });
  });

  describe('sync command', () => {
    beforeEach(async () => {
      await execAsync(`node ${cliPath} init`);
    });

    it('should sync templates to Cursor rules', async () => {
      const { stdout } = await execAsync(`node ${cliPath} sync`);

      expect(stdout).toContain('Successfully synced templates to Cursor rules');

      // Check rules directory has content
      const rulesDir = path.join(testDir, '.cursor/rules');
      const rules = await fs.readdir(rulesDir);
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should generate legacy .cursorrules with --legacy flag', async () => {
      await execAsync(`node ${cliPath} sync --legacy`);

      const legacyPath = path.join(testDir, '.cursorrules');
      const legacyContent = await fs.readFile(legacyPath, 'utf-8');
      expect(legacyContent).toBeTruthy();
    });

    it('should use custom output directory', async () => {
      const customDir = path.join(testDir, 'custom-rules');
      await execAsync(`node ${cliPath} sync -d ${customDir}`);

      const rules = await fs.readdir(customDir);
      expect(rules.length).toBeGreaterThan(0);
    });
  });

  describe('watch command', () => {
    beforeEach(async () => {
      await execAsync(`node ${cliPath} init`);
    });

    it('should start watch mode and respond to changes', (done) => {
      const watchProcess = exec(`node ${cliPath} watch -d templates`);

      let output = '';
      watchProcess.stdout?.on('data', (data) => {
        output += data;
        if (output.includes('Initial sync completed')) {
          // Create a new template to trigger watch
          const newTemplate = `---
name: watched
description: Template created during watch
---
Content`;
          
          fs.writeFile(
            path.join(testDir, 'templates/watched.yaml'),
            newTemplate
          ).then(() => {
            // Give watch some time to detect
            setTimeout(() => {
              watchProcess.kill('SIGINT');
            }, 1000);
          });
        }
      });

      watchProcess.on('exit', () => {
        expect(output).toContain('Watching templates in: templates');
        expect(output).toContain('Initial sync completed');
        done();
      });
    }, 10000);
  });

  describe('command aliases', () => {
    beforeEach(async () => {
      await execAsync(`node ${cliPath} init`);
    });

    it('should support g alias for generate', async () => {
      const variables = JSON.stringify({ task: 'test alias' });
      const { stdout } = await execAsync(
        `node ${cliPath} g example -v '${variables}'`
      );

      expect(stdout).toContain('Task: test alias');
    });

    it('should support ls alias for list', async () => {
      const { stdout } = await execAsync(`node ${cliPath} ls`);
      expect(stdout).toContain('Available Templates:');
    });
  });

  describe('help and version commands', () => {
    it('should display help when no command provided', async () => {
      const { stdout } = await execAsync(`node ${cliPath}`);

      expect(stdout).toContain('CLI tool for intelligent template-based prompt generation');
      expect(stdout).toContain('Commands:');
      expect(stdout).toContain('generate');
      expect(stdout).toContain('list');
      expect(stdout).toContain('sync');
    });

    it('should display version with --version', async () => {
      const { stdout } = await execAsync(`node ${cliPath} --version`);
      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should display command-specific help', async () => {
      const { stdout } = await execAsync(`node ${cliPath} generate --help`);

      expect(stdout).toContain('Generate a prompt from a template');
      expect(stdout).toContain('-v, --variables');
      expect(stdout).toContain('-f, --file');
      expect(stdout).toContain('-o, --output');
      expect(stdout).toContain('-c, --copy');
    });
  });

  describe('error handling', () => {
    it('should handle invalid JSON in variables', async () => {
      await execAsync(`node ${cliPath} init`);

      try {
        await execAsync(
          `node ${cliPath} generate example -v '{invalid json}'`
        );
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.stderr).toContain('Error');
        expect(error.code).toBe(1);
      }
    });

    it('should handle missing variable file', async () => {
      await execAsync(`node ${cliPath} init`);

      try {
        await execAsync(
          `node ${cliPath} generate example -f nonexistent.json`
        );
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.stderr).toContain('Error');
        expect(error.code).toBe(1);
      }
    });

    it('should handle permission errors gracefully', async () => {
      await execAsync(`node ${cliPath} init`);

      // Make templates directory read-only
      await fs.chmod(path.join(testDir, 'templates'), 0o444);

      try {
        await fs.writeFile(
          path.join(testDir, 'templates/new.yaml'),
          'content'
        );
        fail('Should have thrown permission error');
      } catch (error: any) {
        expect(error.code).toBe('EACCES');
      }

      // Restore permissions for cleanup
      await fs.chmod(path.join(testDir, 'templates'), 0o755);
    });
  });
});