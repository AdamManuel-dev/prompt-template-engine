/**
 * Add detailed logging to understand what's happening
 */

const tsNode = require('ts-node');
tsNode.register({
  compilerOptions: {
    target: 'ES2022',
    module: 'commonjs',
    esModuleInterop: true,
    skipLibCheck: true
  }
});

// Let's temporarily modify the template engine to add logging
const fs = require('fs');
const path = require('path');

// Read the current template engine file
const enginePath = './src/core/template-engine.ts';
const originalContent = fs.readFileSync(enginePath, 'utf8');

// Add console.log statements to the processEnhancedNestedHelpers method
const modifiedContent = originalContent.replace(
  'private processEnhancedNestedHelpers(',
  `private processEnhancedNestedHelpers(`
).replace(
  'let result = argsString;',
  `console.log('processEnhancedNestedHelpers called with:', argsString);
    let result = argsString;`
).replace(
  'const functionCallMatches = this.findFunctionCallMatches(result, helperNames);',
  `console.log('Looking for function calls in:', result);
    const functionCallMatches = this.findFunctionCallMatches(result, helperNames);
    console.log('Found function call matches:', functionCallMatches);`
);

// Write the modified content to a temporary file
const tempEnginePath = './temp-debug-template-engine.ts';
fs.writeFileSync(tempEnginePath, modifiedContent);

// Now import and test
try {
  const { TemplateEngine } = require('./temp-debug-template-engine.ts');
  
  async function debugDetailed() {
    console.log('=== Detailed Debug with Logging ===\n');
    
    const engine = new TemplateEngine();
    
    console.log('Testing nested function call...');
    const result = await engine.render('{{uppercase(capitalize(name))}}', { name: 'john doe' });
    console.log('Final result:', result);
    
    console.log('\\n=== Debug Complete ===');
  }
  
  debugDetailed().catch(console.error).finally(() => {
    // Cleanup
    try {
      fs.unlinkSync(tempEnginePath);
    } catch (e) {
      // Ignore cleanup errors
    }
  });
  
} catch (error) {
  console.error('Error:', error.message);
  // Cleanup
  try {
    fs.unlinkSync(tempEnginePath);
  } catch (e) {
    // Ignore cleanup errors
  }
}