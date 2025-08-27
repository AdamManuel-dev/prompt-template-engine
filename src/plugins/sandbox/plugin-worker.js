/**
 * @fileoverview Worker thread for secure plugin execution
 * @lastmodified 2025-08-23T05:30:00Z
 * 
 * Features: Isolated plugin execution environment
 * Main APIs: Message-based communication with main thread
 * Constraints: No direct access to main thread resources
 * Patterns: Worker thread pattern, message passing, controlled API access
 */

const { parentPort, workerData } = require('worker_threads');
const { parse } = require('@babel/parser');
const { default: traverse } = require('@babel/traverse');

/**
 * Secure function parser - replaces dangerous eval() usage
 * Only allows whitelisted function structures and validates AST
 */
class SecureFunctionParser {
  constructor() {
    this.allowedNodeTypes = new Set([
      'FunctionExpression',
      'FunctionDeclaration', 
      'ArrowFunctionExpression',
      'BlockStatement',
      'ExpressionStatement',
      'ReturnStatement',
      'VariableDeclaration',
      'VariableDeclarator',
      'Identifier',
      'CallExpression',
      'MemberExpression',
      'Literal',
      'BinaryExpression',
      'AssignmentExpression',
      'IfStatement',
      'ConditionalExpression',
      'LogicalExpression',
      'UnaryExpression',
      'UpdateExpression',
      'ObjectExpression',
      'Property',
      'ArrayExpression',
      'ThisExpression'
    ]);
  }

  /**
   * Validate AST against security rules
   */
  validateAST(ast) {
    let isValid = true;
    const errors = [];

    traverse(ast, {
      enter: (path) => {
        const node = path.node;
        
        // Check if node type is allowed
        if (!this.allowedNodeTypes.has(node.type)) {
          isValid = false;
          errors.push(`Forbidden AST node type: ${node.type}`);
        }

        // Specific security validations
        if (node.type === 'CallExpression') {
          const callee = node.callee;
          
          // Block dangerous function calls
          if (callee.type === 'Identifier') {
            const dangerousFunctions = ['eval', 'Function', 'setTimeout', 'setInterval', 'require'];
            if (dangerousFunctions.includes(callee.name)) {
              isValid = false;
              errors.push(`Forbidden function call: ${callee.name}`);
            }
          }
          
          // Block global object access
          if (callee.type === 'MemberExpression' && callee.object.name === 'global') {
            isValid = false;
            errors.push('Global object access forbidden');
          }
        }

        // Block process object access
        if (node.type === 'MemberExpression' && node.object?.name === 'process') {
          isValid = false;
          errors.push('Process object access forbidden');
        }
      }
    });

    return { isValid, errors };
  }

  /**
   * Create a safe function from validated AST without using Function constructor
   */
  createSafeFunctionFromAST(ast) {
    // Extract function parameters and body from AST
    let functionParams = [];
    let functionBody = null;
    
    traverse(ast, {
      FunctionExpression: (path) => {
        const node = path.node;
        functionParams = node.params.map(param => param.name);
        functionBody = node.body;
      },
      ArrowFunctionExpression: (path) => {
        const node = path.node;
        functionParams = node.params.map(param => param.name);
        functionBody = node.body;
      }
    });
    
    // Return a safe function that executes using predefined safe operations
    return (...args) => {
      try {
        // Create a safe execution context
        const safeContext = {};
        functionParams.forEach((param, index) => {
          if (param && args[index] !== undefined) {
            safeContext[param] = args[index];
          }
        });
        
        // For now, return a basic result - in a full implementation,
        // this would use an AST interpreter instead of dynamic execution
        if (functionBody && functionBody.type === 'BlockStatement') {
          // Look for return statements in the function body
          let returnValue = undefined;
          
          functionBody.body.forEach(stmt => {
            if (stmt.type === 'ReturnStatement' && stmt.argument) {
              if (stmt.argument.type === 'Literal') {
                returnValue = stmt.argument.value;
              } else if (stmt.argument.type === 'Identifier') {
                returnValue = safeContext[stmt.argument.name];
              }
            }
          });
          
          return returnValue;
        }
        
        return undefined;
      } catch (error) {
        console.error('Safe function execution failed:', error.message);
        return null;
      }
    };
  }

  /**
   * Safely parse and validate a function string
   * Returns null if parsing fails or security validation fails
   */
  parseFunction(functionString) {
    if (!functionString || typeof functionString !== 'string') {
      return null;
    }

    try {
      // Parse the function string
      let ast;
      try {
        // Try parsing as function expression first
        ast = parse(`(${functionString})`, { 
          sourceType: 'module',
          plugins: ['objectRestSpread', 'asyncGenerators']
        });
      } catch {
        // If that fails, try as function declaration
        ast = parse(functionString, { 
          sourceType: 'module',
          plugins: ['objectRestSpread', 'asyncGenerators']
        });
      }

      // Validate the AST for security
      const validation = this.validateAST(ast);
      if (!validation.isValid) {
        console.error('Function validation failed:', validation.errors);
        return null;
      }

      // If validation passes, return a safe function wrapper using AST evaluation
      // NO Function constructor - use AST-based safe execution
      return this.createSafeFunctionFromAST(ast);
      
    } catch (error) {
      console.error('Function parsing failed:', error.message);
      return null;
    }
  }
}

/**
 * Sandboxed plugin API
 */
class SandboxedPluginAPI {
  constructor(executionId) {
    this.executionId = executionId;
    this.messageId = 0;
    this.pendingCalls = new Map();
  }

  /**
   * Generate unique message ID
   */
  generateMessageId() {
    return `${this.executionId}-api-${++this.messageId}`;
  }

  /**
   * Make an API call to the main thread
   */
  async makeAPICall(method, args) {
    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      
      this.pendingCalls.set(messageId, { resolve, reject });
      
      parentPort.postMessage({
        type: 'api-call',
        id: messageId,
        data: { method, args }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingCalls.has(messageId)) {
          this.pendingCalls.delete(messageId);
          reject(new Error('API call timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Handle API responses
   */
  handleAPIResponse(message) {
    const handler = this.pendingCalls.get(message.id);
    if (handler) {
      this.pendingCalls.delete(message.id);
      if (message.type === 'result') {
        handler.resolve(message.data);
      } else if (message.type === 'error') {
        handler.reject(new Error(message.data));
      }
    }
  }

  // Plugin API methods
  getVersion() {
    return '1.0.0';
  }

  getConfig(key) {
    // In a real implementation, this would be cached or retrieved from main thread
    return null;
  }

  setConfig(key, value) {
    // Configuration changes would be sent to main thread
    return this.makeAPICall('config.set', [key, value]);
  }

  registerCommand(name, handler) {
    // Commands would be registered with main thread
    return this.makeAPICall('command.register', [name, handler.toString()]);
  }

  getCommand(name) {
    return this.makeAPICall('command.get', [name]);
  }

  on(event, callback) {
    // Event listeners would be managed by main thread
    return this.makeAPICall('event.on', [event, callback.toString()]);
  }

  emit(event, data) {
    return this.makeAPICall('event.emit', [event, data]);
  }

  // Storage API
  get storage() {
    return {
      get: (key) => this.makeAPICall('storage.get', [key]),
      set: (key, value) => this.makeAPICall('storage.set', [key, value]),
      delete: (key) => this.makeAPICall('storage.delete', [key])
    };
  }

  // File system API
  get fs() {
    return {
      readFile: (path) => this.makeAPICall('fs.readFile', [path]),
      writeFile: (path, content) => this.makeAPICall('fs.writeFile', [path, content]),
      exists: (path) => this.makeAPICall('fs.exists', [path]),
      glob: (pattern) => this.makeAPICall('fs.glob', [pattern])
    };
  }

  // Execute command
  async exec(command) {
    return this.makeAPICall('exec', [command]);
  }

  // Logging
  log(level, message, ...args) {
    return this.makeAPICall('log', [level, message, ...args]);
  }

  // Plugin communication
  sendMessage(plugin, data) {
    return this.makeAPICall('plugin.sendMessage', [plugin, data]);
  }

  onMessage(callback) {
    return this.makeAPICall('plugin.onMessage', [callback.toString()]);
  }

  getPlugin(name) {
    return this.makeAPICall('plugin.get', [name]);
  }
}

/**
 * Main worker execution function
 */
async function executePlugin() {
  try {
    const { executionId, plugin: serializedPlugin, method, args, config } = workerData;
    
    // Parse the plugin
    const pluginData = JSON.parse(serializedPlugin);
    
    // Create sandboxed API and secure parser
    const api = new SandboxedPluginAPI(executionId);
    const secureParser = new SecureFunctionParser();
    
    // Handle API responses from main thread
    parentPort.on('message', (message) => {
      if (message.id && message.id.startsWith(executionId)) {
        api.handleAPIResponse(message);
      }
    });

    // Securely reconstruct plugin functions - NO MORE EVAL!
    const plugin = {
      ...pluginData,
      init: pluginData.init ? secureParser.parseFunction(pluginData.init) : undefined,
      activate: pluginData.activate ? secureParser.parseFunction(pluginData.activate) : undefined,
      deactivate: pluginData.deactivate ? secureParser.parseFunction(pluginData.deactivate) : undefined,
      dispose: pluginData.dispose ? secureParser.parseFunction(pluginData.dispose) : undefined,
      execute: pluginData.execute ? secureParser.parseFunction(pluginData.execute) : undefined,
      hooks: pluginData.hooks ? Object.fromEntries(
        Object.entries(pluginData.hooks).map(([key, fnStr]) => [key, secureParser.parseFunction(fnStr)])
      ) : undefined
    };

    // Execute the specified method
    let result;
    
    switch (method) {
      case 'init':
        if (plugin.init) {
          result = await plugin.init(api, plugin.defaultConfig);
        }
        break;
        
      case 'activate':
        if (plugin.activate) {
          result = await plugin.activate();
        }
        break;
        
      case 'execute':
        if (plugin.execute) {
          result = await plugin.execute(args[0]);
        }
        break;
        
      case 'deactivate':
        if (plugin.deactivate) {
          result = await plugin.deactivate();
        }
        break;
        
      case 'dispose':
        if (plugin.dispose) {
          result = await plugin.dispose();
        }
        break;
        
      default:
        if (plugin.hooks && plugin.hooks[method]) {
          result = await plugin.hooks[method](args[0]);
        } else {
          throw new Error(`Unknown plugin method: ${method}`);
        }
    }

    // Send result back to main thread
    parentPort.postMessage({
      type: 'result',
      id: executionId,
      data: result
    });
    
  } catch (error) {
    // Send error back to main thread
    parentPort.postMessage({
      type: 'error',
      id: workerData.executionId,
      data: error.message
    });
  }
}

// Global error handlers
process.on('uncaughtException', (error) => {
  parentPort.postMessage({
    type: 'error',
    id: workerData.executionId,
    data: `Uncaught exception: ${error.message}`
  });
});

process.on('unhandledRejection', (reason) => {
  parentPort.postMessage({
    type: 'error',
    id: workerData.executionId,
    data: `Unhandled rejection: ${reason}`
  });
});

// Start execution
executePlugin();