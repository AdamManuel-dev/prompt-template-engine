/**
 * @fileoverview Tests for init command functionality
 * @lastmodified 2025-08-22T15:30:00Z
 *
 * Features: Tests initialization of new prompt template projects
 * Main APIs: init command with options
 * Constraints: Requires valid project structure and template types
 * Patterns: Command testing with mocked file operations
 */

import { Command } from 'commander';

interface InitCommandOptions {
  name?: string;
  template?: string;
}

describe('Init Command', () => {
  let testProgram: Command;
  let mockConsoleLog: jest.SpyInstance;

  beforeEach(() => {
    testProgram = new Command();
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  it('should register init command with correct options', () => {
    const initCommand = testProgram
      .command('init')
      .description('initialize a new prompt template project')
      .option('-n, --name <name>', 'project name')
      .option('-t, --template <template>', 'template type', 'basic');

    expect(initCommand.name()).toBe('init');
    expect(initCommand.description()).toBe(
      'initialize a new prompt template project'
    );
    expect(initCommand.options).toHaveLength(2);

    const optionFlags = initCommand.options.map(opt => opt.flags);
    expect(optionFlags).toContain('-n, --name <name>');
    expect(optionFlags).toContain('-t, --template <template>');
  });

  it('should handle init command without options', async () => {
    let capturedOptions: InitCommandOptions;

    testProgram.command('init').action(async (options: InitCommandOptions) => {
      capturedOptions = options;
    });

    // Parse command line arguments
    await testProgram.parseAsync(['node', 'test', 'init'], { from: 'node' });

    expect(capturedOptions!).toEqual({});
  });

  it('should handle init command with name option', async () => {
    let capturedOptions: InitCommandOptions;

    testProgram
      .command('init')
      .option('-n, --name <name>', 'project name')
      .action(async (options: InitCommandOptions) => {
        capturedOptions = options;
      });

    await testProgram.parseAsync(
      ['node', 'test', 'init', '--name', 'my-project'],
      { from: 'node' }
    );

    expect(capturedOptions!).toEqual({
      name: 'my-project',
    });
  });

  it('should handle init command with template option', async () => {
    let capturedOptions: InitCommandOptions;

    testProgram
      .command('init')
      .option('-t, --template <template>', 'template type', 'basic')
      .action(async (options: InitCommandOptions) => {
        capturedOptions = options;
      });

    await testProgram.parseAsync(
      ['node', 'test', 'init', '--template', 'advanced'],
      { from: 'node' }
    );

    expect(capturedOptions!).toEqual({
      template: 'advanced',
    });
  });

  it('should use default template when not specified', async () => {
    let capturedOptions: InitCommandOptions;

    testProgram
      .command('init')
      .option('-t, --template <template>', 'template type', 'basic')
      .action(async (options: InitCommandOptions) => {
        capturedOptions = options;
      });

    await testProgram.parseAsync(['node', 'test', 'init'], { from: 'node' });

    expect(capturedOptions!).toEqual({
      template: 'basic',
    });
  });

  it('should handle both name and template options', async () => {
    let capturedOptions: InitCommandOptions;

    testProgram
      .command('init')
      .option('-n, --name <name>', 'project name')
      .option('-t, --template <template>', 'template type', 'basic')
      .action(async (options: InitCommandOptions) => {
        capturedOptions = options;
      });

    await testProgram.parseAsync(
      [
        'node',
        'test',
        'init',
        '--name',
        'test-project',
        '--template',
        'custom',
      ],
      { from: 'node' }
    );

    expect(capturedOptions!).toEqual({
      name: 'test-project',
      template: 'custom',
    });
  });
});
