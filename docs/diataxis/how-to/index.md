# How-To Guides

Task-oriented guides for completing specific goals with the Cursor Prompt Template Engine.

## Quick Reference

### Essential Tasks
- [Install and initialize a project](#installation)
- [Generate a prompt from a template](#basic-generation)
- [Create a custom template](#custom-templates)
- [Sync with Cursor IDE](#cursor-sync)

### Template Management
- [Create templates with variables](./template-management.md#create-template-with-variables)
- [Validate template syntax](./template-management.md#validate-templates)
- [Use template inheritance](./template-management.md#template-inheritance)
- [Configure template metadata](./template-management.md#template-metadata)

### Marketplace Operations
- [Search for templates](./marketplace.md#search-templates)
- [Install marketplace templates](./marketplace.md#install-templates)
- [Publish your templates](./marketplace.md#publish-templates)
- [Update installed templates](./marketplace.md#update-templates)
- [Rate and review templates](./marketplace.md#rate-templates)

### Common Tasks
- [Generate bug fix prompts](./common-tasks.md#bug-fix-prompts)
- [Create feature requests](./common-tasks.md#feature-requests)
- [Set up code review templates](./common-tasks.md#code-review)
- [Configure automated context gathering](./common-tasks.md#context-gathering)

### Troubleshooting
- [Fix template validation errors](./troubleshooting.md#validation-errors)
- [Resolve marketplace connection issues](./troubleshooting.md#marketplace-issues)
- [Handle Cursor integration problems](./troubleshooting.md#cursor-integration)
- [Debug plugin loading failures](./troubleshooting.md#plugin-issues)

## Quick Start Commands

### Installation
```bash
# Install globally
npm install -g cursor-prompt

# Initialize project
cursor-prompt init

# Verify installation
cursor-prompt --version
```

### Basic Generation
```bash
# Generate from template
cursor-prompt generate feature --variables '{"feature_name": "user auth"}'

# List available templates
cursor-prompt list

# Copy to clipboard (default)
cursor-prompt generate bug-fix --copy
```

### Cursor Sync
```bash
# One-time sync
cursor-prompt sync

# Watch mode with auto-sync
cursor-prompt watch
```

## Navigation

| Guide | Purpose | Complexity |
|-------|---------|------------|
| [Common Tasks](./common-tasks.md) | Daily workflow tasks | Beginner |
| [Template Management](./template-management.md) | Create and manage templates | Intermediate |
| [Marketplace](./marketplace.md) | Use community templates | Beginner |
| [Troubleshooting](./troubleshooting.md) | Solve common problems | Intermediate |

---

*These guides assume you have basic familiarity with command-line tools and the Cursor IDE.*