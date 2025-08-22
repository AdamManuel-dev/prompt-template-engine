/**
 * Manual test to verify nested helper functionality works
 * This bypasses Jest configuration issues and tests the core functionality directly
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Simple compilation and test approach
async function testNestedHelpers() {
  console.log('=== Manual Test: Nested Helper Expressions ===\n');

  try {
    // First, let's just compile the TypeScript to test it works
    console.log('1. Compiling TypeScript...');
    execSync('npx tsc src/core/template-helpers.ts src/core/template-engine.ts --target ES2022 --module commonjs --outDir ./temp-test --esModuleInterop --skipLibCheck --lib ES2022', {stdio: 'pipe'});
    
    console.log('✓ TypeScript compilation successful\n');

    // Now let's create a simple runtime test
    const testCode = `
const fs = require('fs');

// Import the compiled classes
const { TemplateHelpers } = require('./temp-test/core/template-helpers.js');  
const { TemplateEngine } = require('./temp-test/core/template-engine.js');

async function runTests() {
  console.log('2. Testing nested helper functionality...');
  
  const engine = new TemplateEngine();
  
  // Test cases
  const testCases = [
    {
      name: 'Simple nested function call',
      template: '{{uppercase(capitalize(name))}}',
      context: { name: 'john doe' },
      expected: 'JOHN DOE'
    },
    {
      name: 'Nested arithmetic',
      template: '{{add(multiply(x 2) 3)}}',
      context: { x: 5 },
      expected: '13' // (5 * 2) + 3 = 13
    },
    {
      name: 'String operations',
      template: '{{length(uppercase(name))}}',
      context: { name: 'test' },
      expected: '4'
    },
    {
      name: 'Array operations', 
      template: '{{uppercase(first(items))}}',
      context: { items: ['hello', 'world'] },
      expected: 'HELLO'
    },
    {
      name: 'Traditional syntax (should still work)',
      template: '{{add (multiply x 2) 3}}',
      context: { x: 5 },
      expected: '13'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    try {
      const result = await engine.render(test.template, test.context);
      if (result === test.expected) {
        console.log(\`✓ \${test.name}: "\${test.template}" -> "\${result}"\`);
        passed++;
      } else {
        console.log(\`✗ \${test.name}: "\${test.template}" -> Expected "\${test.expected}", got "\${result}"\`);
        failed++;
      }
    } catch (error) {
      console.log(\`✗ \${test.name}: Error - \${error.message}\`);
      failed++;
    }
  }
  
  console.log(\`\\n3. Test Results: \${passed} passed, \${failed} failed\`);
  
  if (failed === 0) {
    console.log('\\n🎉 All tests passed! Nested helper expressions are working correctly.');
  } else {
    console.log(\`\\n⚠️  Some tests failed. Need to fix implementation.\`);
  }
}

runTests().catch(console.error);
`;

    // Write and run the test
    fs.writeFileSync('run-nested-test.js', testCode);
    execSync('node run-nested-test.js', {stdio: 'inherit'});

    // Cleanup
    fs.unlinkSync('run-nested-test.js');
    execSync('rm -rf temp-test', {stdio: 'pipe'});
    
    console.log('\n✓ Manual test completed successfully');
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    console.error('\nFull error:', error.toString());
    
    // Try to cleanup on error
    try {
      if (fs.existsSync('run-nested-test.js')) fs.unlinkSync('run-nested-test.js');
      execSync('rm -rf temp-test', {stdio: 'pipe'});
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

testNestedHelpers();