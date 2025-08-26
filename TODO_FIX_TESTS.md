# TODO: Fix E2E Test Failures

## Overview

This document tracks all features that need implementation based on E2E test failures.
Each item includes specific implementation steps to resolve the test failures.

**Status**: 30 tests passing, 23 failing
**Goal**: 100% test pass rate

---

## 🚨 Critical Fixes (Blocking Basic Usage)

### 1. CLI Template Discovery

**Files**: `src/cli.ts`, `src/services/template.service.ts`
**Tests**: `tests/e2e/cli-commands.test.ts`

- [ ] Fix `TemplateService.findTemplate()` to search in multiple directories
  - [ ] Check current directory `./templates/`
  - [ ] Check `.cursor/templates/`
  - [ ] Support both `.yaml` and `.md` extensions
- [ ] Update `generate` command to handle template path resolution
  - [ ] If template name provided, search for `{name}.yaml` or `{name}.md`
  - [ ] Return full path when found
- [ ] Fix `list` command template discovery
  - [ ] Use `glob` to find all template files
  - [ ] Parse frontmatter from each template
  - [ ] Return template metadata array
- [ ] Fix `validate` command path handling
  - [ ] Support both absolute and relative paths
  - [ ] Auto-append extension if missing

### 2. Export Missing Classes

**Files**: `src/marketplace/database/file-database.ts`
**Tests**: `tests/e2e/marketplace.test.ts`

- [ ] Add export statement for `FileDatabase` class

  ```typescript
  export { FileDatabase } from './file-database';
  ```

- [ ] Update barrel export in `src/marketplace/database/index.ts`

---

## 🔧 Plugin System Implementation

### 3. SecurePluginManager API

**File**: `src/plugins/secure-plugin-manager.ts`
**Tests**: `tests/e2e/plugin-system.test.ts`

- [ ] Update constructor to accept options object

  ```typescript
  interface PluginManagerOptions {
    pluginsPath: string;
    enableSandbox?: boolean;
    timeout?: number;
    memoryLimit?: number;
  }
  constructor(options: PluginManagerOptions)
  ```

- [ ] Add missing methods:
  - [ ] `async loadPlugins()`: Wrapper for `loadPluginsFromDirectory()`
  - [ ] `getLoadedPlugins()`: Return array of loaded plugins
  - [ ] `async shutdown()`: Cleanup all plugins and sandbox
  - [ ] `getValidationErrors()`: Return validation error array
  - [ ] `async executeHook(name, ...args)`: Execute hooks on all plugins
  - [ ] `getHelpers()`: Return aggregated helpers from plugins
  - [ ] `async enablePlugin(name)`: Enable specific plugin
  - [ ] `async disablePlugin(name)`: Disable specific plugin
  - [ ] `async initializePlugins()`: Call init on all plugins

### 4. Plugin Execution Implementation

**File**: `src/plugins/secure-plugin-manager.ts`

- [ ] Implement hook execution system
  - [ ] Store hooks by name in Map
  - [ ] Execute hooks in priority order
  - [ ] Pass results between hook calls
  - [ ] Handle async hooks properly
- [ ] Implement helper aggregation
  - [ ] Collect helpers from all plugins
  - [ ] Handle naming conflicts (last wins or namespace)
  - [ ] Make helpers available to templates

---

## 🛍️ Marketplace Service Implementation

### 5. Make MarketplaceService Public

**File**: `src/marketplace/core/marketplace.service.ts`
**Tests**: `tests/e2e/marketplace.test.ts`

- [ ] Change constructor from private to public
- [ ] Or add static factory method: `static create(database)`

### 6. Implement Search Methods

**File**: `src/marketplace/core/marketplace.service.ts`

- [ ] `async searchByTags(tags: string[])`
  - [ ] Filter templates where any tag matches
  - [ ] Return TemplateModel[]

- [ ] `async searchByCategory(category: string)`
  - [ ] Filter by category field
  - [ ] Return TemplateModel[]

- [ ] `async getPopularTemplates(limit: number)`
  - [ ] Sort by downloads descending
  - [ ] Return top N templates

- [ ] `async getTopRated(limit: number)`
  - [ ] Sort by rating descending
  - [ ] Return top N templates

- [ ] `async getByAuthor(author: string)`
  - [ ] Filter by author field
  - [ ] Return TemplateModel[]

- [ ] `async getTrending(hours: number)`
  - [ ] Track recent downloads with timestamps
  - [ ] Calculate trending score
  - [ ] Return sorted by trend

### 7. Implement Installation Features

**File**: `src/marketplace/core/marketplace.service.ts`

- [ ] `async installTemplate(id, targetPath, options?)`
  - [ ] Download template from registry
  - [ ] Extract to target path
  - [ ] Install dependencies if specified
  - [ ] Return installation result

- [ ] `async batchInstall(ids, targetPath)`
  - [ ] Install multiple templates
  - [ ] Track success/failure for each
  - [ ] Return batch result

- [ ] `async checkUpdates(installedPath)`
  - [ ] Read installed versions
  - [ ] Compare with marketplace
  - [ ] Return available updates

- [ ] `async updateTemplate(id, installedPath)`
  - [ ] Backup current version
  - [ ] Install new version
  - [ ] Return update result

- [ ] `async updateAll(installedPath)`
  - [ ] Update all templates with updates
  - [ ] Return batch update result

- [ ] `async rollbackTemplate(id, version, installedPath)`
  - [ ] Find specific version
  - [ ] Replace current with specified
  - [ ] Return rollback result

### 8. Implement Rating System

**File**: `src/marketplace/core/marketplace.service.ts`

- [ ] `async rateTemplate(id, rating, userId)`
  - [ ] Store rating in database
  - [ ] Update average rating
  - [ ] Return new rating stats

- [ ] `async addReview(id, review)`
  - [ ] Validate review structure
  - [ ] Store in database
  - [ ] Return success status

- [ ] `async getReviews(id)`
  - [ ] Fetch all reviews for template
  - [ ] Sort by date/helpfulness
  - [ ] Return review array

### 9. Implement Tracking Features

**File**: `src/marketplace/core/marketplace.service.ts`

- [ ] `async recordDownload(id)`
  - [ ] Increment download counter
  - [ ] Store timestamp
  - [ ] Update trending data

- [ ] `async getCacheSize()`
  - [ ] Calculate total cache size
  - [ ] Return size in bytes

- [ ] `async clearCache()`
  - [ ] Remove all cached templates
  - [ ] Reset cache metadata
  - [ ] Return cleared size

---

## 📝 Template System Enhancements

### 10. Implement Array Access Syntax

**File**: `src/core/template-engine.ts`
**Tests**: `tests/e2e/template-system.test.ts`

- [ ] Add support for bracket notation: `{{items.[0]}}`
  - [ ] Parse bracket notation in variable processor
  - [ ] Convert to array index access
  - [ ] Handle out of bounds gracefully

### 11. Implement Empty Array Handling

**File**: `src/core/template-engine.ts`

- [ ] Fix `{{#each}}...{{else}}...{{/each}}` syntax
  - [ ] Check if array is empty
  - [ ] Render else block when empty
  - [ ] Skip iteration block

### 12. Implement String Helpers

**File**: `src/core/template-helpers.ts`

- [ ] Add `uppercase` helper

  ```typescript
  helpers.uppercase = str => str?.toUpperCase() || '';
  ```

- [ ] Add `lowercase` helper

  ```typescript
  helpers.lowercase = str => str?.toLowerCase() || '';
  ```

- [ ] Add `titlecase` helper

  ```typescript
  helpers.titlecase = str =>
    str?.replace(
      /\w\S*/g,
      txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  ```

### 13. Implement Recursive Partial Depth Limit

**File**: `src/core/template-engine.ts`

- [ ] Track include depth in context
- [ ] Set maximum depth (default: 10)
- [ ] Throw error when depth exceeded
- [ ] Add depth to include options

### 14. Fix YAML Template Support

**File**: `src/services/template.service.ts`

- [ ] Parse YAML frontmatter correctly
- [ ] Extract metadata fields
- [ ] Pass parsed content to template engine
- [ ] Return rendered result with metadata

---

## 🔒 Security & Integration Features

### 15. Version Management Implementation

**File**: `src/marketplace/core/version.manager.ts`
**Tests**: `tests/e2e/marketplace.test.ts`

- [ ] Implement `parse(version: string)`
  - [ ] Split by dots and hyphens
  - [ ] Return version object

- [ ] Implement `compare(v1, v2)`
  - [ ] Compare major, minor, patch
  - [ ] Return -1, 0, or 1

- [ ] Implement `satisfies(version, range)`
  - [ ] Parse range syntax (^, ~, >=, etc)
  - [ ] Check if version matches

- [ ] Implement `getLatest(versions[])`
  - [ ] Sort versions
  - [ ] Return highest

- [ ] Implement `getLatestStable(versions[])`
  - [ ] Filter out pre-releases
  - [ ] Return highest stable

### 16. Cursor Integration Methods

**File**: `src/integrations/cursor/index.ts`
**Tests**: `tests/e2e/security-and-integration.test.ts`

- [ ] Add `isCursorProject()`
  - [ ] Check for `.cursor` directory
  - [ ] Return boolean

- [ ] Add `async optimizeForContext(template)`
  - [ ] Truncate if too large
  - [ ] Compress whitespace
  - [ ] Return optimized template

- [ ] Add `startWatching()`
  - [ ] Set up file watchers
  - [ ] Auto-sync on changes

- [ ] Add `stopWatching()`
  - [ ] Clear file watchers
  - [ ] Stop auto-sync

### 17. Rate Limiter Implementation

**File**: `src/middleware/rate-limiter.ts`
**Tests**: `tests/e2e/security-and-integration.test.ts`

- [ ] Fix constructor to accept `max` option
- [ ] Implement `checkLimit(clientId)`
  - [ ] Track requests per client
  - [ ] Check against limit
  - [ ] Return true/false
- [ ] Add time window reset logic

### 18. Cache Service Enhancements

**File**: `src/services/cache.service.ts`
**Tests**: `tests/e2e/security-and-integration.test.ts`

- [ ] Add `cacheDir` to CacheOptions interface
- [ ] Implement `async getSize()`
  - [ ] Calculate total cache size
  - [ ] Return bytes
- [ ] Update constructor to use cacheDir option

---

## 📊 Progress Tracking

### Completed: 0 / 18 major tasks

### Test Status: 30 passing / 53 total

## Priority Order

1. **Week 1**: Critical Fixes (Tasks 1-2)
2. **Week 2**: Plugin System (Tasks 3-4)
3. **Week 3**: Marketplace Core (Tasks 5-9)
4. **Week 4**: Template System (Tasks 10-14)
5. **Week 5**: Security & Integration (Tasks 15-18)

## Testing Strategy

After implementing each section:

1. Run specific test file: `npm test -- tests/e2e/<file>.test.ts`
2. Fix any remaining failures
3. Run all tests: `npm test -- tests/e2e/`
4. Update this document with completion status

## Notes

- Each task should include unit tests in addition to e2e tests
- Update documentation as features are implemented
- Consider backwards compatibility when changing APIs
- Add deprecation warnings for breaking changes

---

_Generated: 2025-08-26_
_Target Completion: All tests passing_
