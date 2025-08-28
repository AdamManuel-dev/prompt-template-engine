# Getting Started with PromptWizard Optimization

This tutorial will walk you through the basics of using the PromptWizard integration to optimize your prompt templates, achieving significant cost reduction and accuracy improvements.

## Overview

The PromptWizard integration transforms manual prompt engineering into an automated, ML-powered process that delivers:

- **5-60x cost reduction** through token optimization
- **90% accuracy** vs 78% with manual prompts
- **69 API calls** vs 1,730+ for competing frameworks
- **Minutes to optimize** vs hours/days manually

## Prerequisites

Before getting started, ensure you have:

1. **Node.js 18+** installed
2. **Universal AI Prompt Template Engine** installed and configured
3. **Python 3.9+** environment (for PromptWizard service)
4. **Docker** (optional, for containerized service deployment)

## Quick Setup

### 1. Install PromptWizard Service

First, set up the Python service that powers the optimization:

```bash
# Navigate to the service directory
cd services/promptwizard-service

# Install Python dependencies
pip install -r requirements.txt

# Install Microsoft PromptWizard
pip install git+https://github.com/microsoft/promptwizard.git
```

### 2. Start the PromptWizard Service

Choose one of these methods to start the service:

```bash
# Method 1: Direct Python execution
python main.py

# Method 2: Docker (recommended for production)
docker-compose up -d

# Method 3: Background service
python main.py &
```

### 3. Verify Service Health

Check that the service is running correctly:

```bash
# Health check
curl http://localhost:8000/api/v1/health

# Expected response:
# {"status": "healthy", "version": "1.0.0", "promptwizard": "available"}
```

### 4. Configure Your Project

Add PromptWizard configuration to your `.cursor-prompt.yaml`:

```yaml
# Basic configuration
promptWizard:
  serviceUrl: http://localhost:8000
  timeout: 120000
  defaults:
    targetModel: gpt-4
    mutateRefineIterations: 3
    fewShotCount: 5
    generateReasoning: true
  cache:
    enabled: true
    ttl: 86400  # 24 hours
```

## Your First Optimization

Let's optimize a simple template to see the system in action.

### 1. Create a Sample Template

Create a file `templates/code-review.yaml`:

```yaml
name: code-review
description: Basic code review prompt
version: 1.0.0

content: |
  Please review the following code for potential issues, bugs, and improvements.
  
  Code to review:
  {{code}}
  
  Focus on:
  - Syntax errors
  - Logic issues
  - Performance problems
  - Best practices violations
  - Security concerns
  
  Please provide detailed feedback with specific suggestions for improvement.

variables:
  - name: code
    description: Code to be reviewed
    type: string
    required: true
```

### 2. Run Basic Optimization

Use the CLI to optimize your template:

```bash
# Basic optimization
cprompt optimize code-review

# With specific options
cprompt optimize code-review \
  --model gpt-4 \
  --iterations 5 \
  --examples 10 \
  --output optimized-code-review.yaml
```

You'll see output like this:

```
✓ PromptWizard service is healthy
⠸ Loading template: code-review
⠸ Optimizing template: code-review
⠸ Starting optimization with PromptWizard...
✓ Optimization completed successfully!

🎉 Optimization Results
═══════════════════════════════════════════════════
Template: code-review
Request ID: opt-1638123456-abc123def

📊 Performance Metrics
Token Reduction: 32%
Accuracy Improvement: 15%
Optimization Time: 45.2s
API Calls Used: 23

⭐ Quality Score
Overall Score: 87/100
Clarity: 92/100
Task Alignment: 85/100
Token Efficiency: 84/100

💡 Suggestions
1. Consider adding specific programming language context
2. Structure feedback sections for better readability

🔄 Optimized Content
──────────────────────────────────────────────────
Review code for issues and improvements:

{{code}}

Check for:
- Bugs and syntax errors
- Performance bottlenecks
- Security vulnerabilities
- Code quality issues

Provide actionable feedback with specific examples.
──────────────────────────────────────────────────
```

### 3. Understanding the Results

The optimization results show several key metrics:

**Performance Metrics:**
- **Token Reduction**: 32% fewer tokens = lower costs
- **Accuracy Improvement**: 15% better results
- **API Calls Used**: Only 23 calls for optimization

**Quality Score:**
- **Overall**: 87/100 (excellent)
- **Clarity**: 92/100 (very clear instructions)
- **Task Alignment**: 85/100 (well-aligned with intent)
- **Token Efficiency**: 84/100 (good token usage)

**Key Improvements:**
- Removed redundant phrases
- Simplified instructions
- Maintained clarity while reducing length

## Common Use Cases

### Code Review Templates

Optimize templates for reviewing code quality:

```bash
cprompt optimize code-review --task "Review code for bugs and improvements"
```

### Documentation Generation

Optimize documentation templates:

```bash
cprompt optimize doc-generator --examples 15 --model claude-3-opus
```

### Bug Analysis

Create optimized debugging assistants:

```bash
cprompt optimize debug-helper --reasoning --iterations 4
```

### Refactoring Assistance

Optimize refactoring prompts:

```bash
cprompt optimize refactor-assistant --model gpt-4 --examples 8
```

## Understanding Optimization Results

### Metrics Explained

**Token Reduction**: Percentage decrease in prompt length
- Good: 10-30% reduction
- Excellent: 30%+ reduction
- Maintains meaning while reducing cost

**Accuracy Improvement**: Effectiveness increase
- Based on PromptWizard's evaluation metrics
- Measured against test cases and expected outputs
- Higher accuracy = better results from AI models

**Quality Score Components**:
- **Clarity**: How clear and unambiguous instructions are
- **Task Alignment**: How well the prompt matches the intended task
- **Token Efficiency**: Cost-effectiveness of token usage

### Reading Suggestions

Optimization often includes suggestions:

```
💡 Suggestions
1. Consider adding specific programming language context
2. Structure feedback sections for better readability
3. Add examples for complex requirements
```

These are actionable improvements you can apply manually or through re-optimization.

## Next Steps

Now that you've completed your first optimization:

1. **Try Batch Optimization**: Optimize multiple templates at once
2. **Explore Advanced Options**: Custom models, iteration counts, example generation
3. **Set Up A/B Testing**: Compare original vs optimized performance
4. **Integration**: Connect with Cursor IDE or Claude Code workflows

## Troubleshooting Common Issues

### Service Connection Issues

```bash
# Check if service is running
curl http://localhost:8000/api/v1/health

# If not responding, restart the service
docker-compose restart
```

### Template Not Found

```bash
# List available templates
cprompt list

# Use full path if needed
cprompt optimize ./templates/my-template.yaml
```

### Optimization Timeout

```bash
# Increase timeout for complex templates
cprompt optimize complex-template --timeout 300000  # 5 minutes
```

### Cache Issues

```bash
# Clear cache and retry
cprompt optimize my-template --skip-cache

# Or globally clear cache
cprompt optimize --clear-cache
```

## Performance Tips

1. **Start Small**: Begin with simple templates to learn the system
2. **Use Caching**: Enable caching for repeated optimizations
3. **Batch Processing**: Optimize multiple templates together for efficiency
4. **Model Selection**: Choose appropriate models for your use case
5. **Iteration Tuning**: More iterations = better results but longer processing

## Configuration Best Practices

```yaml
promptWizard:
  # Service configuration
  serviceUrl: http://localhost:8000
  timeout: 120000  # 2 minutes default
  retries: 3

  # Optimization defaults
  defaults:
    targetModel: gpt-4  # Most balanced option
    mutateRefineIterations: 3  # Good starting point
    fewShotCount: 5  # Sufficient examples
    generateReasoning: true  # Better explanations

  # Caching for performance
  cache:
    enabled: true
    ttl: 86400  # 24 hours
    maxSize: 1000

  # Optional: Redis for distributed caching
  # redis:
  #   enabled: false
  #   url: ${REDIS_URL}
```

You're now ready to start optimizing your prompt templates! Continue with the [Best Practices Guide](./best-practices.md) to learn advanced techniques and strategies.