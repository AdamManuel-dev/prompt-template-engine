/**
 * Verify that the nested helper implementation works
 * Uses ts-node to run TypeScript directly
 */

// Check if ts-node is available
let tsNode;
try {
  tsNode = require('ts-node');
} catch (e) {
  console.error('ts-node not available. Installing...');
  require('child_process').execSync('npm install --no-save ts-node', { stdio: 'inherit' });
  tsNode = require('ts-node');
}

// Configure ts-node
tsNode.register({
  compilerOptions: {
    target: 'ES2022',
    module: 'commonjs',
    esModuleInterop: true,
    skipLibCheck: true
  }
});

// Now we can import TypeScript files directly
const { TemplateEngine } = require('./src/core/template-engine.ts');

async function verifyNestedHelpers() {
  console.log('=== Verifying Nested Helper Implementation ===\n');
  
  const engine = new TemplateEngine();
  
  const testCases = [
    // Basic nested function calls
    {
      name: 'Simple string nesting',
      template: '{{uppercase(capitalize(name))}}',
      context: { name: 'john doe' },
      expected: 'JOHN DOE'
    },
    
    // Arithmetic nesting
    {
      name: 'Nested arithmetic', 
      template: '{{add(multiply(x 2) 3)}}',
      context: { x: 5 },
      expected: '13' // (5 * 2) + 3 = 13
    },
    
    // String length
    {
      name: 'String length of uppercase',
      template: '{{length(uppercase(name))}}',
      context: { name: 'test' },
      expected: '4'
    },
    
    // Array operations
    {
      name: 'Array first element uppercase',
      template: '{{uppercase(first(items))}}',
      context: { items: ['hello', 'world'] },
      expected: 'HELLO'
    },
    
    // Deep nesting
    {
      name: 'Deep nesting',
      template: '{{add(multiply(add(x 1) 2) 3)}}',
      context: { x: 5 },
      expected: '27' // ((5 + 1) * 2) + 3 = 15
    },
    
    // Traditional syntax should still work
    {
      name: 'Traditional syntax',
      template: '{{add (multiply x 2) 3}}',
      context: { x: 5 },
      expected: '13'
    },
    
    // Mixed syntax
    {
      name: 'Mixed syntax',
      template: '{{add(multiply x 2) (divide y 2)}}',
      context: { x: 5, y: 10 },
      expected: '15' // (5 * 2) + (10 / 2) = 15
    },
    
    // Complex real-world example
    {
      name: 'User profile formatting',
      template: 'Welcome {{uppercase(default(capitalize(user.firstName) "Guest"))}}!',
      context: { user: { firstName: 'alice' } },
      expected: 'Welcome ALICE!'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    try {
      const result = await engine.render(test.template, test.context);
      if (result === test.expected) {
        console.log(`✓ ${test.name}`);
        console.log(`  Template: ${test.template}`);
        console.log(`  Result: "${result}"`);
        passed++;
      } else {
        console.log(`✗ ${test.name}`);
        console.log(`  Template: ${test.template}`);
        console.log(`  Expected: "${test.expected}"`);
        console.log(`  Got: "${result}"`);
        failed++;
      }
    } catch (error) {
      console.log(`✗ ${test.name} (ERROR)`);
      console.log(`  Template: ${test.template}`);
      console.log(`  Error: ${error.message}`);
      failed++;
    }
    console.log('');
  }
  
  console.log(`\n=== Results ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Nested helper expressions are working correctly.');
    console.log('✓ Implementation supports both function call syntax: {{helper(arg)}}');
    console.log('✓ Implementation supports traditional syntax: {{helper arg}}');
    console.log('✓ Implementation supports mixed syntax');
    console.log('✓ Implementation supports deep nesting');
    console.log('✓ Implementation maintains backward compatibility');
  } else {
    console.log(`\n⚠️ ${failed} test(s) failed. Implementation needs adjustment.`);
  }
  
  return failed === 0;
}

// Run verification
verifyNestedHelpers()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Verification failed with error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  });