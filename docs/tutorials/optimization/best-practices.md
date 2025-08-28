# Best Practices for Prompt Optimization

This guide covers advanced strategies and best practices for getting the most out of your PromptWizard optimization workflow.

## When to Optimize vs Manual Editing

### Optimize When:

**High-Volume Templates**
- Templates used frequently (>10 times per week)
- Templates with high token costs
- Templates with inconsistent results

```bash
# Good candidates for optimization
cprompt optimize api-documentation --usage-stats
cprompt optimize code-generation --cost-analysis
```

**Complex Templates**
- Multi-step instructions
- Templates with many variables
- Domain-specific prompts requiring expertise

**Templates with Performance Issues**
- Long processing times
- High API costs
- Inconsistent output quality

### Manual Edit When:

**Simple, One-off Templates**
- Basic prompts with clear requirements
- Templates used infrequently (<5 times per month)
- Very short prompts (under 100 tokens)

**Templates Requiring Human Creativity**
- Brand voice and tone requirements
- Cultural or contextual nuances
- Legal or compliance-specific language

**Highly Specialized Domains**
- Industry jargon that needs preservation
- Templates requiring specific formatting
- Regulatory or standards compliance

## Choosing Optimization Levels

### Conservative Optimization (Beginners)

```yaml
# .cursor-prompt.yaml
promptWizard:
  defaults:
    mutateRefineIterations: 2  # Minimal changes
    fewShotCount: 3           # Few examples
    generateReasoning: true   # Keep explanations
```

```bash
# Conservative optimization command
cprompt optimize my-template \
  --iterations 2 \
  --examples 3 \
  --model gpt-4
```

**Best for:**
- Critical production templates
- First-time optimization
- Templates requiring regulatory approval

### Balanced Optimization (Recommended)

```yaml
promptWizard:
  defaults:
    mutateRefineIterations: 3  # Good balance
    fewShotCount: 5           # Adequate examples
    generateReasoning: true   # Maintain clarity
```

```bash
# Balanced optimization
cprompt optimize my-template \
  --iterations 3 \
  --examples 5 \
  --reasoning
```

**Best for:**
- Most templates
- General-purpose optimization
- Regular workflow integration

### Aggressive Optimization (Advanced)

```yaml
promptWizard:
  defaults:
    mutateRefineIterations: 5  # Maximum refinement
    fewShotCount: 8           # Many examples
    generateReasoning: false  # Prioritize brevity
```

```bash
# Aggressive optimization
cprompt optimize my-template \
  --iterations 5 \
  --examples 8 \
  --model claude-3-opus \
  --priority high
```

**Best for:**
- High-cost templates needing maximum reduction
- Templates with proven baseline quality
- Experimental optimization

## Working with Feedback Loops

### Setting Up Feedback Collection

```typescript
// Implement feedback collection in your application
import { PromptOptimizationService } from './services/prompt-optimization.service';

const optimizationService = new PromptOptimizationService(/* ... */);

// After using an optimized template
await optimizationService.sendFeedback('template-id', {
  rating: 4,  // 1-5 scale
  comments: 'Good optimization, but lost some context specificity',
  preferredVersion: 'optimized'  // or 'original'
});
```

### Feedback-Driven Re-optimization

The system automatically re-optimizes templates with low ratings:

```bash
# Manual feedback-based re-optimization
cprompt optimize my-template \
  --feedback-threshold 3 \
  --auto-reoptimize \
  --iterations 4
```

### Feedback Analysis Patterns

**High Rating (4-5 stars):**
- Template is working well
- Consider similar optimization for related templates
- Document successful parameters

**Medium Rating (3 stars):**
- Template needs minor adjustments
- Try different optimization parameters
- Consider domain-specific customization

**Low Rating (1-2 stars):**
- Triggers automatic re-optimization
- Review original requirements
- Consider manual intervention

## A/B Testing Strategies

### Basic A/B Testing Setup

```yaml
# .cursor-prompt.yaml
templates:
  - name: user-story-generation
    versions:
      original: templates/user-story.yaml
      optimized: templates/user-story.optimized.yaml
    abTest:
      enabled: true
      split: 50  # 50% traffic to each version
      metrics:
        - accuracy
        - token_usage
        - processing_time
```

### Running A/B Tests

```bash
# Generate optimized version for testing
cprompt optimize user-story-generation \
  --output user-story.optimized.yaml \
  --test-mode

# Compare versions
cprompt compare user-story.yaml user-story.optimized.yaml \
  --metrics \
  --samples 100
```

### A/B Test Analysis

```bash
# View A/B test results
cprompt ab-results user-story-generation --period 7d

# Expected output:
# A/B Test Results: user-story-generation (Last 7 days)
# ═══════════════════════════════════════════════════
# Original Version:
#   - Usage: 150 requests
#   - Avg Tokens: 245
#   - Success Rate: 78%
#   - Avg Processing Time: 1.2s
# 
# Optimized Version:
#   - Usage: 147 requests
#   - Avg Tokens: 167 (-32%)
#   - Success Rate: 85% (+7%)
#   - Avg Processing Time: 0.9s (-25%)
# 
# Recommendation: Deploy optimized version
```

### A/B Testing Best Practices

1. **Run for Sufficient Duration**
   - Minimum 1 week for statistical significance
   - Consider usage patterns (weekday vs weekend)
   - Account for seasonal variations

2. **Monitor Multiple Metrics**
   - Token usage (cost)
   - Accuracy/quality
   - Processing time
   - User satisfaction

3. **Statistical Significance**
   - Require minimum sample size (100+ requests per variant)
   - Use confidence intervals
   - Account for variance in results

## Cost-Benefit Analysis

### Calculating ROI

**Cost Factors:**
- Optimization service usage (API calls)
- Development time for setup
- A/B testing and monitoring overhead

**Benefit Factors:**
- Token cost reduction
- Improved accuracy (fewer retries)
- Faster processing times
- Reduced manual prompt engineering time

### ROI Calculation Example

```bash
# Generate cost-benefit report
cprompt analyze-roi my-template --period 30d

# Example output:
# ROI Analysis: my-template (Last 30 days)
# ═══════════════════════════════════════
# Costs:
#   - Optimization: $5.20 (one-time)
#   - Monitoring: $2.30/month
#   Total Cost: $7.50
# 
# Benefits:
#   - Token Savings: $245.80 (32% reduction)
#   - Improved Accuracy: $89.40 (fewer retries)
#   - Time Savings: $156.00 (manual engineering)
#   Total Benefits: $491.20
# 
# ROI: 6,449% over 30 days
# Payback Period: 1.2 days
```

### ROI Optimization Strategies

**Focus on High-Impact Templates:**
```bash
# Identify templates with highest ROI potential
cprompt list --sort-by cost --filter usage:>10/week
```

**Batch Optimization for Efficiency:**
```bash
# Optimize multiple templates together
cprompt optimize --batch ./templates \
  --roi-threshold 500% \
  --report
```

## Template Categories and Strategies

### Code Generation Templates

```yaml
# Optimized for code generation
promptWizard:
  codeGeneration:
    targetModel: gpt-4  # Best for code
    mutateRefineIterations: 4  # More refinement for accuracy
    fewShotCount: 6  # More examples for patterns
    generateReasoning: true  # Explain code logic
```

**Best Practices:**
- Use specific programming language contexts
- Include error handling examples
- Optimize for both brevity and correctness
- Test with various complexity levels

### Documentation Templates

```yaml
promptWizard:
  documentation:
    targetModel: claude-3-opus  # Excellent for documentation
    mutateRefineIterations: 3
    fewShotCount: 4
    generateReasoning: false  # Focus on clarity
```

**Best Practices:**
- Prioritize clarity over brevity
- Include structure templates
- Optimize for consistency
- Consider audience expertise level

### Analysis Templates

```yaml
promptWizard:
  analysis:
    targetModel: gpt-4  # Strong analytical capabilities
    mutateRefineIterations: 5  # Thorough analysis
    fewShotCount: 7  # Multiple analysis examples
    generateReasoning: true  # Show analysis process
```

**Best Practices:**
- Emphasize structured thinking
- Include multiple perspectives
- Optimize for depth and accuracy
- Balance comprehensiveness with focus

## Advanced Configuration Patterns

### Environment-Specific Configuration

```yaml
# Development environment
promptWizard:
  serviceUrl: http://localhost:8000
  defaults:
    mutateRefineIterations: 2  # Faster iteration
    generateReasoning: true    # Debug information

# Production environment
promptWizard:
  serviceUrl: https://promptwizard-prod.company.com
  defaults:
    mutateRefineIterations: 4  # Higher quality
    generateReasoning: false   # Optimized for performance
  cache:
    enabled: true
    ttl: 86400
```

### Model-Specific Optimization

```yaml
promptWizard:
  models:
    gpt-4:
      mutateRefineIterations: 3
      fewShotCount: 5
      maxPromptLength: 8000
    claude-3-opus:
      mutateRefineIterations: 4
      fewShotCount: 8
      maxPromptLength: 10000
    claude-3-sonnet:
      mutateRefineIterations: 2
      fewShotCount: 4
      maxPromptLength: 6000
```

### Custom Optimization Profiles

```typescript
// Define custom optimization profiles
const optimizationProfiles = {
  'cost-focused': {
    mutateRefineIterations: 5,
    fewShotCount: 3,
    generateReasoning: false,
    priority: 'token-reduction'
  },
  'quality-focused': {
    mutateRefineIterations: 4,
    fewShotCount: 8,
    generateReasoning: true,
    priority: 'accuracy'
  },
  'speed-focused': {
    mutateRefineIterations: 2,
    fewShotCount: 3,
    generateReasoning: false,
    priority: 'processing-time'
  }
};
```

## Monitoring and Maintenance

### Performance Monitoring

```bash
# Monitor optimization performance
cprompt monitor --dashboard

# Set up alerts for performance degradation
cprompt alert create \
  --metric token-usage-increase \
  --threshold 15% \
  --notification email
```

### Scheduled Re-optimization

```bash
# Set up scheduled optimization reviews
crontab -e

# Add entry for weekly optimization review
0 2 * * 0 /usr/local/bin/cprompt optimize --batch --review --report
```

### Version Management

```yaml
# Template versioning strategy
templates:
  code-review:
    versions:
      v1.0: templates/code-review-v1.yaml
      v1.1-optimized: templates/code-review-v1.1-opt.yaml
      v2.0: templates/code-review-v2.yaml
    active: v1.1-optimized
    optimization:
      lastOptimized: 2023-12-01T10:00:00Z
      nextReview: 2024-01-01T10:00:00Z
```

## Quality Assurance

### Testing Optimized Templates

```bash
# Test optimization quality
cprompt test my-template.optimized.yaml \
  --test-cases ./test-data/my-template-tests.json \
  --baseline my-template.yaml

# Automated quality checks
cprompt quality-check \
  --threshold 85 \
  --metrics clarity,accuracy,efficiency
```

### Rollback Strategies

```bash
# Rollback to previous version if issues arise
cprompt rollback my-template --to-version v1.0

# Gradual rollout (canary deployment)
cprompt deploy my-template.optimized.yaml \
  --strategy canary \
  --traffic-percent 10
```

## Team Collaboration

### Sharing Optimization Configurations

```yaml
# Team-shared optimization settings
# .cursor-prompt-team.yaml
promptWizard:
  team:
    approvalRequired: true
    reviewers: ["senior-dev", "tech-lead"]
    qualityGate:
      minimumScore: 80
      requiredMetrics: ["clarity", "accuracy"]
```

### Code Review for Optimizations

```bash
# Generate optimization PR
cprompt optimize my-template \
  --create-pr \
  --reviewers @team-leads \
  --description "Optimize template for 30% cost reduction"
```

By following these best practices, you'll maximize the value of your prompt optimization efforts while maintaining quality and team collaboration standards.

Next: [Example Workflows](./example-workflows.md) for real-world optimization scenarios.