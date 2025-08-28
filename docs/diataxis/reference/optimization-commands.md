---
title: "Optimization CLI Commands Reference"
description: "Complete reference for all PromptWizard CLI commands, options, and usage"
category: "reference"
tags: [cli, commands, reference]
---

# Optimization CLI Commands Reference

Complete reference for all CLI commands available in the PromptWizard integration.

## Quick Command Overview

| Command | Description | Alias |
|---------|-------------|-------|
| `prompt:optimize` | Optimize prompts using PromptWizard | `optimize`, `opt` |
| `prompt:compare` | Compare prompt versions | `compare`, `diff` |
| `prompt:score` | Score prompt quality | `score`, `rate` |
| `prompt:wizard` | Interactive optimization wizard | `wizard`, `wiz` |

## prompt:optimize

Optimize prompts using Microsoft PromptWizard.

### Syntax

```bash
cursor-prompt prompt:optimize [options]
cursor-prompt optimize [options]
cursor-prompt opt [options]
```

### Options

#### Template Selection

| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--template <name>` | `-t` | string | Template name or path to optimize | - |
| `--batch` | - | boolean | Optimize multiple templates | false |
| `--directory <path>` | `-d` | string | Directory to scan for templates | ./templates |

#### Optimization Configuration

| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--task <description>` | - | string | Task description for optimization | - |
| `--model <model>` | `-m` | string | Target AI model | gpt-4 |
| `--iterations <number>` | `-i` | number | Number of refinement iterations | 3 |
| `--examples <number>` | `-e` | number | Number of few-shot examples | 5 |
| `--reasoning` | - | boolean | Generate reasoning steps | true |
| `--profile <profile>` | `-p` | string | Optimization profile | balanced |

#### Processing Options

| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--output <path>` | `-o` | string | Output path for optimized template(s) | - |
| `--skip-cache` | - | boolean | Skip cache and force fresh optimization | false |
| `--priority <level>` | - | string | Optimization priority | normal |
| `--timeout <seconds>` | - | number | Maximum optimization time | 120 |
| `--concurrency <number>` | `-c` | number | Concurrent operations (batch mode) | 3 |

#### Quality Control

| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--min-quality <score>` | - | number | Minimum quality score threshold | - |
| `--preserve-quality` | - | boolean | Ensure quality doesn't degrade | false |
| `--validate-output` | - | boolean | Validate optimization results | true |
| `--target-reduction <percent>` | - | number | Target token reduction percentage | - |

### Supported Models

- `gpt-4` - OpenAI GPT-4
- `gpt-4-turbo` - OpenAI GPT-4 Turbo
- `gpt-3.5-turbo` - OpenAI GPT-3.5 Turbo
- `claude-3-opus` - Anthropic Claude 3 Opus
- `claude-3-sonnet` - Anthropic Claude 3 Sonnet
- `claude-3-haiku` - Anthropic Claude 3 Haiku
- `gemini-pro` - Google Gemini Pro
- `gemini-pro-vision` - Google Gemini Pro Vision
- `llama-2-70b` - Meta Llama 2 70B
- `llama-2-13b` - Meta Llama 2 13B
- `mixtral-8x7b` - Mistral Mixtral 8x7B

### Optimization Profiles

- `quick` - Fast optimization with minimal iterations
- `balanced` - Default balanced approach
- `thorough` - Comprehensive optimization
- `economy` - Focus on cost reduction
- `quality` - Focus on quality improvement
- `reasoning` - Optimize for reasoning tasks
- `efficiency` - Optimize for token efficiency

### Priority Levels

- `low` - Background processing
- `normal` - Standard priority
- `high` - Expedited processing
- `critical` - Highest priority

### Examples

#### Basic Single Optimization

```bash
# Optimize a single template
cursor-prompt optimize --template "customer-support"

# Optimize with specific model and settings
cursor-prompt opt -t "data-analysis" -m "claude-3-opus" -i 5 -e 8 --reasoning
```

#### Advanced Single Optimization

```bash
# Optimize with quality constraints
cursor-prompt optimize \
  --template "my-prompt" \
  --model "gpt-4" \
  --iterations 5 \
  --examples 10 \
  --min-quality 85 \
  --target-reduction 40 \
  --output "./optimized/my-prompt.json"
```

#### Batch Optimization

```bash
# Optimize all templates
cursor-prompt optimize --batch

# Optimize specific directory with constraints
cursor-prompt optimize \
  --batch \
  --directory "./templates/support" \
  --model "gpt-4" \
  --priority high \
  --concurrency 5 \
  --output "./optimized/support/"
```

#### Economy Optimization

```bash
# Maximum cost reduction
cursor-prompt optimize \
  --template "expensive-prompt" \
  --profile economy \
  --target-reduction 70 \
  --model "gpt-3.5-turbo"
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Template not found |
| 3 | Service unavailable |
| 4 | Optimization failed |
| 5 | Quality threshold not met |
| 6 | Timeout exceeded |

## prompt:compare

Compare prompt versions and generate diff reports.

### Syntax

```bash
cursor-prompt prompt:compare [options]
cursor-prompt compare [options]
cursor-prompt diff [options]
```

### Options

#### Input Selection

| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--original <path>` | `-o` | string | Original template path | - |
| `--optimized <path>` | `-n` | string | Optimized template path | - |
| `--templates <paths>` | `-t` | string | Comma-separated template paths | - |

#### Output Configuration

| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--format <format>` | `-f` | string | Output format | table |
| `--output <path>` | - | string | Save comparison to file | - |
| `--include-metrics` | `-m` | boolean | Include performance metrics | true |
| `--highlight-changes` | `-h` | boolean | Highlight differences | true |

#### Comparison Options

| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--detailed` | `-d` | boolean | Detailed comparison analysis | false |
| `--side-by-side` | `-s` | boolean | Side-by-side comparison | false |
| `--ignore-whitespace` | `-w` | boolean | Ignore whitespace differences | false |
| `--context-lines <number>` | `-c` | number | Context lines around changes | 3 |

### Output Formats

- `table` - Tabular comparison
- `markdown` - Markdown format
- `json` - JSON structure
- `html` - HTML report
- `diff` - Standard diff format
- `detailed` - Comprehensive analysis

### Examples

#### Basic Comparison

```bash
# Compare two templates
cursor-prompt compare \
  --original "templates/original.yaml" \
  --optimized "optimized/improved.json"

# Compare multiple versions
cursor-prompt compare --templates "v1.json,v2.json,v3.json"
```

#### Detailed Analysis

```bash
# Generate detailed comparison report
cursor-prompt compare \
  --original "original.yaml" \
  --optimized "optimized.json" \
  --format detailed \
  --include-metrics \
  --output "comparison-report.md"
```

#### Side-by-Side View

```bash
# Side-by-side HTML report
cursor-prompt compare \
  --original "original.yaml" \
  --optimized "optimized.json" \
  --format html \
  --side-by-side \
  --highlight-changes \
  --output "comparison.html"
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | File not found |
| 3 | Invalid format |
| 4 | Comparison failed |

## prompt:score

Score prompt quality and generate assessment reports.

### Syntax

```bash
cursor-prompt prompt:score [options] <template>
cursor-prompt score [options] <template>
cursor-prompt rate [options] <template>
```

### Arguments

| Argument | Type | Description | Required |
|----------|------|-------------|----------|
| `template` | string | Template name or path to score | Yes |

### Options

#### Scoring Configuration

| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--context <context>` | `-c` | string | Use case context | - |
| `--criteria <criteria>` | - | string | Comma-separated scoring criteria | all |
| `--model <model>` | `-m` | string | Model to score against | gpt-4 |
| `--detailed` | `-d` | boolean | Detailed scoring breakdown | false |

#### Output Options

| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--save-report` | `-s` | boolean | Save scoring report | false |
| `--output <path>` | `-o` | string | Output path for report | - |
| `--format <format>` | `-f` | string | Report format | json |

### Scoring Criteria

- `clarity` - Clarity and readability
- `completeness` - Instruction completeness
- `efficiency` - Token efficiency
- `consistency` - Internal consistency
- `robustness` - Input variation handling
- `alignment` - Task alignment
- `safety` - Safety and appropriateness

### Use Case Contexts

- `customer-support` - Customer service responses
- `code-generation` - Code generation tasks
- `creative-writing` - Creative content generation
- `data-analysis` - Data analysis and insights
- `education` - Educational content
- `technical` - Technical documentation

### Examples

#### Basic Scoring

```bash
# Score a template
cursor-prompt score "templates/customer-support.yaml"

# Score with specific context
cursor-prompt score \
  --context "customer-support" \
  --criteria "clarity,helpfulness,professionalism" \
  "templates/support.yaml"
```

#### Detailed Assessment

```bash
# Generate detailed report
cursor-prompt score \
  --detailed \
  --save-report \
  --output "quality-assessment.json" \
  "templates/complex-prompt.yaml"
```

#### Comparative Scoring

```bash
# Score for multiple models
cursor-prompt score \
  --model "gpt-4" \
  --context "code-generation" \
  --format markdown \
  --output "gpt4-score.md" \
  "templates/code-gen.yaml"
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Template not found |
| 3 | Invalid context |
| 4 | Scoring failed |

## prompt:wizard

Interactive optimization wizard for guided prompt improvement.

### Syntax

```bash
cursor-prompt prompt:wizard [options]
cursor-prompt wizard [options]
cursor-prompt wiz [options]
```

### Options

#### Template Options

| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--template <name>` | `-t` | string | Existing template to optimize | - |
| `--create-new` | `-n` | boolean | Create new template | false |
| `--model <model>` | `-m` | string | Target model | gpt-4 |

#### Wizard Configuration

| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--skip-intro` | `-s` | boolean | Skip introduction | false |
| `--auto-examples` | `-a` | boolean | Auto-generate examples | true |
| `--interactive-review` | `-i` | boolean | Interactive result review | true |

### Wizard Steps

1. **Template Selection** - Choose existing or create new template
2. **Task Definition** - Describe the optimization goals
3. **Model Selection** - Choose target AI model
4. **Example Collection** - Provide or generate examples
5. **Configuration** - Set optimization parameters
6. **Optimization** - Run the optimization process
7. **Review** - Review and approve results
8. **Save** - Save the optimized template

### Examples

#### Start Wizard

```bash
# Launch interactive wizard
cursor-prompt wizard

# Start with existing template
cursor-prompt wizard --template "my-prompt"

# Quick wizard mode
cursor-prompt wiz --skip-intro --auto-examples
```

#### Guided Creation

```bash
# Create new template with wizard
cursor-prompt wizard \
  --create-new \
  --model "claude-3-opus" \
  --interactive-review
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success - optimization completed |
| 1 | General error |
| 2 | User cancelled |
| 3 | Template creation failed |
| 4 | Optimization failed |

## Global Options

These options are available for all optimization commands.

### Common Options

| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--help` | `-h` | boolean | Show command help | - |
| `--version` | `-V` | boolean | Show version information | - |
| `--verbose` | `-v` | boolean | Verbose output | false |
| `--quiet` | `-q` | boolean | Suppress non-essential output | false |
| `--config <path>` | - | string | Custom configuration file | - |
| `--dry-run` | - | boolean | Show what would be done | false |

### Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--service-url <url>` | string | PromptWizard service URL | http://localhost:8000 |
| `--api-key <key>` | string | API key for authentication | - |
| `--timeout <seconds>` | number | Request timeout | 120 |
| `--retries <number>` | number | Number of retry attempts | 3 |

### Debug Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--debug` | boolean | Enable debug logging | false |
| `--log-level <level>` | string | Log level (debug, info, warn, error) | info |
| `--save-debug` | boolean | Save debug information | false |

## Environment Variables

### Service Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PROMPTWIZARD_SERVICE_URL` | PromptWizard service URL | http://localhost:8000 |
| `PROMPTWIZARD_API_KEY` | API key for authentication | - |
| `PROMPTWIZARD_TIMEOUT` | Request timeout in milliseconds | 120000 |
| `PROMPTWIZARD_RETRIES` | Number of retry attempts | 3 |

### Model API Keys

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_API_KEY` | Google AI API key |
| `XAI_API_KEY` | xAI API key |

### Cache Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PROMPTWIZARD_CACHE_ENABLED` | Enable result caching | true |
| `PROMPTWIZARD_CACHE_TTL` | Cache TTL in seconds | 3600 |
| `REDIS_URL` | Redis URL for distributed caching | - |

### Logging

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level | info |
| `LOG_FORMAT` | Log format (json, pretty) | pretty |
| `DEBUG` | Enable debug mode | false |

## Configuration Files

### Global Configuration

Location: `~/.cursor-prompt/config.json`

```json
{
  "promptwizard": {
    "service": {
      "url": "http://localhost:8000",
      "apiKey": "your-api-key",
      "timeout": 120000,
      "retries": 3
    },
    "optimization": {
      "defaultModel": "gpt-4",
      "defaultProfile": "balanced",
      "autoOptimize": false
    },
    "cache": {
      "enabled": true,
      "ttl": 3600
    }
  }
}
```

### Project Configuration

Location: `./cursor-prompt.config.json`

```json
{
  "promptwizard": {
    "optimization": {
      "defaultModel": "claude-3-opus",
      "mutateRefineIterations": 5,
      "generateReasoning": true
    },
    "batch": {
      "concurrency": 5,
      "defaultPriority": "high"
    }
  }
}
```

## Error Handling

### Common Error Scenarios

#### Service Connection Errors

```bash
# Check service health
cursor-prompt health-check

# Test connection with verbose output
cursor-prompt optimize --template "test" --dry-run --verbose
```

#### Authentication Errors

```bash
# Verify API key
cursor-prompt --api-key "your-key" health-check

# Set API key via environment
export PROMPTWIZARD_API_KEY="your-key"
```

#### Template Errors

```bash
# Validate template syntax
cursor-prompt validate templates/my-template.yaml

# List available templates
cursor-prompt list --templates
```

### Exit Code Reference

| Code | Category | Description |
|------|----------|-------------|
| 0 | Success | Operation completed successfully |
| 1 | General | General error or exception |
| 2 | Input | Invalid input or missing file |
| 3 | Service | Service unavailable or connection error |
| 4 | Process | Operation or optimization failed |
| 5 | Quality | Quality threshold not met |
| 6 | Timeout | Operation timeout |
| 7 | Auth | Authentication or authorization error |
| 8 | Config | Configuration error |
| 9 | Resource | Insufficient resources or limits exceeded |

## Command Aliases

| Full Command | Aliases | Description |
|--------------|---------|-------------|
| `prompt:optimize` | `optimize`, `opt` | Main optimization command |
| `prompt:compare` | `compare`, `diff` | Comparison command |
| `prompt:score` | `score`, `rate` | Quality scoring command |
| `prompt:wizard` | `wizard`, `wiz` | Interactive wizard |

## Shell Completion

Enable shell completion for better command-line experience:

### Bash

```bash
# Add to ~/.bashrc
eval "$(cursor-prompt completion bash)"
```

### Zsh

```bash
# Add to ~/.zshrc
eval "$(cursor-prompt completion zsh)"
```

### Fish

```bash
# Add to ~/.config/fish/config.fish
cursor-prompt completion fish | source
```

This completes the comprehensive CLI commands reference for PromptWizard integration.