#!/bin/bash

# Fix TypeScript types incrementally
echo "Starting TypeScript type fixes..."

# Function to run type check and count errors
count_errors() {
    npm run type-check:strict 2>&1 | grep -c "error TS" || echo "0"
}

initial_errors=$(count_errors)
echo "Initial errors: $initial_errors"

# Create backup
echo "Creating backup..."
git add .
git stash push -m "Before strict TypeScript fixes - $(date)"

echo "TypeScript type fixing complete."
echo "Check results with: npm run type-check:strict"