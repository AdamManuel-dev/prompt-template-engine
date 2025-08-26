/**
 * Code Analysis Plugin
 * 
 * Adds code analysis capabilities to templates, automatically gathering
 * metrics and insights about the codebase.
 */

module.exports = {
  name: 'code-analysis',
  version: '1.0.0',
  description: 'Automated code analysis and metrics for templates',
  author: 'cursor-prompt-community',
  
  // Required permissions
  permissions: ['fs:read', 'exec:node'],
  
  // Plugin configuration schema
  configSchema: {
    type: 'object',
    properties: {
      includeMetrics: { type: 'boolean', default: true },
      includeComplexity: { type: 'boolean', default: true },
      includeDependencies: { type: 'boolean', default: true },
      maxFileSize: { type: 'number', default: 100000 }
    }
  },
  
  // Initialize plugin
  async init(api) {
    this.api = api;
    this.config = api.getConfig('code-analysis') || {};
    
    // Register analysis command
    api.registerCommand('analyze', {
      execute: async (args) => {
        const analysis = await this.analyzeCodebase(args.path || '.');
        return this.formatAnalysis(analysis);
      },
      description: 'Analyze codebase and generate metrics',
      options: [
        { name: 'path', type: 'string', description: 'Path to analyze' },
        { name: 'format', type: 'string', description: 'Output format (json|markdown)' }
      ]
    });
    
    // Register template variable provider
    api.registerVariableProvider('codeMetrics', async () => {
      return await this.getCodeMetrics();
    });
    
    return true;
  },
  
  // Hook implementations
  hooks: {
    'before-template': async (context) => {
      if (this.config.includeMetrics) {
        context.variables.codeMetrics = await this.getCodeMetrics();
      }
      return context;
    },
    
    'after-generate': async (result, context) => {
      if (context.includeAnalysis) {
        const analysis = await this.analyzeFiles(context.files);
        result.analysis = analysis;
      }
      return result;
    }
  },
  
  // Analysis methods
  async analyzeCodebase(path) {
    const files = await this.api.fs.glob(`${path}/**/*.{js,ts,jsx,tsx}`);
    const metrics = {
      totalFiles: files.length,
      totalLines: 0,
      languages: {},
      complexity: {},
      dependencies: []
    };
    
    for (const file of files) {
      const content = await this.api.fs.readFile(file);
      const analysis = this.analyzeFile(file, content);
      
      metrics.totalLines += analysis.lines;
      metrics.languages[analysis.language] = (metrics.languages[analysis.language] || 0) + 1;
      
      if (this.config.includeComplexity) {
        metrics.complexity[file] = analysis.complexity;
      }
    }
    
    if (this.config.includeDependencies) {
      metrics.dependencies = await this.analyzeDependencies(path);
    }
    
    return metrics;
  },
  
  analyzeFile(filePath, content) {
    const lines = content.split('\n').length;
    const language = this.detectLanguage(filePath);
    const complexity = this.calculateComplexity(content);
    
    return {
      path: filePath,
      lines,
      language,
      complexity,
      functions: this.extractFunctions(content, language),
      classes: this.extractClasses(content, language),
      imports: this.extractImports(content, language)
    };
  },
  
  detectLanguage(filePath) {
    const ext = filePath.split('.').pop();
    const languageMap = {
      js: 'JavaScript',
      jsx: 'JavaScript (React)',
      ts: 'TypeScript',
      tsx: 'TypeScript (React)',
      py: 'Python',
      java: 'Java',
      go: 'Go',
      rs: 'Rust'
    };
    return languageMap[ext] || 'Unknown';
  },
  
  calculateComplexity(content) {
    // Simplified cyclomatic complexity calculation
    let complexity = 1;
    const patterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?\s*:/g  // ternary operator
    ];
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) complexity += matches.length;
    });
    
    return complexity;
  },
  
  extractFunctions(content, language) {
    const functions = [];
    const patterns = {
      'JavaScript': /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:\([^)]*\)\s*=>|function))/g,
      'TypeScript': /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:\([^)]*\)\s*=>|function)|(?:public|private|protected)\s+(\w+)\s*\([^)]*\))/g,
      'Python': /def\s+(\w+)\s*\(/g
    };
    
    const pattern = patterns[language] || patterns['JavaScript'];
    let match;
    
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1] || match[2] || match[3];
      if (name) functions.push(name);
    }
    
    return functions;
  },
  
  extractClasses(content, language) {
    const classes = [];
    const patterns = {
      'JavaScript': /class\s+(\w+)/g,
      'TypeScript': /(?:class|interface)\s+(\w+)/g,
      'Python': /class\s+(\w+)/g
    };
    
    const pattern = patterns[language] || patterns['JavaScript'];
    let match;
    
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) classes.push(match[1]);
    }
    
    return classes;
  },
  
  extractImports(content, language) {
    const imports = [];
    const patterns = {
      'JavaScript': /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g,
      'TypeScript': /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g,
      'Python': /(?:import\s+(\S+)|from\s+(\S+)\s+import)/g
    };
    
    const pattern = patterns[language] || patterns['JavaScript'];
    let match;
    
    while ((match = pattern.exec(content)) !== null) {
      const module = match[1] || match[2];
      if (module) imports.push(module);
    }
    
    return [...new Set(imports)]; // Remove duplicates
  },
  
  async analyzeDependencies(path) {
    try {
      const packageJsonPath = `${path}/package.json`;
      const packageJson = await this.api.fs.readJson(packageJsonPath);
      
      return {
        dependencies: Object.keys(packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {}),
        peerDependencies: Object.keys(packageJson.peerDependencies || {})
      };
    } catch (error) {
      return { dependencies: [], devDependencies: [], peerDependencies: [] };
    }
  },
  
  async getCodeMetrics() {
    const analysis = await this.analyzeCodebase('.');
    return {
      files: analysis.totalFiles,
      lines: analysis.totalLines,
      languages: Object.keys(analysis.languages).join(', '),
      mainLanguage: Object.entries(analysis.languages)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'
    };
  },
  
  formatAnalysis(analysis) {
    const format = this.api.getOption('format') || 'markdown';
    
    if (format === 'json') {
      return JSON.stringify(analysis, null, 2);
    }
    
    // Markdown format
    let output = '# Code Analysis Report\n\n';
    output += `## Summary\n`;
    output += `- Total Files: ${analysis.totalFiles}\n`;
    output += `- Total Lines: ${analysis.totalLines}\n\n`;
    
    output += `## Languages\n`;
    for (const [lang, count] of Object.entries(analysis.languages)) {
      output += `- ${lang}: ${count} files\n`;
    }
    
    if (analysis.dependencies?.dependencies?.length > 0) {
      output += `\n## Dependencies\n`;
      analysis.dependencies.dependencies.forEach(dep => {
        output += `- ${dep}\n`;
      });
    }
    
    if (Object.keys(analysis.complexity).length > 0) {
      output += `\n## Complexity Analysis\n`;
      const complexFiles = Object.entries(analysis.complexity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      output += `Top 10 most complex files:\n`;
      complexFiles.forEach(([file, complexity]) => {
        output += `- ${file}: ${complexity}\n`;
      });
    }
    
    return output;
  }
};