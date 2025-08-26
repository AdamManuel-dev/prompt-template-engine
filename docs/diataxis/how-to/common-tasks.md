# Common Tasks

Daily workflow tasks for the Cursor Prompt Template Engine.

## Bug Fix Prompts

### Generate a basic bug fix prompt
```bash
cursor-prompt generate bug-fix --variables '{"error": "TypeError: Cannot read property", "location": "auth.ts:45"}'
```

### Include git diff in bug fix
```bash
cursor-prompt generate bug-fix --variables '{"error": "Login fails", "include_diff": true}'
```

### Bug fix with specific file context
```bash
cursor-prompt generate bug-fix \
  --variables '{"error": "API timeout", "files": "src/api/*.ts"}' \
  --output bug-report.md
```

## Feature Requests

### Generate feature development prompt
```bash
cursor-prompt generate feature --variables '{
  "feature_name": "Dark mode toggle",
  "requirements": "Toggle switch in settings page"
}'
```

### Feature with implementation plan
```bash
cursor-prompt generate feature --variables '{
  "feature_name": "User notifications",
  "technical_approach": "WebSocket connection with Redis",
  "files_to_modify": "src/notifications/, src/websocket/"
}'
```

### Copy feature prompt to clipboard
```bash
cursor-prompt generate feature --variables '{"feature_name": "Export data"}' --copy
```

## Code Review

### Generate code review checklist
```bash
cursor-prompt generate code-review --variables '{
  "review_type": "security",
  "files": "src/auth/",
  "focus_areas": "input validation, encryption"
}'
```

### Review specific pull request
```bash
cursor-prompt generate code-review --variables '{
  "pr_number": "123",
  "author": "john-doe",
  "include_diff": true
}'
```

## Context Gathering

### Auto-gather project context
```bash
# Includes git diff, open files, terminal output
cursor-prompt generate refactor --variables '{"goal": "Extract service layer"}'
```

### Disable auto-context for faster execution
```bash
cursor-prompt generate feature --no-context --variables '{"feature_name": "API cache"}'
```

### Include specific files only
```bash
cursor-prompt generate refactor \
  --variables '{"files": "src/components/UserList.tsx", "goal": "Performance optimization"}'
```

## Template Validation

### Validate single template
```bash
cursor-prompt validate ./templates/my-template.yaml
```

### Validate all templates in directory
```bash
find templates/ -name "*.yaml" -exec cursor-prompt validate {} \;
```

## Configuration Management

### View current configuration
```bash
cursor-prompt config --show
```

### Set default template
```bash
cursor-prompt config set defaultTemplate feature
```

### Enable clipboard auto-copy
```bash
cursor-prompt config set outputPreferences.copyToClipboard true
```

## Output Management

### Save to specific file
```bash
cursor-prompt generate feature --output ./prompts/feature-request.md
```

### Preview without copying to clipboard
```bash
cursor-prompt generate bug-fix --preview --no-clipboard
```

### Format output as JSON
```bash
cursor-prompt generate feature --format json --variables '{"feature_name": "Search"}'
```

## Template Listing and Discovery

### List all available templates
```bash
cursor-prompt list
```

### List with detailed information
```bash
cursor-prompt list --detailed
```

### Filter templates by tags
```bash
cursor-prompt list --tags "debugging,typescript"
```

### Show template metadata
```bash
cursor-prompt list --template feature --show-metadata
```

## Working with Variables

### Pass variables via JSON string
```bash
cursor-prompt generate feature --variables '{"name": "auth", "type": "service"}'
```

### Load variables from file
```bash
echo '{"feature_name": "search", "priority": "high"}' > vars.json
cursor-prompt generate feature --file vars.json
```

### Use environment variables in templates
```bash
export PROJECT_NAME="my-app"
cursor-prompt generate feature --variables '{"project": "$PROJECT_NAME"}'
```

## Batch Operations

### Generate multiple prompts
```bash
for template in feature bug-fix refactor; do
  cursor-prompt generate $template --output "${template}-prompt.md"
done
```

### Validate multiple templates
```bash
cursor-prompt validate templates/*.{yaml,json,md}
```

## Integration with Tools

### Pipe output to other tools
```bash
# Send to clipboard manually
cursor-prompt generate feature --no-clipboard | pbcopy

# Save and open in editor
cursor-prompt generate bug-fix --output report.md && code report.md

# Chain with git commands
cursor-prompt generate feature | git commit -F -
```

### Use in shell scripts
```bash
#!/bin/bash
prompt=$(cursor-prompt generate feature --variables '{"name": "'"$1"'"}')
echo "$prompt" | clipboard-tool
```

## Watch Mode for Development

### Auto-sync templates during development
```bash
cursor-prompt watch --dir ./templates
```

### Watch with specific sync interval
```bash
cursor-prompt watch --interval 3000  # 3 seconds
```

## Quick Troubleshooting Commands

### Check installation
```bash
cursor-prompt --version
cursor-prompt list  # Should show built-in templates
```

### Test template generation
```bash
cursor-prompt generate feature --variables '{"feature_name": "test"}' --preview
```

### Verify Cursor integration
```bash
cursor-prompt sync --dry-run  # Preview sync without applying
```

---

*For complex template creation and management, see the [Template Management](./template-management.md) guide.*