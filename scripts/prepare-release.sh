#!/bin/bash
# Release preparation script for Cursor Prompt Template Engine

set -e

echo "🚀 Preparing release for Cursor Prompt Template Engine"

# Check if version argument is provided
if [ -z "$1" ]; then
  echo "❌ Error: Version number required"
  echo "Usage: ./scripts/prepare-release.sh <version> [patch|minor|major]"
  exit 1
fi

VERSION_TYPE=${2:-patch}
NEW_VERSION=$1

echo "📦 Updating version to $NEW_VERSION (type: $VERSION_TYPE)"

# Update main package.json
npm version $NEW_VERSION --no-git-tag-version

# Update VS Code extension package.json
cd vscode-extension
npm version $NEW_VERSION --no-git-tag-version
cd ..

echo "✅ Version updated in package.json files"

# Run quality checks
echo "🧪 Running quality checks..."
npm run type-check:strict
npm run lint
npm test

echo "✅ All quality checks passed"

# Build packages
echo "📦 Building packages..."
npm run build

# Build VS Code extension
echo "📦 Building VS Code extension..."
cd vscode-extension
npm install
npm run package
cd ..

echo "✅ Packages built successfully"

# Create changelog entry
echo "📝 Updating CHANGELOG.md..."
if [ ! -f CHANGELOG.md ]; then
  cat > CHANGELOG.md << EOF
# Changelog

All notable changes to Cursor Prompt Template Engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

EOF
fi

# Add new version section to changelog
CHANGELOG_ENTRY="## [$NEW_VERSION] - $(date +%Y-%m-%d)

### Added
- VS Code extension packaging
- npm package distribution
- CLI commands for template management
- Cursor IDE integration with rules synchronization

### Changed
- Updated dependencies

### Fixed
- Various bug fixes and improvements

"

# Prepend to changelog after header
awk '/^## \[/ && !done {print "'"$CHANGELOG_ENTRY"'"; done=1} 1' CHANGELOG.md > CHANGELOG.tmp && mv CHANGELOG.tmp CHANGELOG.md

echo "✅ CHANGELOG.md updated"

# Create git commit
echo "📝 Creating git commit..."
git add -A
git commit -m "chore: prepare release v$NEW_VERSION

- Update version to $NEW_VERSION
- Update CHANGELOG.md
- Build packages for distribution"

# Create git tag
echo "🏷️  Creating git tag..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo "✅ Git commit and tag created"

echo ""
echo "🎉 Release preparation complete!"
echo ""
echo "Next steps:"
echo "1. Review the changes: git log -1 --stat"
echo "2. Push to remote: git push && git push --tags"
echo "3. Create GitHub release: https://github.com/AdamManuel-dev/cursor-prompt-template-engine/releases/new"
echo "4. The CI/CD pipeline will automatically publish to npm and VS Code Marketplace"
echo ""
echo "Manual publishing (if needed):"
echo "  - npm: npm publish"
echo "  - VS Code: cd vscode-extension && vsce publish"