/**
 * @fileoverview Test fixtures and sample data for consistent testing
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Reusable test data and fixtures
 * Main APIs: Sample data generators for various entities
 * Constraints: Static test data for deterministic tests
 * Patterns: Factory methods for test data creation
 */

export const sampleProjects = {
  basic: {
    name: 'basic-project',
    version: '1.0.0',
    description: 'A basic test project',
    main: 'dist/index.js',
    scripts: {
      build: 'tsc',
      test: 'jest',
      start: 'node dist/index.js',
    },
    dependencies: {
      typescript: '^5.0.0',
    },
    devDependencies: {
      jest: '^29.0.0',
      '@types/node': '^20.0.0',
    },
  },

  complex: {
    name: 'complex-project',
    version: '2.1.3-beta.1',
    description: 'A complex project with multiple dependencies',
    main: 'dist/index.js',
    bin: {
      'complex-cli': './bin/cli.js',
    },
    scripts: {
      build: 'npm run clean && tsc',
      clean: 'rm -rf dist',
      test: 'jest --coverage',
      'test:watch': 'jest --watch',
      lint: 'eslint src/**/*.ts',
      'lint:fix': 'eslint src/**/*.ts --fix',
      start: 'node dist/index.js',
      dev: 'ts-node src/index.ts',
    },
    dependencies: {
      commander: '^11.0.0',
      chalk: '^5.0.0',
      'fs-extra': '^11.0.0',
      glob: '^10.0.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      jest: '^29.0.0',
      '@types/jest': '^29.0.0',
      '@types/node': '^20.0.0',
      '@types/fs-extra': '^11.0.0',
      eslint: '^8.0.0',
      '@typescript-eslint/parser': '^6.0.0',
      '@typescript-eslint/eslint-plugin': '^6.0.0',
      'ts-node': '^10.0.0',
    },
    repository: {
      type: 'git',
      url: 'https://github.com/example/complex-project.git',
    },
    keywords: ['cli', 'tool', 'typescript'],
    author: 'Test Author <test@example.com>',
    license: 'MIT',
    engines: {
      node: '>=18.0.0',
    },
  },

  monorepo: {
    name: 'monorepo-project',
    private: true,
    workspaces: ['packages/*'],
    scripts: {
      build: 'lerna run build',
      test: 'lerna run test',
      publish: 'lerna publish',
    },
    devDependencies: {
      lerna: '^7.0.0',
      typescript: '^5.0.0',
    },
  },
};

export const sampleTemplates = {
  simple: {
    name: 'simple-template',
    version: '1.0.0',
    description: 'A simple template',
    files: [
      {
        source: 'README.md.template',
        destination: 'README.md',
      },
    ],
    variables: {
      projectName: {
        type: 'string',
        description: 'The name of the project',
        required: true,
      },
      author: {
        type: 'string',
        description: 'The author name',
        default: 'Anonymous',
      },
    },
  },

  advanced: {
    name: 'advanced-template',
    version: '2.0.0',
    description: 'An advanced template with conditions and loops',
    files: [
      {
        source: 'src/index.ts.template',
        destination: 'src/index.ts',
      },
      {
        source: 'package.json.template',
        destination: 'package.json',
      },
      {
        source: 'README.md.template',
        destination: 'README.md',
      },
    ],
    variables: {
      projectName: {
        type: 'string',
        description: 'The name of the project',
        required: true,
      },
      projectType: {
        type: 'choice',
        description: 'The type of project',
        choices: ['library', 'application', 'cli'],
        default: 'library',
      },
      features: {
        type: 'array',
        description: 'Features to include',
        items: {
          type: 'string',
        },
      },
      hasTests: {
        type: 'boolean',
        description: 'Include test setup',
        default: true,
      },
      author: {
        type: 'object',
        description: 'Author information',
        properties: {
          name: { type: 'string', required: true },
          email: { type: 'string' },
          url: { type: 'string' },
        },
      },
    },
  },
};

export const sampleTemplateContent = {
  readme: `# {{projectName}}

{{#if description}}
{{description}}
{{/if}}

## Installation
\`\`\`bash
npm install {{#if isPrivate}}{{else}}{{packageName}}{{/if}}
\`\`\`

## Usage
{{#if projectType}}
This is a {{projectType}} project.
{{/if}}

{{#each examples}}
### {{this.title}}
\`\`\`{{this.language}}
{{this.code}}
\`\`\`
{{/each}}

## Author
{{#if author.name}}
Created by {{author.name}}{{#if author.email}} <{{author.email}}>{{/if}}
{{/if}}

## License
{{license}}
`,

  packageJson: `{
  "name": "{{packageName}}",
  "version": "{{version}}",
  "description": "{{description}}",
  {{#if main}}"main": "{{main}}",{{/if}}
  {{#if bin}}"bin": {
    {{#each bin}}"{{@key}}": "{{this}}"{{#unless @last}},{{/unless}}{{/each}}
  },{{/if}}
  "scripts": {
    {{#each scripts}}"{{@key}}": "{{this}}"{{#unless @last}},{{/unless}}{{/each}}
  },
  {{#if dependencies}}"dependencies": {
    {{#each dependencies}}"{{@key}}": "{{this}}"{{#unless @last}},{{/unless}}{{/each}}
  },{{/if}}
  {{#if devDependencies}}"devDependencies": {
    {{#each devDependencies}}"{{@key}}": "{{this}}"{{#unless @last}},{{/unless}}{{/each}}
  },{{/if}}
  {{#if author}}"author": "{{author}}",{{/if}}
  {{#if license}}"license": "{{license}}"{{/if}}
}`,

  typescriptIndex: `{{#if hasExports}}
{{#each exports}}
export { {{this.name}} } from './{{this.path}}';
{{/each}}
{{/if}}

{{#if hasDefaultExport}}
/**
 * {{description}}
 */
export default class {{className}} {
  {{#each methods}}
  /**
   * {{this.description}}
   */
  {{this.name}}({{#each this.params}}{{this.name}}: {{this.type}}{{#unless @last}}, {{/unless}}{{/each}}): {{this.returnType}} {
    {{#if this.implementation}}
    {{this.implementation}}
    {{else}}
    throw new Error('Method not implemented');
    {{/if}}
  }

  {{/each}}
}
{{/if}}`,

  testFile: `import { {{className}} } from '../src/{{fileName}}';

describe('{{className}}', () => {
  {{#each testCases}}
  {{#if this.async}}
  it('{{this.description}}', async () => {
    {{this.implementation}}
  });
  {{else}}
  it('{{this.description}}', () => {
    {{this.implementation}}
  });
  {{/if}}

  {{/each}}
});`,
};

export const sampleContexts = {
  basic: {
    projectName: 'my-awesome-project',
    version: '1.0.0',
    description: 'An awesome project built with Node.js',
    author: 'John Doe',
    license: 'MIT',
  },

  advanced: {
    projectName: 'advanced-cli-tool',
    packageName: '@company/advanced-cli-tool',
    version: '2.1.0',
    description: 'A sophisticated command-line tool',
    projectType: 'cli',
    hasTests: true,
    main: 'dist/index.js',
    bin: {
      'advanced-cli': './dist/cli.js',
    },
    scripts: {
      build: 'tsc',
      test: 'jest',
      start: 'node dist/index.js',
      dev: 'ts-node src/index.ts',
    },
    dependencies: {
      commander: '^11.0.0',
      chalk: '^5.0.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      jest: '^29.0.0',
      '@types/node': '^20.0.0',
    },
    author: {
      name: 'Jane Smith',
      email: 'jane.smith@company.com',
      url: 'https://github.com/janesmith',
    },
    license: 'MIT',
    features: ['logging', 'configuration', 'testing'],
    examples: [
      {
        title: 'Basic Usage',
        language: 'bash',
        code: 'advanced-cli --help',
      },
      {
        title: 'Advanced Usage',
        language: 'bash',
        code: 'advanced-cli create --template react --name my-app',
      },
    ],
  },

  withArrays: {
    projectName: 'multi-feature-app',
    features: ['authentication', 'database', 'api', 'frontend'],
    users: [
      { name: 'Alice', role: 'admin', email: 'alice@example.com' },
      { name: 'Bob', role: 'user', email: 'bob@example.com' },
      { name: 'Charlie', role: 'moderator', email: 'charlie@example.com' },
    ],
    config: {
      database: {
        host: 'localhost',
        port: 5432,
        name: 'myapp_db',
      },
      api: {
        version: 'v1',
        port: 3000,
      },
    },
  },
};

export const sampleGitContext = {
  clean: {
    isRepo: true,
    branch: 'main',
    isClean: true,
    modifiedFiles: [],
    stagedFiles: [],
    untrackedFiles: [],
    commits: [
      {
        hash: 'abc123def',
        message: 'feat: add new feature',
        author: 'John Doe <john@example.com>',
        date: new Date('2025-01-01'),
      },
      {
        hash: 'def456abc',
        message: 'fix: resolve bug in handler',
        author: 'Jane Smith <jane@example.com>',
        date: new Date('2025-01-02'),
      },
    ],
  },

  dirty: {
    isRepo: true,
    branch: 'feature/new-functionality',
    isClean: false,
    modifiedFiles: ['src/index.ts', 'README.md'],
    stagedFiles: ['src/utils.ts'],
    untrackedFiles: ['temp.log', 'debug.json'],
    commits: [
      {
        hash: 'xyz789abc',
        message: 'wip: working on new functionality',
        author: 'Developer <dev@example.com>',
        date: new Date('2025-01-03'),
      },
    ],
  },

  notRepo: {
    isRepo: false,
    branch: null,
    isClean: true,
    modifiedFiles: [],
    stagedFiles: [],
    untrackedFiles: [],
    commits: [],
  },
};

export const sampleFileStructure = {
  simple: [
    { path: 'package.json', type: 'file', size: 500 },
    { path: 'README.md', type: 'file', size: 1200 },
    { path: 'src/index.ts', type: 'file', size: 800 },
  ],

  complex: [
    { path: 'package.json', type: 'file', size: 1500 },
    { path: 'README.md', type: 'file', size: 3200 },
    { path: 'tsconfig.json', type: 'file', size: 400 },
    { path: '.gitignore', type: 'file', size: 150 },
    { path: 'src', type: 'directory' },
    { path: 'src/index.ts', type: 'file', size: 1200 },
    { path: 'src/lib', type: 'directory' },
    { path: 'src/lib/utils.ts', type: 'file', size: 600 },
    { path: 'src/lib/constants.ts', type: 'file', size: 300 },
    { path: 'src/types', type: 'directory' },
    { path: 'src/types/index.ts', type: 'file', size: 400 },
    { path: 'tests', type: 'directory' },
    { path: 'tests/index.test.ts', type: 'file', size: 800 },
    { path: 'tests/lib', type: 'directory' },
    { path: 'tests/lib/utils.test.ts', type: 'file', size: 600 },
    { path: 'docs', type: 'directory' },
    { path: 'docs/API.md', type: 'file', size: 2500 },
    { path: 'docs/CONTRIBUTING.md', type: 'file', size: 1800 },
  ],
};

/**
 * Factory for creating test data with variations
 */
export class TestDataFactory {
  static createProject(overrides: Partial<typeof sampleProjects.basic> = {}) {
    return { ...sampleProjects.basic, ...overrides };
  }

  static createTemplate(
    overrides: Partial<typeof sampleTemplates.simple> = {}
  ) {
    return { ...sampleTemplates.simple, ...overrides };
  }

  static createContext(overrides: Partial<typeof sampleContexts.basic> = {}) {
    return { ...sampleContexts.basic, ...overrides };
  }

  static createGitContext(
    overrides: Partial<typeof sampleGitContext.clean> = {}
  ) {
    return { ...sampleGitContext.clean, ...overrides };
  }

  static createFileList(count: number, extension: string = '.ts'): string[] {
    return Array.from({ length: count }, (_, i) => `file${i}${extension}`);
  }

  static createLargeContext(itemCount: number = 100) {
    return {
      projectName: 'large-project',
      items: Array.from({ length: itemCount }, (_, i) => ({
        id: i,
        name: `item-${i}`,
        value: Math.random(),
        active: i % 2 === 0,
      })),
      categories: Array.from({ length: Math.ceil(itemCount / 10) }, (_, i) => ({
        name: `category-${i}`,
        items: Array.from({ length: 10 }, (_, j) => `item-${i * 10 + j}`),
      })),
    };
  }
}

export default {
  sampleProjects,
  sampleTemplates,
  sampleTemplateContent,
  sampleContexts,
  sampleGitContext,
  sampleFileStructure,
  TestDataFactory,
};
