# Example Optimization Workflows

This guide provides real-world examples and step-by-step workflows for common optimization scenarios.

## Single Template Optimization

### Scenario: Optimizing a Code Review Template

**Context**: A development team has a code review template that's costing $50/month in API calls and producing inconsistent results.

#### Step 1: Analyze Current Template

```bash
# First, analyze the existing template
cprompt analyze code-review-template \
  --metrics cost,accuracy,usage \
  --period 30d
```

**Output:**
```
Template Analysis: code-review-template (Last 30 days)
═══════════════════════════════════════════════════
Usage Statistics:
  - Total Uses: 342
  - API Cost: $47.80
  - Avg Tokens per Use: 287
  - Success Rate: 73%

Quality Metrics:
  - Clarity Score: 67/100
  - Task Alignment: 71/100
  - Token Efficiency: 52/100

Recommendations:
  ⚠️  High token usage for task complexity
  ⚠️  Inconsistent output structure
  ✅ Good task alignment
```

#### Step 2: Optimize with Specific Parameters

```bash
# Optimize focusing on cost reduction and consistency
cprompt optimize code-review-template \
  --model gpt-4 \
  --iterations 4 \
  --examples 8 \
  --task "Review code for bugs, performance, and best practices" \
  --output code-review-optimized.yaml \
  --priority cost-reduction
```

#### Step 3: Compare Results

```bash
# Compare original vs optimized
cprompt compare code-review-template code-review-optimized.yaml \
  --metrics \
  --test-cases ./test-data/code-review-samples.json
```

**Results:**
```
Comparison Results
═══════════════════════════════════════════════════
Original Template:
  - Avg Tokens: 287
  - Quality Score: 69/100
  - Success Rate: 73%

Optimized Template:
  - Avg Tokens: 195 (-32%)
  - Quality Score: 84/100 (+15%)
  - Success Rate: 89% (+16%)

Projected Monthly Savings: $15.36 (32% reduction)
ROI: 1,547% over 30 days
```

#### Step 4: A/B Test in Production

```yaml
# Update .cursor-prompt.yaml for A/B testing
templates:
  - name: code-review
    versions:
      original: templates/code-review-template.yaml
      optimized: templates/code-review-optimized.yaml
    abTest:
      enabled: true
      split: 20  # Start with 20% traffic to optimized
      duration: 7  # days
      successMetrics:
        - token_reduction: ">20%"
        - accuracy_improvement: ">10%"
```

```bash
# Monitor A/B test progress
cprompt ab-monitor code-review --live
```

## Batch Optimization for Projects

### Scenario: Optimizing All Templates in a React Project

**Context**: A React development team wants to optimize all their development templates to reduce costs and improve consistency.

#### Step 1: Audit Existing Templates

```bash
# List all templates with cost analysis
cprompt list \
  --sort-by cost \
  --filter usage:>5/month \
  --export templates-audit.csv
```

#### Step 2: Batch Optimize High-Impact Templates

```bash
# Optimize templates with highest ROI potential
cprompt optimize --batch ./templates \
  --filter cost:>$10/month \
  --model gpt-4 \
  --iterations 3 \
  --parallel 3 \
  --output ./optimized-templates \
  --report
```

**Progress Output:**
```
Batch Optimization Progress
═══════════════════════════════════════════════════
✓ component-generator (token reduction: 28%)
✓ test-writer (token reduction: 41%) 
⠸ Processing: api-documentation...
⚠ Failed: complex-refactor (timeout)
⠸ Processing: bug-analyzer...

Progress: 3/8 completed (37.5%)
Estimated completion: 4 minutes
```

#### Step 3: Review and Deploy Results

```bash
# Review optimization report
cat batch-optimization-report.json | jq '.results[] | select(.metrics.tokenReduction > 20)'

# Deploy successful optimizations
cprompt deploy-batch ./optimized-templates \
  --strategy gradual \
  --approval-required
```

**Deployment Strategy:**
```yaml
# Deploy in phases for risk management
deployment:
  phase1: # Low-risk templates
    templates: ["component-generator", "test-writer"]
    traffic: 100%
    duration: 3d
    
  phase2: # Medium-risk templates  
    templates: ["api-documentation", "bug-analyzer"]
    traffic: 50%
    duration: 7d
    
  phase3: # High-risk templates
    templates: ["complex-refactor"]
    traffic: 20%
    duration: 14d
```

## Cursor IDE Integration Workflow

### Scenario: Optimizing Templates for Cursor IDE Development

**Context**: A team using Cursor IDE wants to optimize their templates specifically for Cursor's AI features and patterns.

#### Step 1: Detect Cursor Environment

```bash
# Use Cursor-specific optimization
cprompt cursor-optimize --detect-context
```

**Context Detection:**
```
Cursor Context Detected
═══════════════════════════════════════════════════
Workspace: /path/to/react-project
Project Type: Node.js (React)
.cursorrules: Found (125 lines)
Cursor Version: 0.29.0
Active Patterns: @file:, @folder:, @codebase

Optimization Recommendations:
• Integrate with existing .cursorrules
• Optimize for Cursor's context window (8000 tokens)
• Use Cursor-specific patterns for better AI integration
```

#### Step 2: Optimize for Cursor Patterns

```bash
# Optimize with Cursor-specific enhancements
cprompt cursor-optimize component-generator \
  --integrate-cursorrules \
  --cursor-patterns \
  --max-context 8000 \
  --model claude-3-sonnet
```

**Before (Original Template):**
```yaml
name: component-generator
content: |
  Create a React component with the following requirements:
  
  Component name: {{componentName}}
  Props: {{props}}
  
  Please include:
  - TypeScript interfaces
  - Proper prop validation
  - Basic styling setup
  - Unit test file
  
  Make sure to follow React best practices and include proper error handling.
```

**After (Cursor-Optimized):**
```yaml
name: component-generator-cursor
content: |
  Create React component: {{componentName}}
  
  @file: Generate component files
  @folder: src/components/{{componentName}}
  
  Include:
  - TypeScript interfaces for {{props}}
  - Prop validation
  - Basic styling
  - Unit tests
  
  // Cursor: Follow project .cursorrules for consistency
  @codebase: Match existing component patterns
```

#### Step 3: Test Cursor Integration

```bash
# Test in Cursor IDE environment
cprompt cursor-test component-generator-cursor \
  --workspace /path/to/react-project \
  --simulate-context
```

### Advanced Cursor Workflow

#### Setting Up Auto-Optimization

```yaml
# .cursor-prompt.yaml - Cursor-specific configuration
cursor:
  autoOptimize: true
  watchFiles: [".cursorrules"]
  optimizeOnChange: true
  
promptWizard:
  cursor:
    maxPromptLength: 8000  # Cursor's preference
    cursorPatterns: true
    integrateCursorRules: true
    preferredModel: claude-3-sonnet  # Works well with Cursor
```

#### Cursor-Specific Templates

```bash
# Generate Cursor-optimized templates
cprompt cursor-generate-templates \
  --workspace-type react \
  --include-patterns @file:,@folder:,@codebase
```

**Generated Templates:**
- `cursor-code-review`: Optimized for Cursor's code review workflow
- `cursor-refactor`: Uses @file: patterns for targeted refactoring
- `cursor-debug`: Leverages @codebase for context-aware debugging

## Claude Code MCP Workflow

### Scenario: Integrating with Claude Code's MCP System

**Context**: A development team using Claude Code wants to optimize templates for MCP (Model Context Protocol) workflows.

#### Step 1: Configure MCP Integration

```typescript
// mcp-optimization-config.ts
export const mcpOptimizationConfig = {
  contextWindow: 200000,  // Claude's large context window
  optimizeForMCP: true,
  prioritizeContext: true,
  preserveStructure: true
};
```

#### Step 2: Optimize for MCP Workflows

```bash
# Optimize for Claude Code MCP usage
cprompt mcp-optimize codebase-analyzer \
  --context-window 200000 \
  --preserve-structure \
  --mcp-patterns
```

#### Step 3: Test MCP Integration

```typescript
// test-mcp-optimization.ts
import { MCPOptimizationService } from './mcp-optimization.service';

const service = new MCPOptimizationService();

// Test optimized template with MCP
const result = await service.testTemplate('codebase-analyzer-optimized', {
  contextSize: 'large',
  preserveReferences: true,
  mcpCompatible: true
});
```

## CI/CD Integration Examples

### GitHub Actions Workflow

```yaml
# .github/workflows/optimize-templates.yml
name: Optimize Templates

on:
  push:
    paths: ['templates/**']
  schedule:
    - cron: '0 2 * * 0'  # Weekly optimization review

jobs:
  optimize:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Setup Python for PromptWizard
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
          
      - name: Install dependencies
        run: |
          npm install
          pip install -r services/promptwizard-service/requirements.txt
          
      - name: Start PromptWizard service
        run: |
          cd services/promptwizard-service
          python main.py &
          sleep 30  # Wait for service to start
          
      - name: Optimize templates
        run: |
          npx cprompt optimize --batch ./templates \
            --output ./optimized-templates \
            --report \
            --ci-mode
            
      - name: Run quality checks
        run: |
          npx cprompt quality-check \
            --threshold 80 \
            --fail-on-regression
            
      - name: Create PR with optimizations
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'Automated template optimization'
          body: |
            ## Template Optimization Results
            
            This PR contains automatically optimized templates.
            
            ### Key Improvements:
            - Token reduction: {{ avg_token_reduction }}%
            - Quality improvements: {{ quality_improvements }}
            - Cost savings: ${{ projected_savings }}/month
            
            ### Templates Updated:
            {{ template_list }}
          branch: automated-optimization
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        PROMPTWIZARD_SERVICE_URL = 'http://promptwizard:8000'
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm install'
                sh 'docker-compose up -d promptwizard-service'
                sh 'sleep 30'  // Wait for service
            }
        }
        
        stage('Optimize Templates') {
            steps {
                script {
                    def result = sh(
                        script: 'npx cprompt optimize --batch ./templates --report --json',
                        returnStdout: true
                    ).trim()
                    
                    def optimization = readJSON text: result
                    
                    if (optimization.averageImprovement > 15) {
                        echo "Significant improvements detected: ${optimization.averageImprovement}%"
                        
                        // Deploy to staging
                        sh 'npx cprompt deploy-batch ./optimized-templates --environment staging'
                    }
                }
            }
        }
        
        stage('Quality Gates') {
            steps {
                sh 'npx cprompt quality-check --threshold 85'
                sh 'npx cprompt security-scan ./optimized-templates'
            }
        }
        
        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                input message: 'Deploy optimized templates to production?'
                
                sh '''
                    npx cprompt deploy-batch ./optimized-templates \
                        --environment production \
                        --strategy gradual \
                        --monitor
                '''
            }
        }
    }
    
    post {
        always {
            sh 'docker-compose down'
        }
        
        success {
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'optimization-reports',
                reportFiles: 'index.html',
                reportName: 'Optimization Report'
            ])
        }
    }
}
```

## Advanced Optimization Patterns

### Context-Aware Optimization

```typescript
// context-aware-optimization.ts
export class ContextAwareOptimizer {
  async optimizeForContext(templateName: string, context: {
    userType: 'beginner' | 'intermediate' | 'expert';
    domain: string;
    complexity: 'low' | 'medium' | 'high';
    platform: 'cursor' | 'vscode' | 'claude-code';
  }) {
    const optimizationStrategy = this.selectStrategy(context);
    
    return await this.optimize(templateName, {
      iterations: optimizationStrategy.iterations,
      examples: optimizationStrategy.examples,
      model: optimizationStrategy.preferredModel,
      customInstructions: optimizationStrategy.instructions
    });
  }
  
  private selectStrategy(context: any) {
    // Context-specific optimization strategies
    if (context.platform === 'cursor') {
      return {
        iterations: 4,
        examples: 6,
        preferredModel: 'claude-3-sonnet',
        instructions: 'Optimize for Cursor IDE patterns and context'
      };
    }
    
    if (context.complexity === 'high') {
      return {
        iterations: 5,
        examples: 8,
        preferredModel: 'gpt-4',
        instructions: 'Maintain complexity while optimizing clarity'
      };
    }
    
    // Default strategy
    return {
      iterations: 3,
      examples: 5,
      preferredModel: 'gpt-4',
      instructions: 'Standard optimization for clarity and efficiency'
    };
  }
}
```

### Multi-Model Optimization

```bash
# Optimize for multiple models and compare
cprompt multi-model-optimize code-review \
  --models gpt-4,claude-3-opus,claude-3-sonnet \
  --compare-results \
  --report multi-model-comparison.json
```

**Multi-Model Results:**
```json
{
  "template": "code-review",
  "results": {
    "gpt-4": {
      "tokenReduction": 28,
      "qualityScore": 87,
      "cost": "$0.02/use",
      "strengths": ["logical structure", "code accuracy"]
    },
    "claude-3-opus": {
      "tokenReduction": 35,
      "qualityScore": 89,
      "cost": "$0.015/use", 
      "strengths": ["clarity", "comprehensive analysis"]
    },
    "claude-3-sonnet": {
      "tokenReduction": 24,
      "qualityScore": 84,
      "cost": "$0.003/use",
      "strengths": ["speed", "cost efficiency"]
    }
  },
  "recommendation": "claude-3-opus for quality, claude-3-sonnet for cost"
}
```

These workflows provide comprehensive examples for different optimization scenarios. Choose the workflow that best matches your use case and adapt the parameters to your specific requirements.

Next: [Troubleshooting Guide](./troubleshooting.md) for resolving common issues.