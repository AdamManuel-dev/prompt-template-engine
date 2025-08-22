/**
 * Simple test to understand current nested helper support
 */

const fs = require('fs');

// Test the current regex patterns
function testCurrentPatterns() {
  console.log('=== Testing Current Nested Helper Patterns ===\n');

  const testExpressions = [
    // Current working pattern (space-separated with parentheses)
    '{{add (multiply x 2) (divide y 2)}}',
    
    // Desired pattern (function call style)
    '{{add(multiply(x 2) divide(y 2))}}',
    '{{uppercase(capitalize(name))}}',
    '{{length(uppercase(first(items)))}}',
    
    // Mixed patterns
    '{{eq(length(name) 8)}}',
    '{{add(x multiply(y 2))}}',
  ];

  // Current nested helper pattern from the code
  const nestedHelperPattern = /\(([a-zA-Z]+)(?:\s+([^)]+))?\)/g;
  
  // Current helper pattern from the code 
  const helperNames = ['add', 'multiply', 'divide', 'uppercase', 'capitalize', 'length', 'first', 'eq'];
  const helperRegex = new RegExp(
    `\\{\\{\\s*(${helperNames.join('|')})(?:\\s+([^}]+))?\\s*\\}\\}`,
    'g'
  );

  testExpressions.forEach(expr => {
    console.log(`\nTesting: ${expr}`);
    
    // Test main helper regex
    helperRegex.lastIndex = 0;
    const mainMatch = helperRegex.exec(expr);
    if (mainMatch) {
      console.log(`  Main match: ${mainMatch[1]} with args: "${mainMatch[2]}"`);
      
      // Test nested helper regex on args
      if (mainMatch[2]) {
        nestedHelperPattern.lastIndex = 0;
        let nestedMatch;
        const nestedMatches = [];
        while ((nestedMatch = nestedHelperPattern.exec(mainMatch[2])) !== null) {
          nestedMatches.push({
            helper: nestedMatch[1],
            args: nestedMatch[2] || '',
            full: nestedMatch[0]
          });
        }
        if (nestedMatches.length > 0) {
          console.log(`  Nested matches:`, nestedMatches);
        } else {
          console.log(`  No nested matches found in args`);
        }
      }
    } else {
      console.log(`  No main helper match`);
    }
  });
}

testCurrentPatterns();