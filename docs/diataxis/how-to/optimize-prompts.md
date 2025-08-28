---
title: "How to Optimize Prompts with PromptWizard"
description: "Task-focused guides for common optimization workflows and specific use cases"
category: "how-to"
tags: [optimization, workflow, tasks]
---

# How to Optimize Prompts with PromptWizard

This guide provides step-by-step instructions for common prompt optimization tasks. Each section focuses on a specific goal without extensive explanation.

## Quick Reference

| Task | Command | Time |
|------|---------|------|
| Single prompt optimization | `cursor-prompt optimize -t <name>` | 30s |
| Batch optimization | `cursor-prompt optimize --batch` | 2-5min |
| Compare versions | `cursor-prompt compare <original> <optimized>` | 10s |
| Score prompt quality | `cursor-prompt score <template>` | 15s |
| Interactive wizard | `cursor-prompt wizard` | 3-10min |

## Optimize a Single Prompt

### Basic Optimization

```bash
# Optimize with defaults
cursor-prompt optimize --template "my-prompt"

# Optimize for specific model
cursor-prompt optimize -t "my-prompt" --model "claude-3-opus"

# Optimize with custom settings
cursor-prompt optimize -t "my-prompt" \
  --model "gpt-4" \
  --iterations 5 \
  --examples 8 \
  --reasoning
```

### Save Optimized Version

```bash
# Save to specific file
cursor-prompt optimize -t "my-prompt" --output "./optimized/my-prompt.json"

# Save with timestamp
cursor-prompt optimize -t "my-prompt" --output "./optimized/my-prompt-$(date +%Y%m%d).json"
```

### Skip Cache for Fresh Optimization

```bash
# Force fresh optimization
cursor-prompt optimize -t "my-prompt" --skip-cache

# High priority optimization
cursor-prompt optimize -t "my-prompt" --priority high --skip-cache
```

## Batch Optimize Multiple Prompts

### Optimize All Templates

```bash
# Batch optimize all templates
cursor-prompt optimize --batch

# Batch optimize with specific settings
cursor-prompt optimize --batch \
  --model "gpt-4" \
  --iterations 3 \
  --priority normal
```

### Optimize Specific Directory

```bash
# Optimize templates in specific directory
cursor-prompt optimize --batch \
  --directory "./templates/customer-support" \
  --output "./optimized/support/"
```

### Optimize with Concurrency Control

```bash
# Control batch processing speed
cursor-prompt optimize --batch \
  --concurrency 3 \
  --retry-failed \
  --timeout 180
```

## Compare Prompt Versions

### Basic Comparison

```bash
# Compare original vs optimized
cursor-prompt compare \
  --original "templates/my-prompt.yaml" \
  --optimized "optimized/my-prompt.json"
```

### Generate Detailed Reports

```bash
# Create detailed comparison report
cursor-prompt compare \
  --original "templates/my-prompt.yaml" \
  --optimized "optimized/my-prompt.json" \
  --format detailed \
  --output "comparison-report.md"

# Create side-by-side table
cursor-prompt compare \
  --templates "original.yaml,optimized.json" \
  --format table \
  --include-metrics
```

### Compare Multiple Versions

```bash
# Compare multiple optimized versions
cursor-prompt compare \
  --templates "v1.json,v2.json,v3.json" \
  --format matrix \
  --highlight-best
```

## Score Prompt Quality

### Get Quality Score

```bash
# Score a prompt
cursor-prompt score "templates/my-prompt.yaml"

# Score with detailed breakdown
cursor-prompt score "templates/my-prompt.yaml" --detailed

# Save scoring report
cursor-prompt score "templates/my-prompt.yaml" \
  --save-report \
  --output "quality-report.json"
```

### Score for Specific Use Case

```bash
# Score for customer support use case
cursor-prompt score "templates/support.yaml" \
  --context "customer-support" \
  --criteria "helpfulness,clarity,professionalism"

# Score for code generation
cursor-prompt score "templates/code-gen.yaml" \
  --context "code-generation" \
  --criteria "correctness,completeness,efficiency"
```

## Use Interactive Wizard

### Launch Optimization Wizard

```bash
# Start interactive wizard
cursor-prompt wizard

# Start wizard for existing template
cursor-prompt wizard --template "my-prompt"

# Start wizard with specific model
cursor-prompt wizard --model "claude-3-opus"
```

### Wizard Workflow

The wizard will guide you through:

1. **Template Selection**: Choose existing or create new
2. **Task Definition**: Describe optimization goals
3. **Model Selection**: Choose target AI model
4. **Examples**: Provide or generate examples
5. **Review & Optimize**: Preview and confirm settings
6. **Results**: Review optimization results

## Model-Specific Optimization

### Optimize for GPT-4

```bash
cursor-prompt optimize -t "my-prompt" \
  --model "gpt-4" \
  --profile "reasoning" \
  --chain-of-thought \
  --structured-output
```

### Optimize for Claude

```bash
cursor-prompt optimize -t "my-prompt" \
  --model "claude-3-opus" \
  --profile "constitutional" \
  --xml-structure \
  --safety-guidelines
```

### Optimize for Gemini

```bash
cursor-prompt optimize -t "my-prompt" \
  --model "gemini-pro" \
  --profile "efficiency" \
  --multimodal-ready \
  --compact-format
```

### Optimize for Multiple Models

```bash
cursor-prompt optimize -t "my-prompt" \
  --models "gpt-4,claude-3-opus,gemini-pro" \
  --create-variants \
  --output-dir "./model-variants/"
```

## Cost Optimization

### Minimize Token Usage

```bash
# Optimize for maximum token reduction
cursor-prompt optimize -t "my-prompt" \
  --focus "token-reduction" \
  --target-reduction 50 \
  --preserve-quality

# Economy optimization (highest savings)
cursor-prompt optimize -t "my-prompt" \
  --profile "economy" \
  --target-reduction 70
```

### Calculate Cost Savings

```bash
# Analyze current costs
cursor-prompt cost-analysis "templates/my-prompt.yaml" \
  --models "gpt-4,claude-3-opus" \
  --monthly-volume 1000

# Compare costs after optimization
cursor-prompt cost-compare \
  --original "templates/my-prompt.yaml" \
  --optimized "optimized/my-prompt.json" \
  --models "gpt-4" \
  --usage-projection 5000
```

## Quality Control

### Set Quality Thresholds

```bash
# Optimize with quality constraints
cursor-prompt optimize -t "my-prompt" \
  --min-quality-score 85 \
  --preserve-functionality \
  --validate-output

# Test optimized prompt
cursor-prompt test-optimization \
  --original "templates/my-prompt.yaml" \
  --optimized "optimized/my-prompt.json" \
  --test-cases "./tests/my-prompt-tests.json"
```

### Validation and Testing

```bash
# Validate optimization results
cursor-prompt validate \
  --template "optimized/my-prompt.json" \
  --against-original \
  --test-examples 10

# A/B test optimization
cursor-prompt ab-test \
  --control "templates/my-prompt.yaml" \
  --treatment "optimized/my-prompt.json" \
  --duration "7d" \
  --traffic-split "80,20"
```

## Automation Workflows

### Schedule Regular Optimization

```bash
# Set up automatic optimization
cursor-prompt schedule-optimization \
  --template "my-prompt" \
  --frequency "weekly" \
  --trigger-on-usage 100 \
  --auto-deploy-if-improved

# Create optimization pipeline
cursor-prompt create-pipeline \
  --name "my-prompt-optimization" \
  --stages "analyze,optimize,test,deploy" \
  --approval-required false
```

### Monitor Performance

```bash
# Set up monitoring
cursor-prompt monitor \
  --template "optimized/my-prompt.json" \
  --alert-on-degradation \
  --performance-threshold 80 \
  --notification-webhook "https://your-app.com/alerts"
```

## Integration Workflows

### Cursor IDE Integration

```bash
# Optimize current Cursor project prompts
cursor-prompt cursor:optimize-project \
  --scan-cursorrules \
  --update-in-place \
  --backup-originals

# Sync with Cursor settings
cursor-prompt cursor:sync \
  --update-cursorrules \
  --merge-optimizations
```

### Claude Code MCP Integration

```bash
# Use MCP tools for optimization
cursor-prompt mcp:optimize-prompt \
  --template "my-prompt" \
  --integrate-with-claude

# Batch optimize MCP contexts
cursor-prompt mcp:batch-optimize \
  --scan-project \
  --optimize-contexts
```

### Git Workflow Integration

```bash
# Optimize and commit
cursor-prompt optimize -t "my-prompt" --output "optimized/my-prompt.json"
git add optimized/my-prompt.json
git commit -m "feat: optimize my-prompt with PromptWizard"

# Pre-commit hook integration
cursor-prompt install-git-hook \
  --type "pre-commit" \
  --auto-optimize \
  --quality-gate 80
```

## Troubleshooting Common Issues

### Service Connection Problems

```bash
# Check service health
cursor-prompt health-check

# Test service connection
cursor-prompt test-connection --verbose

# Restart service (if running locally)
cursor-prompt service:restart
```

### Optimization Failures

```bash
# Debug optimization failure
cursor-prompt debug-optimization \
  --template "failing-prompt" \
  --log-level debug \
  --save-debug-info

# Retry with different settings
cursor-prompt optimize -t "failing-prompt" \
  --model "gpt-3.5-turbo" \
  --iterations 2 \
  --timeout 300
```

### Quality Issues

```bash
# Validate optimization quality
cursor-prompt validate-quality \
  --template "optimized/my-prompt.json" \
  --run-tests \
  --compare-outputs

# Rollback if needed
cursor-prompt rollback \
  --template "my-prompt" \
  --to-version "previous" \
  --reason "quality_degradation"
```

## Performance Tips

### Speed Up Optimization

- Use `--skip-cache` sparingly
- Reduce `--iterations` for faster results
- Use `--profile quick` for rapid optimization
- Process in batches with appropriate `--concurrency`

### Improve Results

- Provide more `--examples` for better optimization
- Use `--reasoning` flag for complex prompts
- Set appropriate `--priority` levels
- Specify clear `--task` descriptions

### Resource Management

- Monitor optimization queue with `cursor-prompt queue:status`
- Cancel long-running jobs with `cursor-prompt cancel <job-id>`
- Clean up old results with `cursor-prompt cleanup --older-than 30d`
- Manage cache with `cursor-prompt cache:clear` if needed

## Next Steps

After mastering these workflows:

- Explore [Advanced Optimization Techniques](../tutorials/advanced-optimization.md)
- Set up [Production Deployment](./setup-promptwizard.md#production-deployment)  
- Learn about [Self-Evolving Templates](../explanation/ml-optimization.md#self-evolving-systems)
- Check the [API Reference](../reference/promptwizard-api.md) for programmatic access