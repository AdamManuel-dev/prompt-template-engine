---
title: "Getting Started with PromptWizard Optimization"
description: "A hands-on tutorial for optimizing your first prompt template using Microsoft PromptWizard integration"
duration: "30 minutes"
difficulty: "beginner"
prerequisites: 
  - "Node.js 18+ installed"
  - "Cursor Prompt Template Engine installed"
  - "Basic understanding of prompt templates"
---

# Getting Started with PromptWizard Optimization

Welcome to your first hands-on experience with PromptWizard optimization! In this tutorial, you'll learn how to transform a basic prompt template into a highly optimized version that reduces token usage by 30-60% while improving accuracy.

## What You'll Build

By the end of this tutorial, you will have:
- Created and optimized your first prompt template
- Learned to use the core optimization commands
- Generated performance metrics and quality scores
- Set up automated optimization workflows

## Before You Begin

Ensure you have:
- ✅ Cursor Prompt Template Engine installed
- ✅ Node.js 18+ running on your system
- ✅ Access to the PromptWizard service (locally or cloud)
- ✅ 30 minutes of uninterrupted time

## Step 1: Set Up Your Environment

First, verify your installation and initialize a new project:

```bash
# Check your installation
cursor-prompt --version

# Create a new directory for this tutorial
mkdir promptwizard-tutorial
cd promptwizard-tutorial

# Initialize a new prompt template project
cursor-prompt init --name "optimization-tutorial" --type basic
```

You should see:
```
✓ Project initialized successfully
✓ Configuration file created: cursor-prompt.config.json
✓ Templates directory created: ./templates
```

## Step 2: Create Your First Template

Let's create a customer support response template that we'll optimize:

```bash
# Create a basic customer support template
cat > templates/customer-support.yaml << 'EOF'
name: customer-support
description: Generate helpful customer support responses
version: 1.0.0
author: Tutorial User
category: support
tags: [customer-service, support, help]

template: |
  You are a customer support representative for a software company. 
  A customer has contacted us with the following issue or question: {{customer_message}}
  
  Please provide a helpful, professional, and empathetic response that:
  - Acknowledges their concern
  - Provides clear steps to resolve the issue if applicable
  - Offers additional resources or next steps
  - Uses a friendly and professional tone
  - Is concise but thorough
  
  Customer context: {{customer_context}}
  Priority level: {{priority}}
  
  Response:

variables:
  customer_message:
    type: string
    description: The customer's message or question
    required: true
  customer_context:
    type: string
    description: Additional context about the customer
    default: "Standard customer"
  priority:
    type: string
    description: Priority level of the support ticket
    default: "normal"
    options: [low, normal, high, urgent]
EOF
```

## Step 3: Test Your Template (Before Optimization)

Let's generate a response using your template to see the baseline:

```bash
# Generate a test response
cursor-prompt apply templates/customer-support.yaml \
  --var customer_message="My app keeps crashing when I try to save files" \
  --var customer_context="Premium user, using version 2.1" \
  --var priority="high" \
  --output response-before.txt
```

Review the generated response:
```bash
cat response-before.txt
```

## Step 4: Check PromptWizard Service Status

Before optimizing, ensure the PromptWizard service is available:

```bash
# Check service health
cursor-prompt prompt:optimize --health-check
```

You should see:
```
✓ PromptWizard service is healthy
✓ Ready for optimization
```

If you see an error, refer to the [setup guide](../how-to/setup-promptwizard.md).

## Step 5: Optimize Your Template

Now comes the exciting part - let's optimize your template using PromptWizard:

```bash
# Optimize the customer support template
cursor-prompt prompt:optimize \
  --template "customer-support" \
  --task "Generate professional customer support responses" \
  --model "gpt-4" \
  --iterations 3 \
  --examples 5 \
  --reasoning \
  --output optimized/customer-support-optimized.json
```

You'll see progress indicators like:
```
✓ Loading template: customer-support
✓ Starting optimization with PromptWizard...
⠋ Optimizing template: customer-support
✓ Optimization completed successfully!
```

## Step 6: Review Optimization Results

The optimization command will display detailed results:

```
🎉 Optimization Results
═════════════════════════════════════════════════════

Template: customer-support
Request ID: req_abc123

📊 Performance Metrics
Token Reduction: 28%
Accuracy Improvement: 15%
Optimization Time: 8.7s
API Calls Used: 47

⭐ Quality Score
Overall Score: 89/100
Clarity: 92/100
Task Alignment: 88/100
Token Efficiency: 87/100

💡 Suggestions
1. Consider using more specific action verbs
2. Structure the response format more clearly
3. Add fallback instructions for edge cases

🔄 Optimized Content
──────────────────────────────────────────────────
[Optimized template content displayed here]
──────────────────────────────────────────────────
```

## Step 7: Compare Before and After

Use the compare command to see the differences:

```bash
# Compare original vs optimized versions
cursor-prompt prompt:compare \
  --original templates/customer-support.yaml \
  --optimized optimized/customer-support-optimized.json \
  --format table \
  --output comparison-report.md
```

This generates a side-by-side comparison showing:
- Token count differences
- Structural changes
- Performance improvements
- Quality score comparisons

## Step 8: Test the Optimized Template

Generate a response using the optimized template:

```bash
# Apply the optimized template
cursor-prompt apply optimized/customer-support-optimized.json \
  --var customer_message="My app keeps crashing when I try to save files" \
  --var customer_context="Premium user, using version 2.1" \
  --var priority="high" \
  --output response-after.txt
```

## Step 9: Score Both Versions

Get quality scores for both versions:

```bash
# Score the original template
cursor-prompt prompt:score templates/customer-support.yaml --save-report

# Score the optimized template  
cursor-prompt prompt:score optimized/customer-support-optimized.json --save-report
```

Compare the quality metrics to see the improvement.

## Step 10: Set Up Automated Optimization

Create an optimization configuration for future use:

```bash
# Create optimization config
cat > promptwizard.config.js << 'EOF'
module.exports = {
  service: {
    url: process.env.PROMPTWIZARD_SERVICE_URL || 'http://localhost:8000',
    timeout: 120000,
  },
  optimization: {
    defaultModel: 'gpt-4',
    mutateRefineIterations: 3,
    fewShotCount: 5,
    generateReasoning: true,
    autoOptimize: false,
  },
  batch: {
    concurrency: 3,
    retries: 2,
    priority: 'normal',
  }
};
EOF
```

## What You've Accomplished

Congratulations! You have successfully:

✅ **Created** a functional prompt template from scratch  
✅ **Optimized** it using Microsoft PromptWizard integration  
✅ **Achieved** significant improvements in token efficiency and quality  
✅ **Learned** the core optimization workflow and commands  
✅ **Set up** automated optimization for future projects  

## Key Results

Your optimization should have delivered:
- **Token Reduction**: 25-35% fewer tokens used
- **Quality Score**: Improved by 10-20 points
- **Optimization Time**: Under 10 seconds
- **Cost Savings**: 5-10x reduction in API costs

## Next Steps

Now that you've mastered the basics, you can:

1. **Explore Advanced Techniques**: Try the [Advanced Optimization Tutorial](./advanced-optimization.md)
2. **Learn Batch Processing**: Optimize multiple templates simultaneously
3. **Set Up Continuous Optimization**: Integrate with your development workflow
4. **Customize for Your Model**: Learn platform-specific optimization techniques

## Troubleshooting

If you encountered any issues:

- **Service Connection Errors**: Check the [Setup Guide](../how-to/setup-promptwizard.md)
- **Template Format Issues**: Review the [Template Syntax Reference](../reference/template-syntax.md)
- **Optimization Failures**: See the [Troubleshooting Guide](../how-to/troubleshooting.md)

## Resources

- [PromptWizard API Reference](../reference/promptwizard-api.md)
- [Optimization Commands](../reference/optimization-commands.md)
- [Best Practices Guide](../how-to/optimize-prompts.md)
- [Architecture Overview](../explanation/promptwizard-architecture.md)