#!/bin/bash

# Script to fix remaining TypeScript TS4111 errors
# Comprehensive fix for all remaining index signature issues

echo "Fixing remaining TypeScript index signature property access errors..."

# Fix auto-optimize.ts flags access
echo "Fixing src/cli/flags/auto-optimize.ts..."
sed -i '' "s/flags\.autoOptimize/flags['autoOptimize']/g" src/cli/flags/auto-optimize.ts
sed -i '' "s/flags\.noNotifications/flags['noNotifications']/g" src/cli/flags/auto-optimize.ts
sed -i '' "s/flags\.maxConcurrent/flags['maxConcurrent']/g" src/cli/flags/auto-optimize.ts
sed -i '' "s/flags\.autoOptimizeConfidence/flags['autoOptimizeConfidence']/g" src/cli/flags/auto-optimize.ts
sed -i '' "s/flags\.autoOptimizeModels/flags['autoOptimizeModels']/g" src/cli/flags/auto-optimize.ts

# Fix other common patterns
FILES=$(find . -name "*.ts" -not -path "./node_modules/*" -not -path "./dist/*" -not -path "./web-portal/node_modules/*")

for file in $FILES; do
  # Fix metrics.recentErrors pattern
  if grep -q "metrics\.recentErrors" "$file"; then
    echo "Fixing $file - metrics.recentErrors..."
    sed -i '' "s/metrics\.recentErrors/metrics['recentErrors']/g" "$file"
  fi
  
  # Fix other index signature patterns
  if grep -q "\.npm_" "$file"; then
    echo "Fixing $file - npm_ properties..."
    sed -i '' "s/\.npm_\([a-zA-Z_]*\)/['npm_\1']/g" "$file"
  fi
done

echo "Running type check to see remaining TS4111 errors..."
npm run type-check 2>&1 | grep "error TS4111" | wc -l | xargs -I {} echo "Remaining TS4111 errors: {}"