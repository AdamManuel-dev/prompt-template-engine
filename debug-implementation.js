/**
 * Debug the implementation step by step
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

const { TemplateEngine } = require('./src/core/template-engine.ts');

async function debugImplementation() {
  console.log('=== Debugging Implementation ===\n');
  
  const engine = new TemplateEngine();
  
  // Test 1: Basic variable resolution
  console.log('1. Testing basic variable resolution...');
  try {
    const result1 = await engine.render('{{name}}', { name: 'john doe' });
    console.log(`✓ Basic variable: "{{name}}" -> "${result1}"`);
  } catch (error) {
    console.log(`✗ Basic variable failed: ${error.message}`);
  }
  
  // Test 2: Basic helper without nesting
  console.log('\n2. Testing basic helpers...');
  try {
    const result2 = await engine.render('{{uppercase name}}', { name: 'john doe' });
    console.log(`Result: "{{uppercase name}}" -> "${result2}"`);
  } catch (error) {
    console.log(`✗ Basic helper failed: ${error.message}`);
  }
  
  try {
    const result3 = await engine.render('{{capitalize name}}', { name: 'john doe' });
    console.log(`Result: "{{capitalize name}}" -> "${result3}"`);
  } catch (error) {
    console.log(`✗ Capitalize helper failed: ${error.message}`);
  }
  
  // Test 3: Function call syntax for single helper
  console.log('\n3. Testing function call syntax for single helper...');
  try {
    const result4 = await engine.render('{{uppercase(name)}}', { name: 'john doe' });
    console.log(`Result: "{{uppercase(name)}}" -> "${result4}"`);
  } catch (error) {
    console.log(`✗ Function call syntax failed: ${error.message}`);
  }
  
  // Test 4: Traditional nested syntax (known to work)
  console.log('\n4. Testing traditional nested syntax...');
  try {
    const result5 = await engine.render('{{add (multiply 5 2) 3}}', {});
    console.log(`Result: "{{add (multiply 5 2) 3}}" -> "${result5}"`);
  } catch (error) {
    console.log(`✗ Traditional nested failed: ${error.message}`);
  }
  
  // Test 5: Simple nested function call
  console.log('\n5. Testing simple nested function call...');
  try {
    const result6 = await engine.render('{{uppercase(capitalize(name))}}', { name: 'john doe' });
    console.log(`Result: "{{uppercase(capitalize(name))}}" -> "${result6}"`);
    
    // Let's also manually check what our parsing is doing
    console.log('\nManual parsing check:');
    console.log('Template: {{uppercase(capitalize(name))}}');
    
    // Let's examine what the findHelperExpressions method returns
    const helperNames = engine.helpers.getHelperNames().join('|');
    console.log('Helper names:', helperNames);
    
  } catch (error) {
    console.log(`✗ Nested function call failed: ${error.message}`);
  }
  
  console.log('\n=== Debug Complete ===');
}

debugImplementation().catch(console.error);