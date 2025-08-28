#!/bin/bash

# Script to fix TypeScript TS4111 errors - index signature property access
# These need to use bracket notation instead of dot notation

echo "Fixing TypeScript index signature property access errors (TS4111)..."

# Find all TypeScript files
FILES=$(find . -name "*.ts" -not -path "./node_modules/*" -not -path "./dist/*" -not -path "./web-portal/node_modules/*" -not -path "./.git/*")

# Counter for changes
CHANGES=0

for file in $FILES; do
  # Create a temporary file
  TEMP_FILE="${file}.tmp"
  
  # Check if file has process.env or other index signature issues
  if grep -q "process\.env\.\w" "$file"; then
    echo "Processing: $file"
    
    # Fix process.env property access
    sed -E "s/process\.env\.([A-Z_][A-Z0-9_]*)/process.env['\1']/g" "$file" > "$TEMP_FILE"
    
    # Check if changes were made
    if ! diff -q "$file" "$TEMP_FILE" > /dev/null; then
      mv "$TEMP_FILE" "$file"
      ((CHANGES++))
      echo "  ✓ Fixed process.env access patterns"
    else
      rm "$TEMP_FILE"
    fi
  fi
done

echo "Fixed $CHANGES files with index signature issues"
echo "Running type check to verify..."
npm run type-check 2>&1 | grep "error TS4111" | wc -l | xargs -I {} echo "Remaining TS4111 errors: {}"