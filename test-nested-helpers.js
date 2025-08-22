/**
 * Test script to understand current nested helper support
 */

const { TemplateEngine } = require('./dist/core/template-engine.js');

async function testNestedHelpers() {
  const engine = new TemplateEngine();
  const context = { x: 10, y: 6, name: 'john doe', items: ['apple', 'banana'] };

  console.log('=== Testing Current Nested Helper Support ===\n');

  // Test current working pattern
  try {
    const result1 = await engine.render('{{add (multiply x 2) (divide y 2)}}', context);
    console.log('✓ Current pattern works: {{add (multiply x 2) (divide y 2)}} =', result1);
  } catch (error) {
    console.log('✗ Current pattern failed:', error.message);
  }

  // Test desired pattern 1
  try {
    const result2 = await engine.render('{{add(multiply(x 2) divide(y 2))}}', context);
    console.log('✓ Desired pattern 1 works: {{add(multiply(x 2) divide(y 2))}} =', result2);
  } catch (error) {
    console.log('✗ Desired pattern 1 failed:', error.message);
  }

  // Test desired pattern 2
  try {
    const result3 = await engine.render('{{uppercase(capitalize(name))}}', context);
    console.log('✓ Desired pattern 2 works: {{uppercase(capitalize(name))}} =', result3);
  } catch (error) {
    console.log('✗ Desired pattern 2 failed:', error.message);
  }

  // Test deeper nesting
  try {
    const result4 = await engine.render('{{add(multiply(add(x 1) 2) divide(y 2))}}', context);
    console.log('✓ Deep nesting works: {{add(multiply(add(x 1) 2) divide(y 2))}} =', result4);
  } catch (error) {
    console.log('✗ Deep nesting failed:', error.message);
  }

  // Test mixed patterns
  try {
    const result5 = await engine.render('{{length(uppercase(first(items)))}}', context);
    console.log('✓ Mixed pattern works: {{length(uppercase(first(items)))}} =', result5);
  } catch (error) {
    console.log('✗ Mixed pattern failed:', error.message);
  }
}

testNestedHelpers().catch(console.error);