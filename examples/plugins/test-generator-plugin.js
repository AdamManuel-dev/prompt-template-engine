/**
 * Test Generator Plugin
 * 
 * Automatically generates test templates based on code analysis,
 * supporting multiple testing frameworks.
 */

module.exports = {
  name: 'test-generator',
  version: '1.0.0',
  description: 'Automated test template generation for various frameworks',
  author: 'cursor-prompt-community',
  
  // Plugin dependencies
  dependencies: ['code-analysis@^1.0.0'],
  
  // Configuration
  defaultConfig: {
    framework: 'jest', // jest, mocha, vitest, pytest
    style: 'bdd', // bdd, tdd
    coverage: true,
    mockStyle: 'auto' // auto, manual, none
  },
  
  async init(api) {
    this.api = api;
    this.config = { ...this.defaultConfig, ...api.getConfig('test-generator') };
    
    // Register test generation command
    api.registerCommand('generate-tests', {
      execute: async (args) => {
        const targetFile = args.file || args._[0];
        if (!targetFile) {
          throw new Error('Please specify a file to generate tests for');
        }
        
        const tests = await this.generateTests(targetFile);
        return this.formatTests(tests);
      },
      description: 'Generate test templates for a file',
      options: [
        { name: 'file', type: 'string', description: 'Target file path' },
        { name: 'framework', type: 'string', description: 'Testing framework' },
        { name: 'style', type: 'string', description: 'Test style (bdd/tdd)' }
      ]
    });
    
    // Register template enhancement
    api.registerTemplateEnhancer('test', async (template, context) => {
      if (context.generateTests) {
        const tests = await this.generateTestsForContext(context);
        template.tests = tests;
      }
      return template;
    });
    
    return true;
  },
  
  hooks: {
    'before-template': async (context) => {
      if (context.template === 'test' || context.includeTests) {
        const testSuggestions = await this.suggestTests(context.files);
        context.variables.testSuggestions = testSuggestions;
      }
      return context;
    }
  },
  
  async generateTests(filePath) {
    const content = await this.api.fs.readFile(filePath);
    const language = this.detectLanguage(filePath);
    const analysis = await this.analyzeCode(content, language);
    
    const tests = {
      filePath,
      testPath: this.getTestPath(filePath),
      framework: this.config.framework,
      imports: this.generateImports(analysis, language),
      suites: []
    };
    
    // Generate test suites for classes
    for (const className of analysis.classes) {
      const suite = await this.generateClassTests(className, analysis);
      tests.suites.push(suite);
    }
    
    // Generate tests for standalone functions
    const standaloneFunctions = analysis.functions.filter(
      f => !analysis.classes.some(c => analysis.classMethods[c]?.includes(f))
    );
    
    if (standaloneFunctions.length > 0) {
      const suite = await this.generateFunctionTests(standaloneFunctions, analysis);
      tests.suites.push(suite);
    }
    
    return tests;
  },
  
  async analyzeCode(content, language) {
    const analysis = {
      language,
      functions: [],
      classes: [],
      classMethods: {},
      exports: [],
      imports: [],
      types: []
    };
    
    // Extract functions
    const functionPattern = this.getFunctionPattern(language);
    let match;
    while ((match = functionPattern.exec(content)) !== null) {
      const funcInfo = this.parseFunctionSignature(match[0], language);
      analysis.functions.push(funcInfo);
    }
    
    // Extract classes and methods
    const classPattern = this.getClassPattern(language);
    while ((match = classPattern.exec(content)) !== null) {
      const className = match[1];
      analysis.classes.push(className);
      analysis.classMethods[className] = this.extractClassMethods(content, className, language);
    }
    
    // Extract exports
    analysis.exports = this.extractExports(content, language);
    
    // Extract imports
    analysis.imports = this.extractImports(content, language);
    
    // Extract types (for TypeScript)
    if (language === 'TypeScript') {
      analysis.types = this.extractTypes(content);
    }
    
    return analysis;
  },
  
  getFunctionPattern(language) {
    const patterns = {
      JavaScript: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)|(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+)\s*=>/gm,
      TypeScript: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)(?:\s*:\s*[^{]+)?|(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+)\s*=>/gm,
      Python: /def\s+(\w+)\s*\([^)]*\)\s*(?:->\s*[^:]+)?:/gm
    };
    return patterns[language] || patterns.JavaScript;
  },
  
  getClassPattern(language) {
    const patterns = {
      JavaScript: /class\s+(\w+)(?:\s+extends\s+\w+)?/g,
      TypeScript: /class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?/g,
      Python: /class\s+(\w+)(?:\([^)]*\))?:/g
    };
    return patterns[language] || patterns.JavaScript;
  },
  
  parseFunctionSignature(signature, language) {
    const name = signature.match(/(?:function\s+|const\s+)(\w+)/)?.[1] || 'unknown';
    const params = signature.match(/\(([^)]*)\)/)?.[1] || '';
    const isAsync = /async/.test(signature);
    const returnType = language === 'TypeScript' 
      ? signature.match(/\)\s*:\s*([^{]+)/)?.[1]?.trim() 
      : undefined;
    
    return {
      name,
      params: params.split(',').map(p => p.trim()).filter(Boolean),
      isAsync,
      returnType,
      signature
    };
  },
  
  extractClassMethods(content, className, language) {
    const methods = [];
    const methodPattern = language === 'Python'
      ? new RegExp(`class\\s+${className}[^:]*:[^]*?(?=class\\s+\\w+|$)`, 'g')
      : new RegExp(`class\\s+${className}[^{]*{[^}]*}`, 'g');
    
    const classContent = content.match(methodPattern)?.[0] || '';
    const methodExtractor = language === 'Python'
      ? /def\s+(\w+)\s*\(/g
      : /(?:async\s+)?(\w+)\s*\([^)]*\)/g;
    
    let match;
    while ((match = methodExtractor.exec(classContent)) !== null) {
      if (match[1] && !['constructor', 'class'].includes(match[1])) {
        methods.push(match[1]);
      }
    }
    
    return methods;
  },
  
  extractExports(content, language) {
    const exports = [];
    
    if (language === 'JavaScript' || language === 'TypeScript') {
      // Named exports
      const namedExportPattern = /export\s+{([^}]+)}/g;
      let match;
      while ((match = namedExportPattern.exec(content)) !== null) {
        const names = match[1].split(',').map(n => n.trim());
        exports.push(...names);
      }
      
      // Default export
      if (/export\s+default/.test(content)) {
        exports.push('default');
      }
      
      // Direct exports
      const directExportPattern = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
      while ((match = directExportPattern.exec(content)) !== null) {
        exports.push(match[1]);
      }
    }
    
    return exports;
  },
  
  extractImports(content, language) {
    const imports = [];
    
    if (language === 'JavaScript' || language === 'TypeScript') {
      const importPattern = /import\s+(?:{([^}]+)}|(\w+)|[\w\s,{}]+)\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importPattern.exec(content)) !== null) {
        imports.push({
          names: match[1] ? match[1].split(',').map(n => n.trim()) : [match[2]],
          module: match[3]
        });
      }
    } else if (language === 'Python') {
      const importPattern = /(?:from\s+(\S+)\s+)?import\s+([^#\n]+)/g;
      let match;
      while ((match = importPattern.exec(content)) !== null) {
        imports.push({
          module: match[1] || match[2].trim(),
          names: match[1] ? match[2].split(',').map(n => n.trim()) : []
        });
      }
    }
    
    return imports;
  },
  
  extractTypes(content) {
    const types = [];
    const typePattern = /(?:type|interface)\s+(\w+)(?:<[^>]+>)?\s*=?[^;{]*[;{]/g;
    let match;
    while ((match = typePattern.exec(content)) !== null) {
      types.push(match[1]);
    }
    return types;
  },
  
  generateImports(analysis, language) {
    const framework = this.config.framework;
    const imports = [];
    
    if (framework === 'jest') {
      imports.push("import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';");
    } else if (framework === 'mocha') {
      imports.push("import { describe, it, before, after, beforeEach, afterEach } from 'mocha';");
      imports.push("import { expect } from 'chai';");
    } else if (framework === 'vitest') {
      imports.push("import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';");
    }
    
    // Import the module being tested
    const modulePath = analysis.filePath.replace(/\.(js|ts)$/, '');
    if (analysis.exports.includes('default')) {
      imports.push(`import Module from '${modulePath}';`);
    }
    if (analysis.exports.length > 0 && !analysis.exports.includes('default')) {
      imports.push(`import { ${analysis.exports.join(', ')} } from '${modulePath}';`);
    }
    
    return imports;
  },
  
  async generateClassTests(className, analysis) {
    const methods = analysis.classMethods[className] || [];
    const suite = {
      name: className,
      type: 'class',
      setup: this.generateSetup(className),
      teardown: this.generateTeardown(className),
      tests: []
    };
    
    // Constructor test
    suite.tests.push({
      name: 'should create an instance',
      type: 'constructor',
      code: this.generateConstructorTest(className)
    });
    
    // Method tests
    for (const method of methods) {
      suite.tests.push({
        name: `should test ${method}`,
        type: 'method',
        code: this.generateMethodTest(className, method)
      });
    }
    
    return suite;
  },
  
  async generateFunctionTests(functions, analysis) {
    const suite = {
      name: 'Functions',
      type: 'functions',
      setup: '',
      teardown: '',
      tests: []
    };
    
    for (const func of functions) {
      suite.tests.push({
        name: `should test ${func.name}`,
        type: 'function',
        code: this.generateFunctionTest(func)
      });
      
      if (func.isAsync) {
        suite.tests.push({
          name: `should handle errors in ${func.name}`,
          type: 'function-error',
          code: this.generateAsyncErrorTest(func)
        });
      }
    }
    
    return suite;
  },
  
  generateSetup(className) {
    if (this.config.framework === 'jest') {
      return `let instance;
    
    beforeEach(() => {
      instance = new ${className}();
    });`;
    }
    return '';
  },
  
  generateTeardown(className) {
    if (this.config.framework === 'jest') {
      return `afterEach(() => {
      jest.clearAllMocks();
    });`;
    }
    return '';
  },
  
  generateConstructorTest(className) {
    return `expect(instance).toBeInstanceOf(${className});
    expect(instance).toBeDefined();`;
  },
  
  generateMethodTest(className, method) {
    return `// Arrange
    const expectedResult = /* TODO: Add expected result */;
    
    // Act
    const result = instance.${method}(/* TODO: Add parameters */);
    
    // Assert
    expect(result).toEqual(expectedResult);`;
  },
  
  generateFunctionTest(func) {
    const { name, params, isAsync } = func;
    const paramList = params.length > 0 ? `/* TODO: ${params.join(', ')} */` : '';
    
    return `// Arrange
    const expectedResult = /* TODO: Add expected result */;
    
    // Act
    const result = ${isAsync ? 'await ' : ''}${name}(${paramList});
    
    // Assert
    expect(result).toEqual(expectedResult);`;
  },
  
  generateAsyncErrorTest(func) {
    const { name } = func;
    
    return `// Arrange
    const errorMessage = 'Test error';
    
    // Act & Assert
    await expect(${name}(/* invalid params */)).rejects.toThrow(errorMessage);`;
  },
  
  formatTests(tests) {
    const { framework, style } = this.config;
    let output = '';
    
    // Add file header
    output += `/**
 * Test suite for ${tests.filePath}
 * Generated by test-generator plugin
 * Framework: ${framework}
 * Style: ${style}
 */

`;
    
    // Add imports
    output += tests.imports.join('\n') + '\n\n';
    
    // Generate test structure
    for (const suite of tests.suites) {
      if (style === 'bdd') {
        output += `describe('${suite.name}', () => {\n`;
      } else {
        output += `suite('${suite.name}', () => {\n`;
      }
      
      if (suite.setup) {
        output += `  ${suite.setup.replace(/\n/g, '\n  ')}\n\n`;
      }
      
      for (const test of suite.tests) {
        const testKeyword = style === 'bdd' ? 'it' : 'test';
        output += `  ${testKeyword}('${test.name}', ${test.type.includes('async') ? 'async ' : ''}() => {\n`;
        output += `    ${test.code.replace(/\n/g, '\n    ')}\n`;
        output += `  });\n\n`;
      }
      
      if (suite.teardown) {
        output += `  ${suite.teardown.replace(/\n/g, '\n  ')}\n`;
      }
      
      output += '});\n\n';
    }
    
    return output;
  },
  
  getTestPath(filePath) {
    // Convert source path to test path
    const testDir = filePath.includes('/src/') 
      ? filePath.replace('/src/', '/tests/') 
      : filePath.replace(/\.([jt]s)$/, '.test.$1');
    
    return testDir;
  },
  
  detectLanguage(filePath) {
    const ext = filePath.split('.').pop();
    const langMap = {
      js: 'JavaScript',
      jsx: 'JavaScript',
      ts: 'TypeScript',
      tsx: 'TypeScript',
      py: 'Python'
    };
    return langMap[ext] || 'JavaScript';
  },
  
  async suggestTests(files) {
    const suggestions = [];
    
    for (const file of files || []) {
      const content = await this.api.fs.readFile(file);
      const language = this.detectLanguage(file);
      const analysis = await this.analyzeCode(content, language);
      
      suggestions.push({
        file,
        suggestedTests: [
          ...analysis.functions.map(f => `Test ${f.name} function`),
          ...analysis.classes.map(c => `Test ${c} class`),
          ...analysis.classes.flatMap(c => 
            (analysis.classMethods[c] || []).map(m => `Test ${c}.${m} method`)
          )
        ]
      });
    }
    
    return suggestions;
  },
  
  async generateTestsForContext(context) {
    const tests = [];
    
    for (const file of context.files || []) {
      const generatedTests = await this.generateTests(file);
      tests.push(this.formatTests(generatedTests));
    }
    
    return tests;
  }
};