# Marketplace

Discover, install, and share templates through the community marketplace.

## Search Templates

### Basic search
```bash
cursor-prompt marketplace:search "typescript"
```

### Search with filters
```bash
cursor-prompt marketplace:search "react component" --category development --tag typescript
```

### Search by author
```bash
cursor-prompt marketplace:search --author john-doe
```

### Advanced search with multiple criteria
```bash
cursor-prompt marketplace:search \
  --query "authentication" \
  --category security \
  --tags "jwt,oauth" \
  --min-rating 4
```

## Install Templates

### Install latest version
```bash
cursor-prompt marketplace:install awesome-template
```

### Install specific version
```bash
cursor-prompt marketplace:install awesome-template@1.2.0
```

### Install with custom name
```bash
cursor-prompt marketplace:install awesome-template --as my-custom-template
```

### Batch install multiple templates
```bash
cursor-prompt marketplace:batch-install \
  --templates "react-component,typescript-service,api-endpoint" \
  --confirm
```

### Install from URL
```bash
cursor-prompt marketplace:install https://github.com/user/template-repo
```

## Install Wizard

### Interactive installation
```bash
cursor-prompt marketplace:install-wizard
```

This launches an interactive wizard that:
1. Shows popular templates
2. Filters by your project type
3. Suggests compatible templates
4. Handles installation automatically

### Quick install for specific use case
```bash
cursor-prompt marketplace:quick-install --use-case "react-development"
```

## Template Information

### View template details
```bash
cursor-prompt marketplace:info awesome-template
```

### Show installation statistics
```bash
cursor-prompt marketplace:info awesome-template --stats
```

### View template source
```bash
cursor-prompt marketplace:info awesome-template --show-source
```

### Check version history
```bash
cursor-prompt marketplace:version awesome-template --history
```

## Publish Templates

### Initialize template for publishing
```bash
# Create template manifest
cursor-prompt marketplace:init-publish ./templates/my-template.yaml
```

### Publish new template
```bash
cursor-prompt marketplace:publish \
  --template ./templates/my-awesome-template.yaml \
  --version 1.0.0 \
  --category productivity \
  --tags "automation,workflow"
```

### Publish with detailed metadata
```bash
cursor-prompt marketplace:publish \
  --template my-template \
  --version 1.0.0 \
  --description "Comprehensive React component generator" \
  --category development \
  --tags "react,typescript,testing" \
  --license MIT \
  --homepage https://github.com/user/template \
  --readme README.md
```

### Publish organization template
```bash
cursor-prompt marketplace:publish \
  --template company-standards \
  --organization my-company \
  --private  # Only visible to organization members
```

## Update Templates

### Update single template
```bash
cursor-prompt marketplace:update awesome-template
```

### Update all installed templates
```bash
cursor-prompt marketplace:update --all
```

### Update with version constraints
```bash
cursor-prompt marketplace:update --template awesome-template --version "^1.2.0"
```

### Check for updates without installing
```bash
cursor-prompt marketplace:update --check-only
```

### Selective update with preview
```bash
cursor-prompt marketplace:update \
  --templates "template1,template2" \
  --preview \
  --interactive
```

## Rate and Review Templates

### Rate a template
```bash
cursor-prompt marketplace:rate awesome-template --stars 5
```

### Add review with comment
```bash
cursor-prompt marketplace:rate awesome-template \
  --stars 4 \
  --comment "Great template, works perfectly for my React projects"
```

### Update your existing review
```bash
cursor-prompt marketplace:rate awesome-template \
  --stars 5 \
  --comment "Even better after the latest update!" \
  --update
```

### View template reviews
```bash
cursor-prompt marketplace:info awesome-template --reviews
```

## Author Management

### View author profile
```bash
cursor-prompt marketplace:author:profile john-doe
```

### List author's templates
```bash
cursor-prompt marketplace:author:templates john-doe
```

### Follow an author
```bash
cursor-prompt marketplace:author:follow john-doe
```

### View author statistics
```bash
cursor-prompt marketplace:author:stats john-doe
```

## List Marketplace Templates

### List popular templates
```bash
cursor-prompt marketplace:list --popular
```

### List by category
```bash
cursor-prompt marketplace:list --category development
```

### List recently updated
```bash
cursor-prompt marketplace:list --recent
```

### List your installed templates
```bash
cursor-prompt marketplace:list --installed
```

### List with detailed information
```bash
cursor-prompt marketplace:list --detailed --limit 10
```

## Template Dependencies

### Install template with dependencies
```bash
cursor-prompt marketplace:install complex-template --with-deps
```

### View dependency tree
```bash
cursor-prompt marketplace:info complex-template --dependencies
```

### Update dependencies only
```bash
cursor-prompt marketplace:update complex-template --deps-only
```

## Private and Organization Templates

### List organization templates
```bash
cursor-prompt marketplace:list --organization my-company
```

### Install private template
```bash
cursor-prompt marketplace:install private-template --token $ACCESS_TOKEN
```

### Publish to organization
```bash
cursor-prompt marketplace:publish \
  --template internal-standard \
  --organization my-company \
  --visibility private
```

## Template Collections

### Install template collection
```bash
cursor-prompt marketplace:install-collection react-starter-pack
```

### Create your own collection
```bash
cursor-prompt marketplace:create-collection \
  --name "My Development Pack" \
  --templates "component,service,test-suite" \
  --description "Essential templates for my projects"
```

### Share collection
```bash
cursor-prompt marketplace:publish-collection my-dev-pack --public
```

## Marketplace Configuration

### Set API endpoint
```bash
cursor-prompt config set marketplace.api "https://custom-marketplace.com"
```

### Configure authentication
```bash
cursor-prompt marketplace:login
cursor-prompt marketplace:token --set $API_TOKEN
```

### Set default installation directory
```bash
cursor-prompt config set marketplace.installDir "./custom-templates"
```

## Offline Mode

### Download templates for offline use
```bash
cursor-prompt marketplace:download awesome-template --offline
```

### Sync offline templates
```bash
cursor-prompt marketplace:sync-offline
```

### List cached templates
```bash
cursor-prompt marketplace:list --offline
```

## Import/Export

### Export installed templates list
```bash
cursor-prompt marketplace:export --format json > my-templates.json
```

### Import templates from list
```bash
cursor-prompt marketplace:import my-templates.json
```

### Export specific templates
```bash
cursor-prompt marketplace:export \
  --templates "template1,template2" \
  --include-data \
  --output templates-backup.tar.gz
```

## Marketplace Analytics

### View your template usage stats
```bash
cursor-prompt marketplace:stats --author $USER
```

### Template popularity metrics
```bash
cursor-prompt marketplace:info awesome-template --analytics
```

### Installation trends
```bash
cursor-prompt marketplace:trends --period 30d --category development
```

## Troubleshooting Marketplace

### Clear marketplace cache
```bash
cursor-prompt marketplace:cache:clear
```

### Verify marketplace connection
```bash
cursor-prompt marketplace:status
```

### Re-authenticate
```bash
cursor-prompt marketplace:logout
cursor-prompt marketplace:login
```

### Reset marketplace configuration
```bash
cursor-prompt marketplace:reset --confirm
```

---

*For troubleshooting specific marketplace issues, see the [Troubleshooting](./troubleshooting.md) guide.*