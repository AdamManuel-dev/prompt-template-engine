#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

// Get all files with $2 artifacts
const files = execSync('find src/ -name "*.ts" -exec grep -l "\\$2" {} \;', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix common environment variable patterns
  content = content.replace(/([A-Z_]+)\['\$2'\]/g, "process.env['$1']");
  
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Fixed: ${file}`);
}
