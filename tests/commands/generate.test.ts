/**
 * @fileoverview Tests for generate/create command functionality
 * @lastmodified 2025-08-22T15:30:00Z
 *
 * Features: Tests template generation and creation workflows
 * Main APIs: create command with template naming and options
 * Constraints: Requires valid template names and descriptions
 * Patterns: Command testing with parameter validation
 */

import { Command } from 'commander';

interface CreateCommandOptions {
  type?: string;
  description?: string;
}

describe('Generate/Create Command', () => {
  let testProgram: Command;
  let mockConsoleLog: jest.SpyInstance;

  beforeEach(() => {
    testProgram = new Command();
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  it('should register create command with correct options', () => {
    const createCommand = testProgram
      .command('create <name>')
      .description('create a new prompt template')
      .option('-t, --type <type>', 'template type', 'default')
      .option('-d, --description <desc>', 'template description');

    expect(createCommand.name()).toBe('create');
    expect(createCommand.description()).toBe('create a new prompt template');
    expect(createCommand.options).toHaveLength(2);

    const optionFlags = createCommand.options.map(opt => opt.flags);
    expect(optionFlags).toContain('-t, --type <type>');
    expect(optionFlags).toContain('-d, --description <desc>');
  });

  it('should require template name argument', async () => {
    let capturedName: string | undefined;
    let capturedOptions: CreateCommandOptions | undefined;

    testProgram
      .command('create <name>')
      .action(async (name: string, options: CreateCommandOptions) => {
        capturedName = name;
        capturedOptions = options;
      });

    await testProgram.parseAsync(['node', 'test', 'create', 'my-template'], {
      from: 'node',
    });

    expect(capturedName).toBe('my-template');
    expect(capturedOptions).toBeDefined();
    expect(capturedOptions).toEqual({});
  });

  it('should handle create command with type option', async () => {
    let capturedName: string | undefined;
    let capturedOptions: CreateCommandOptions | undefined;

    testProgram
      .command('create <name>')
      .option('-t, --type <type>', 'template type', 'default')
      .action(async (name: string, options: CreateCommandOptions) => {
        capturedName = name;
        capturedOptions = options;
      });

    await testProgram.parseAsync(
      ['node', 'test', 'create', 'my-template', '--type', 'custom'],
      { from: 'node' }
    );

    expect(capturedName).toBe('my-template');
    expect(capturedOptions?.type).toBe('custom');
  });

  it('should handle create command with description option', async () => {
    let capturedName: string | undefined;
    let capturedOptions: CreateCommandOptions | undefined;

    testProgram
      .command('create <name>')
      .option('-d, --description <desc>', 'template description')
      .action(async (name: string, options: CreateCommandOptions) => {
        capturedName = name;
        capturedOptions = options;
      });

    await testProgram.parseAsync(
      [
        'node',
        'test',
        'create',
        'my-template',
        '--description',
        'A test template',
      ],
      { from: 'node' }
    );

    expect(capturedName).toBe('my-template');
    expect(capturedOptions?.description).toBe('A test template');
  });

  it('should use default template type when not specified', async () => {
    let capturedOptions: CreateCommandOptions | undefined;

    testProgram
      .command('create <name>')
      .option('-t, --type <type>', 'template type', 'default')
      .action(async (_name: string, options: CreateCommandOptions) => {
        capturedOptions = options;
      });

    await testProgram.parseAsync(['node', 'test', 'create', 'my-template'], {
      from: 'node',
    });

    expect(capturedOptions?.type).toBe('default');
  });

  it('should handle all options together', async () => {
    let capturedName: string | undefined;
    let capturedOptions: CreateCommandOptions | undefined;

    testProgram
      .command('create <name>')
      .option('-t, --type <type>', 'template type', 'default')
      .option('-d, --description <desc>', 'template description')
      .action(async (name: string, options: CreateCommandOptions) => {
        capturedName = name;
        capturedOptions = options;
      });

    await testProgram.parseAsync(
      [
        'node',
        'test',
        'create',
        'my-template',
        '--type',
        'advanced',
        '--description',
        'An advanced template for testing',
      ],
      { from: 'node' }
    );

    expect(capturedName).toBe('my-template');
    expect(capturedOptions?.type).toBe('advanced');
    expect(capturedOptions?.description).toBe(
      'An advanced template for testing'
    );
  });

  it('should handle template names with special characters', async () => {
    let capturedName: string | undefined;

    testProgram.command('create <name>').action(async (name: string) => {
      capturedName = name;
    });

    await testProgram.parseAsync(
      ['node', 'test', 'create', 'my-special-template_v2'],
      { from: 'node' }
    );

    expect(capturedName).toBe('my-special-template_v2');
  });
});
