# CI/CD Pipeline Documentation

## Overview

This document describes the comprehensive CI/CD pipeline implemented for the Cursor Prompt Web Portal, featuring automated testing, quality gates, security scanning, and deployment workflows.

## 🏗️ Pipeline Architecture

### Quality Gates
1. **Setup & Dependencies** - Caching and workspace installation
2. **Build Shared Package** - TypeScript compilation of shared utilities
3. **Code Quality Checks** - Linting and type checking across all workspaces
4. **Unit Tests** - Backend and frontend unit test suites with coverage
5. **Build Applications** - Production builds for frontend and backend
6. **E2E Tests** - Full user flow validation with Playwright
7. **Security Scanning** - Dependency audits and CodeQL analysis
8. **Performance Testing** - Lighthouse CI on main branch
9. **Deployment** - Conditional deployment to staging/production

### Pipeline Triggers
- **Push to main/develop** - Full pipeline execution
- **Pull Requests** - All quality gates except deployment
- **Manual Trigger** - Full pipeline on-demand

## 🚀 CI Workflow Jobs

### 1. Setup Dependencies
- Installs and caches Node.js dependencies for all workspaces
- Uses npm workspaces for efficient monorepo management
- Caches node_modules to speed up subsequent jobs

### 2. Build Shared Package
- Builds the shared TypeScript package with ES modules
- Caches build artifacts for use in other jobs
- Required for all other jobs that use shared types

### 3. Quality Checks
- **Linting**: ESLint across frontend, backend, and shared packages
- **Type Checking**: TypeScript strict mode validation
- **Matrix Strategy**: Parallel execution across workspaces
- **Fail Fast**: Pipeline stops if quality standards aren't met

### 4. Unit Tests
- **Backend Tests**: Jest with coverage reporting
- **Frontend Tests**: Vitest with React Testing Library
- **Coverage Upload**: Codecov integration for coverage tracking
- **Parallel Execution**: Tests run in parallel for speed

### 5. Build Applications
- **Frontend Build**: Vite production build with optimizations
- **Backend Build**: TypeScript compilation to JavaScript
- **Artifact Caching**: Build outputs cached for deployment
- **Build Validation**: Ensures production builds complete successfully

### 6. E2E Tests
- **Full Environment**: PostgreSQL + Redis services
- **Browser Testing**: Chromium, Firefox, and WebKit
- **Real User Flows**: Login, template execution, Figma integration
- **Test Isolation**: Global setup/teardown with test data seeding
- **Artifact Collection**: Screenshots, videos, and traces on failure

### 7. Security Scanning
- **npm audit**: Dependency vulnerability scanning
- **CodeQL Analysis**: GitHub's semantic code analysis
- **High Severity Gates**: Fails on high/critical vulnerabilities
- **Automated Security**: Runs on every push

### 8. Performance Testing
- **Lighthouse CI**: Core Web Vitals monitoring
- **Performance Budgets**: Enforced performance thresholds
- **Accessibility Audits**: WCAG compliance checking
- **Main Branch Only**: Reduces CI load while ensuring production quality

## 🐳 Docker Integration

### Multi-Stage Dockerfile
- **Base Stage**: Dependencies installation
- **Builder Stage**: Application compilation
- **Production Stage**: Optimized runtime image
- **Development Stage**: Hot-reload development environment

### Docker Compose Configurations
- **docker-compose.yml**: Full development environment
- **docker-compose.test.yml**: CI testing environment
- **Service Orchestration**: PostgreSQL, Redis, Backend, Frontend

### Container Benefits
- **Consistent Environment**: Same runtime everywhere
- **Isolation**: Clean test environments
- **Scalability**: Easy horizontal scaling
- **Production Parity**: Development matches production

## 🧪 Testing Strategy

### Test Pyramid
1. **Unit Tests** (Base) - Fast, isolated component testing
2. **Integration Tests** (Middle) - API endpoint testing
3. **E2E Tests** (Top) - Full user journey validation

### E2E Test Categories
- **Authentication Flows**: Login, logout, session management
- **Template Operations**: Browse, configure, execute templates
- **Figma Integration**: URL validation, token extraction, previews
- **Responsive Design**: Mobile and desktop viewports

### Test Data Management
- **Global Setup**: Database seeding with test fixtures
- **Test Isolation**: Clean state for each test
- **Realistic Data**: Production-like test scenarios
- **Global Teardown**: Complete cleanup after test runs

## 📊 Quality Metrics & Reporting

### Code Quality
- **ESLint Rules**: Airbnb config with custom rules
- **TypeScript**: Strict mode with no implicit any
- **Test Coverage**: Minimum 80% for critical paths
- **Security**: Zero high/critical vulnerabilities

### Performance Metrics
- **Performance Score**: Minimum 80/100
- **First Contentful Paint**: < 2 seconds
- **Largest Contentful Paint**: < 4 seconds  
- **Cumulative Layout Shift**: < 0.1
- **Total Blocking Time**: < 300ms

### Accessibility Standards
- **WCAG 2.1 AA**: Minimum compliance level
- **Accessibility Score**: Minimum 90/100
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader**: Compatible with assistive technologies

## 🔄 Development Workflow

### Local Development
```bash
# Start full development environment
npm run dev

# Run individual services
npm run dev:backend
npm run dev:frontend

# Run quality checks
npm run lint
npm run typecheck
npm run test

# Run E2E tests locally
npm run test:e2e:headed
```

### Docker Development
```bash
# Start with Docker
npm run docker:dev

# Run tests in Docker
npm run docker:test

# Clean up containers
npm run docker:down
```

### CI Commands
```bash
# Run full CI pipeline locally
npm run ci

# Run E2E tests with CI config
npm run test:e2e:ci

# Build all packages
npm run build

# Clean all build artifacts
npm run clean
```

## 🚦 Branch Protection Rules

### Main Branch
- **Required Checks**: All CI jobs must pass
- **Review Required**: At least 1 approving review
- **Up-to-date**: Branch must be up-to-date with main
- **Admin Enforcement**: Rules apply to administrators

### Develop Branch
- **Required Checks**: Quality gates must pass
- **Auto-deploy**: Staging deployment on successful CI
- **Feature Integration**: Target branch for feature PRs

## 🎯 Deployment Strategy

### Staging Environment
- **Trigger**: Push to develop branch
- **Environment**: staging
- **Database**: Separate staging database
- **Health Checks**: Automated post-deployment validation

### Production Environment
- **Trigger**: Manual release from main branch
- **Environment**: production
- **Blue-Green**: Zero-downtime deployment strategy
- **Rollback**: Automated rollback on health check failure

### Environment Variables
```bash
# Required for all environments
DATABASE_URL=postgresql://...
JWT_SECRET=...
ENCRYPTION_KEY=...

# Environment specific
NODE_ENV=production
PORT=3001
CORS_ORIGINS=https://app.example.com
```

## 📈 Monitoring & Observability

### Health Checks
- **Application Health**: /api/health endpoint
- **Database Health**: Connection and migration status
- **Service Dependencies**: External service availability

### Performance Monitoring
- **Lighthouse CI**: Continuous performance monitoring
- **Core Web Vitals**: Real user metrics
- **Bundle Analysis**: JavaScript bundle size tracking

### Error Tracking
- **Application Errors**: Structured error logging
- **Failed Deployments**: Notification on deployment failures
- **Test Failures**: GitHub Actions integration for test results

## 🔧 Configuration Files

### Key Configuration Files
- `.github/workflows/ci.yml` - Main CI pipeline
- `playwright.config.ts` - Local E2E test configuration  
- `playwright.config.ci.js` - CI E2E test configuration
- `lighthouserc.js` - Performance testing configuration
- `Dockerfile` - Container build configuration
- `docker-compose.yml` - Development environment
- `docker-compose.test.yml` - Test environment

### Environment Configuration
- Development: Hot-reload, debug tools, relaxed security
- Testing: Clean state, test fixtures, isolated environment
- Staging: Production-like, but with debug capabilities  
- Production: Optimized, secure, monitoring enabled

## 🚨 Troubleshooting

### Common CI Issues
1. **Test Flakiness**: Increase timeouts, improve selectors
2. **Build Failures**: Check TypeScript errors, missing dependencies
3. **E2E Timeouts**: Verify service health, increase wait times
4. **Security Alerts**: Update dependencies, review advisories

### Debug Commands
```bash
# Debug E2E tests locally
npm run test:e2e:debug

# View CI logs with verbose output  
npm run test:e2e:ci -- --verbose

# Check service health
curl http://localhost:3001/api/health

# View Docker logs
docker-compose logs -f
```

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [CodeQL Documentation](https://codeql.github.com/docs/)

---

This CI/CD pipeline ensures high code quality, comprehensive testing, and reliable deployments for the Cursor Prompt Web Portal.