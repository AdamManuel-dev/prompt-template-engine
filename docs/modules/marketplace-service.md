# Marketplace Service Module

## Purpose
The Marketplace Service module provides comprehensive functionality for discovering, installing, publishing, and managing community templates. It handles all interactions with the template marketplace, including authentication, versioning, ratings, and author management.

## Dependencies
- Internal: Template Service, Author Service, Version Manager, Config Service
- External: axios, semver, tar, crypto

## Key Components

### MarketplaceService
Core service for marketplace operations.

#### Public API
- `search(query: string, options?: SearchOptions): Promise<SearchResults>` - Search templates
- `install(templateId: string, version?: string): Promise<void>` - Install template
- `publish(template: TemplateManifest): Promise<PublishResult>` - Publish template
- `update(templateId: string, manifest: TemplateManifest): Promise<void>` - Update template
- `getTemplateInfo(templateId: string): Promise<TemplateInfo>` - Get template details
- `rate(templateId: string, rating: Rating): Promise<void>` - Rate template
- `getPopular(limit?: number): Promise<Template[]>` - Get popular templates
- `getTrending(period?: string): Promise<Template[]>` - Get trending templates

### AuthorService
Manages author profiles and authentication.

#### Public API
- `register(authorData: AuthorRegistration): Promise<Author>` - Register author
- `authenticate(credentials: Credentials): Promise<AuthToken>` - Login
- `getProfile(authorId: string): Promise<AuthorProfile>` - Get author profile
- `getTemplates(authorId: string): Promise<Template[]>` - Get author's templates
- `follow(authorId: string): Promise<void>` - Follow author
- `getStats(authorId: string): Promise<AuthorStats>` - Get author statistics

### VersionManager
Handles template versioning and updates.

#### Public API
- `checkUpdate(templateId: string): Promise<UpdateInfo>` - Check for updates
- `getVersions(templateId: string): Promise<Version[]>` - Get all versions
- `getChangelog(templateId: string, version: string): Promise<string>` - Get changelog
- `rollback(templateId: string, version: string): Promise<void>` - Rollback to version

## Usage Examples

### Searching Templates
```typescript
import { MarketplaceService } from './marketplace/core/marketplace.service';

const marketplace = new MarketplaceService();

// Simple search
const results = await marketplace.search('typescript testing');

// Advanced search with filters
const filtered = await marketplace.search('testing', {
  category: 'development',
  tags: ['typescript', 'jest'],
  author: 'popular-author',
  minRating: 4.5,
  sortBy: 'downloads',
  limit: 20
});

results.templates.forEach(t => {
  console.log(`${t.name} - ${t.rating}★ (${t.downloads} downloads)`);
});
```

### Installing Templates
```typescript
const marketplace = new MarketplaceService();

// Install latest version
await marketplace.install('awesome-template');

// Install specific version
await marketplace.install('awesome-template', '2.1.0');

// Install with progress tracking
marketplace.on('install:progress', (progress) => {
  console.log(`Installing: ${progress.percent}%`);
});

await marketplace.install('large-template');
```

### Publishing Templates
```typescript
const marketplace = new MarketplaceService();

const manifest = {
  name: 'my-template',
  version: '1.0.0',
  description: 'Amazing template for X',
  author: 'your-username',
  category: 'productivity',
  tags: ['automation', 'typescript'],
  license: 'MIT',
  repository: 'https://github.com/user/template',
  files: ['template.md', 'partials/**/*'],
  dependencies: {
    'base-template': '^1.0.0'
  }
};

const result = await marketplace.publish(manifest);
console.log('Published:', result.url);
console.log('Template ID:', result.templateId);
```

### Author Management
```typescript
import { AuthorService } from './marketplace/core/author.service';

const authorService = new AuthorService();

// Register as author
const author = await authorService.register({
  username: 'developer123',
  email: 'dev@example.com',
  bio: 'Template developer',
  github: 'github-username'
});

// Get author profile
const profile = await authorService.getProfile('popular-author');
console.log(`${profile.name} - ${profile.followers} followers`);
console.log(`Templates: ${profile.templateCount}`);
console.log(`Total downloads: ${profile.totalDownloads}`);

// Follow author
await authorService.follow('popular-author');

// Get author's templates
const templates = await authorService.getTemplates('popular-author');
```

### Version Management
```typescript
import { VersionManager } from './marketplace/core/version.manager';

const versionManager = new VersionManager();

// Check for updates
const updateInfo = await versionManager.checkUpdate('my-template');
if (updateInfo.hasUpdate) {
  console.log(`Update available: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`);
  console.log('Changelog:', updateInfo.changelog);
}

// Get version history
const versions = await versionManager.getVersions('my-template');
versions.forEach(v => {
  console.log(`${v.version} - ${v.publishedAt} - ${v.downloads} downloads`);
});

// Rollback to previous version
await versionManager.rollback('my-template', '1.2.0');
```

### Rating and Reviews
```typescript
const marketplace = new MarketplaceService();

// Rate a template
await marketplace.rate('awesome-template', {
  stars: 5,
  review: 'Excellent template! Saved me hours of work.',
  wouldRecommend: true
});

// Get template reviews
const info = await marketplace.getTemplateInfo('awesome-template');
console.log(`Rating: ${info.rating}★ (${info.reviewCount} reviews)`);

info.reviews.forEach(review => {
  console.log(`${review.author}: ${review.stars}★ - ${review.text}`);
});
```

## Configuration
Marketplace configuration in `.cursorprompt.json`:

```json
{
  "marketplace": {
    "enabled": true,
    "apiUrl": "https://api.cursor-prompt.com",
    "apiKey": "your-api-key",
    "cacheDir": ".cursor/.marketplace-cache",
    "autoUpdate": true,
    "updateCheckInterval": 86400,
    "maxCacheSize": 100,
    "timeout": 30000,
    "registry": {
      "url": "https://registry.cursor-prompt.com",
      "public": true
    }
  }
}
```

## API Authentication
```typescript
// Set API key for authenticated operations
marketplace.setApiKey('your-api-key');

// Or use environment variable
process.env.CURSOR_MARKETPLACE_API_KEY = 'your-api-key';

// Login with credentials
const token = await marketplace.login({
  username: 'your-username',
  password: 'your-password'
});
marketplace.setAuthToken(token);
```

## Template Manifest Structure
```yaml
# template.manifest.yaml
name: template-name
version: 1.0.0
description: Template description
author: author-username
license: MIT
category: development
tags:
  - typescript
  - testing
  - automation

# Repository information
repository:
  type: git
  url: https://github.com/user/template

# Template files
files:
  - template.md
  - partials/**/*.md
  - config.yaml

# Dependencies on other templates
dependencies:
  base-template: "^2.0.0"
  helper-template: "~1.5.0"

# Development dependencies
devDependencies:
  test-template: "^1.0.0"

# Peer dependencies
peerDependencies:
  cursor-prompt: ">=1.0.0"

# Requirements
requirements:
  node: ">=14.0.0"
  cursor-prompt: ">=1.5.0"

# Scripts to run
scripts:
  postinstall: "npm install"
  test: "npm test"

# Keywords for search
keywords:
  - productivity
  - automation
  - typescript

# Metadata
metadata:
  screenshots:
    - url: https://example.com/screenshot1.png
      caption: Template in action
  documentation: https://example.com/docs
  changelog: https://example.com/changelog
  issues: https://github.com/user/template/issues
```

## Error Handling
```typescript
try {
  await marketplace.install('template');
} catch (error) {
  if (error.code === 'TEMPLATE_NOT_FOUND') {
    console.error('Template does not exist');
  } else if (error.code === 'VERSION_NOT_FOUND') {
    console.error('Specified version not available');
  } else if (error.code === 'AUTH_REQUIRED') {
    console.error('Authentication required for this operation');
  } else if (error.code === 'RATE_LIMIT') {
    console.error('Rate limit exceeded, try again later');
  }
}
```

## Batch Operations
```typescript
// Batch install templates
await marketplace.batchInstall([
  { name: 'template1', version: 'latest' },
  { name: 'template2', version: '2.0.0' },
  { name: 'template3', version: '^1.0.0' }
]);

// Install wizard for interactive selection
await marketplace.installWizard({
  category: 'development',
  interactive: true
});

// Quick install from curated list
await marketplace.quickInstall('starter-pack');
```

## Cache Management
```typescript
// Clear marketplace cache
marketplace.clearCache();

// Get cache statistics
const stats = marketplace.getCacheStats();
console.log(`Cache size: ${stats.size} MB`);
console.log(`Cached templates: ${stats.templateCount}`);

// Preload popular templates
await marketplace.preloadPopular();
```

## Security Considerations
- API keys stored securely in environment variables
- Template signatures verified before installation
- Sandboxed template execution during validation
- Rate limiting on API calls
- HTTPS required for all marketplace communications
- Author identity verification for publishing

## Performance Optimization
- Template metadata cached locally
- Incremental updates for large templates
- Parallel downloads for dependencies
- CDN distribution for popular templates
- Compressed transfer with gzip/brotli

## Webhooks and Events
```typescript
// Subscribe to marketplace events
marketplace.on('template:published', (template) => {
  console.log('New template published:', template.name);
});

marketplace.on('template:updated', (template) => {
  console.log('Template updated:', template.name);
});

marketplace.on('author:followed', (author) => {
  console.log('Now following:', author.name);
});

// Webhook configuration
marketplace.configureWebhook({
  url: 'https://your-server.com/webhook',
  events: ['template:published', 'template:updated'],
  secret: 'webhook-secret'
});
```

## Related Documentation
- [Template Service](./template-service.md) - Template management
- [Author Service](./author-service.md) - Author operations
- [Version Manager](./version-manager.md) - Version control
- [Plugin Development](../PLUGIN_DEVELOPMENT.md) - Creating plugins
- [Marketplace Guidelines](../MARKETPLACE_GUIDELINES.md) - Publishing guidelines