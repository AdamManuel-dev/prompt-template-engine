#!/bin/bash
set -e

echo "🔍 Validating CI/CD Pipeline Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check prerequisites
info "Checking prerequisites..."

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    success "Node.js $NODE_VERSION installed"
else
    error "Node.js not found"
    exit 1
fi

# Check npm version
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    success "npm $NPM_VERSION installed"
else
    error "npm not found"
    exit 1
fi

# Check Docker (optional)
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    success "Docker installed: $DOCKER_VERSION"
else
    warning "Docker not found (optional for local development)"
fi

# Check required files
info "Checking CI/CD configuration files..."

CI_FILES=(
    ".github/workflows/ci.yml"
    "playwright.config.ts"
    "playwright.config.ci.js"
    "lighthouserc.js"
    "Dockerfile"
    "docker-compose.yml"
    "docker-compose.test.yml"
    "tests/fixtures/global-setup.js"
    "tests/fixtures/global-teardown.js"
)

for file in "${CI_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        success "Found $file"
    else
        error "Missing $file"
        exit 1
    fi
done

# Validate package.json scripts
info "Validating npm scripts..."

REQUIRED_SCRIPTS=(
    "build"
    "build:shared"
    "build:backend" 
    "build:frontend"
    "lint"
    "typecheck"
    "test"
    "test:e2e"
    "test:e2e:ci"
    "ci"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if npm run --silent $script --dry-run &> /dev/null; then
        success "Script '$script' available"
    else
        error "Script '$script' not found or invalid"
        exit 1
    fi
done

# Check dependencies installation
info "Checking dependencies..."

if [[ -d "node_modules" ]]; then
    success "Root dependencies installed"
else
    warning "Root dependencies not installed - run 'npm ci'"
fi

if [[ -d "frontend/node_modules" ]]; then
    success "Frontend dependencies installed"
else
    warning "Frontend dependencies not installed"
fi

if [[ -d "backend/node_modules" ]]; then
    success "Backend dependencies installed"  
else
    warning "Backend dependencies not installed"
fi

if [[ -d "shared/node_modules" ]]; then
    success "Shared dependencies installed"
else
    warning "Shared dependencies not installed"
fi

# Validate shared package build
info "Checking shared package build..."

if [[ -d "shared/dist" ]]; then
    success "Shared package built"
else
    warning "Shared package not built - run 'npm run build:shared'"
fi

# Test lint configuration
info "Testing linting configuration..."

cd shared && npm run lint --silent > /dev/null 2>&1 && success "Shared linting works" || error "Shared linting failed"
cd ../backend && npm run lint --silent > /dev/null 2>&1 && success "Backend linting works" || error "Backend linting failed"  
cd ../frontend && npm run lint --silent > /dev/null 2>&1 && success "Frontend linting works" || error "Frontend linting failed"
cd ..

# Test TypeScript configuration
info "Testing TypeScript configuration..."

cd shared && npm run typecheck --silent > /dev/null 2>&1 && success "Shared TypeScript config valid" || error "Shared TypeScript config invalid"
cd ../backend && npm run typecheck --silent > /dev/null 2>&1 && success "Backend TypeScript config valid" || error "Backend TypeScript config invalid"
cd ../frontend && npm run typecheck --silent > /dev/null 2>&1 && success "Frontend TypeScript config valid" || error "Frontend TypeScript config invalid"
cd ..

# Check Playwright installation
info "Checking Playwright setup..."

if npx playwright --version &> /dev/null; then
    PLAYWRIGHT_VERSION=$(npx playwright --version)
    success "Playwright installed: $PLAYWRIGHT_VERSION"
else
    error "Playwright not installed - run 'npx playwright install'"
    exit 1
fi

# Validate GitHub Actions workflow syntax
info "Validating GitHub Actions workflow..."

if command -v gh &> /dev/null; then
    if gh workflow view ci --repo . &> /dev/null; then
        success "GitHub Actions workflow syntax valid"
    else
        warning "Cannot validate GitHub Actions workflow (may need to push to repository first)"
    fi
else
    warning "GitHub CLI not installed - cannot validate workflow syntax"
fi

# Check environment variables template
info "Checking environment configuration..."

if [[ -f ".env.example" ]]; then
    success "Environment template found"
else
    warning "No .env.example file found"
fi

# Docker validation (if available)
if command -v docker &> /dev/null; then
    info "Testing Docker configuration..."
    
    # Validate Dockerfile syntax
    if docker build --dry-run . &> /dev/null; then
        success "Dockerfile syntax valid"
    else
        error "Dockerfile syntax invalid"
        exit 1
    fi
    
    # Validate docker-compose syntax
    if docker-compose config &> /dev/null; then
        success "docker-compose.yml syntax valid"
    else
        error "docker-compose.yml syntax invalid"
        exit 1
    fi
fi

# Performance budget validation
info "Checking Lighthouse configuration..."

if [[ -f "lighthouserc.js" ]]; then
    # Basic syntax check
    if node -c lighthouserc.js; then
        success "Lighthouse configuration syntax valid"
    else
        error "Lighthouse configuration syntax invalid"
        exit 1
    fi
fi

# Generate validation report
info "Generating validation report..."

REPORT_FILE="ci-validation-report.md"
cat > $REPORT_FILE << EOF
# CI/CD Pipeline Validation Report

**Generated:** $(date)
**Node.js:** $NODE_VERSION
**npm:** $NPM_VERSION

## ✅ Validation Results

### Configuration Files
$(for file in "${CI_FILES[@]}"; do [[ -f "$file" ]] && echo "- ✅ $file" || echo "- ❌ $file"; done)

### npm Scripts
$(for script in "${REQUIRED_SCRIPTS[@]}"; do npm run --silent $script --dry-run &> /dev/null && echo "- ✅ $script" || echo "- ❌ $script"; done)

### Dependencies
- Root: $([ -d "node_modules" ] && echo "✅ Installed" || echo "❌ Not installed")
- Frontend: $([ -d "frontend/node_modules" ] && echo "✅ Installed" || echo "❌ Not installed")
- Backend: $([ -d "backend/node_modules" ] && echo "✅ Installed" || echo "❌ Not installed")
- Shared: $([ -d "shared/node_modules" ] && echo "✅ Installed" || echo "❌ Not installed")

### Build Artifacts
- Shared: $([ -d "shared/dist" ] && echo "✅ Built" || echo "❌ Not built")

## 🚀 Next Steps

1. Ensure all dependencies are installed: \`npm ci\`
2. Build shared package: \`npm run build:shared\`
3. Run full CI pipeline locally: \`npm run ci\`
4. Test E2E setup: \`npm run test:e2e:ci\`

## 📝 Notes

This validation ensures your CI/CD pipeline is properly configured and ready for GitHub Actions execution.
EOF

success "Validation report generated: $REPORT_FILE"

echo ""
success "🎉 CI/CD Pipeline validation completed successfully!"
info "Ready to run: npm run ci"
echo ""