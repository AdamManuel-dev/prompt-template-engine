/**
 * Test the enhanced nested helper implementation
 */

// Mock the new functions to test them
function mockHelpers() {
  const helpers = new Map([
    ['uppercase', (str) => String(str || '').toUpperCase()],
    ['capitalize', (str) => {
      const s = String(str || '');
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    }],
    ['add', (a, b) => Number(a || 0) + Number(b || 0)],
    ['multiply', (a, b) => Number(a || 0) * Number(b || 0)],
    ['length', (str) => String(str || '').length],
    ['first', (arr) => Array.isArray(arr) ? arr[0] : undefined]
  ]);
  
  return {
    has: (name) => helpers.has(name),
    getHelperNames: () => Array.from(helpers.keys()),
    execute: (name, ...args) => {
      const helper = helpers.get(name);
      if (!helper) throw new Error(`Helper ${name} not found`);
      return helper(...args);
    }
  };
}

function mockResolveVariable(key, context) {
  const keys = key.split('.');
  let value = context;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }
  return value;
}

function mockParseHelperArgs(argsString, context) {
  if (!argsString) return [];
  
  const args = [];
  const parts = argsString.split(/\\s+/);
  
  for (const part of parts) {
    // Check if it's a number
    if (/^-?\\d+(\\.\\d+)?$/.test(part)) {
      args.push(Number(part));
    } 
    // Check if it's a quoted string
    else if ((part.startsWith('"') && part.endsWith('"')) || 
             (part.startsWith("'") && part.endsWith("'"))) {
      args.push(part.slice(1, -1));
    }
    // Check if it's a boolean or null
    else if (part === 'true') args.push(true);
    else if (part === 'false') args.push(false);
    else if (part === 'null') args.push(null);
    else if (part === 'undefined') args.push(undefined);
    // Try to resolve from context
    else {
      const value = mockResolveVariable(part, context);
      args.push(value !== undefined ? value : part);
    }
  }
  
  return args;
}

// Test the findHelperExpressions function logic
function testFindHelperExpressions() {
  console.log('=== Testing findHelperExpressions logic ===\n');
  
  const helperNames = 'uppercase|capitalize|add|multiply|length|first';
  const testCases = [
    '{{uppercase(capitalize(name))}}',
    '{{add(multiply(x 2) 3)}}',
    '{{length(name)}}',
    '{{capitalize name}}',
    '{{add x y}}'
  ];
  
  testCases.forEach(template => {
    console.log(`Testing: "${template}"`);
    
    const helperBlockPattern = new RegExp(`\\{\\{\\s*(${helperNames})([^}]*)\\}\\}`, 'g');
    let match;
    
    while ((match = helperBlockPattern.exec(template)) !== null) {
      const helperName = match[1];
      const content = match[2].trim();
      
      let args = '';
      
      if (content) {
        if (content.startsWith('(') && content.endsWith(')')) {
          args = content.slice(1, -1);
          console.log(`  Function call: helper="${helperName}", args="${args}"`);
        } else if (!content.startsWith('(')) {
          args = content;
          console.log(`  Traditional: helper="${helperName}", args="${args}"`);
        } else {
          console.log(`  Malformed: ${content}`);
        }
      } else {
        console.log(`  No args: helper="${helperName}"`);
      }
    }
  });
}

// Test the nested helper call finder
function testFindNestedHelperCalls() {
  console.log('\n=== Testing findNestedHelperCalls logic ===\n');
  
  const helperNames = ['uppercase', 'capitalize', 'add', 'multiply', 'length', 'first'];
  
  function findNestedHelperCalls(text) {
    const matches = [];
    
    for (let i = 0; i < text.length; i++) {
      // Check for (helperName pattern
      if (text[i] === '(') {
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) j++;
        
        const nameStart = j;
        while (j < text.length && /[a-zA-Z]/.test(text[j])) j++;
        const helperName = text.substring(nameStart, j);
        
        if (helperNames.includes(helperName)) {
          let depth = 1;
          let k = j;
          while (k < text.length && depth > 0) {
            if (text[k] === '(') depth++;
            else if (text[k] === ')') depth--;
            k++;
          }
          
          if (depth === 0) {
            const argsContent = text.substring(j, k - 1).trim();
            matches.push({
              helperName,
              args: argsContent,
              start: i,
              end: k,
              full: text.substring(i, k)
            });
          }
        }
      }
      
      // Check for helperName( pattern
      if (/[a-zA-Z]/.test(text[i])) {
        let j = i;
        while (j < text.length && /[a-zA-Z]/.test(text[j])) j++;
        const helperName = text.substring(i, j);
        
        if (helperNames.includes(helperName) && j < text.length && text[j] === '(') {
          let depth = 1;
          let k = j + 1;
          while (k < text.length && depth > 0) {
            if (text[k] === '(') depth++;
            else if (text[k] === ')') depth--;
            k++;
          }
          
          if (depth === 0) {
            const argsContent = text.substring(j + 1, k - 1);
            matches.push({
              helperName,
              args: argsContent,
              start: i,
              end: k,
              full: text.substring(i, k)
            });
            i = k - 1;
          }
        }
      }
    }
    
    return matches;
  }
  
  const testCases = [
    'capitalize(name)',
    'multiply(x 2)',
    'add(multiply(x 2) 3)',
    'uppercase(capitalize(name))',
    '(capitalize name)',
    'add(x (multiply y 2))'
  ];
  
  testCases.forEach(testCase => {
    console.log(`\nTesting: "${testCase}"`);
    const matches = findNestedHelperCalls(testCase);
    matches.forEach(match => {
      console.log(`  Found: ${match.helperName}("${match.args}") at ${match.start}-${match.end}`);
    });
  });
}

testFindHelperExpressions();
testFindNestedHelperCalls();