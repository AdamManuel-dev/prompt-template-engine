# API Reference

Complete API documentation for the Cursor Prompt Template Engine.

## Table of Contents

- [CLI Commands](#cli-commands)
- [Core Classes](#core-classes)
- [Services](#services)
- [Security API](#security-api)
- [Interfaces](#interfaces)
- [Configuration](#configuration)
- [Error Handling](#error-handling)

## CLI Commands

### cursor-prompt init

Initialize a new project configuration.

```bash
cursor-prompt init [options]
```

**Options:**
- `-d, --dir <path>` - Directory to initialize (default: current)
- `-t, --templates <path>` - Templates directory path
- `-f, --force` - Overwrite existing configuration
- `--no-git` - Skip git repository check

**Example:**
```bash
cursor-prompt init --dir ./my-project --templates ./templates
```

### cursor-prompt generate

Generate a prompt from a template.

```bash
cursor-prompt generate <template> [options]
```

**Arguments:**
- `template` - Template name or path

**Options:**
- `-v, --variables <json>` - Variables as JSON string
- `-o, --output <file>` - Output to file instead of clipboard
- `-c, --clipboard` - Copy to clipboard (default: true)
- `-p, --preview` - Preview output without copying
- `--context` - Include context gathering
- `--include-git` - Include git context
- `--include-files` - Include file context
- `--file-patterns <patterns>` - File patterns to include

**Example:**
```bash
cursor-prompt generate bug-fix \
  --variables '{"error":"undefined variable","location":"auth.ts:45"}' \
  --include-git
```

### cursor-prompt apply

Apply a template to files.

```bash
cursor-prompt apply <template> <files...> [options]
```

**Arguments:**
- `template` - Template to apply
- `files` - Files to process

**Options:**
- `-f, --force` - Overwrite without confirmation
- `-b, --backup` - Create backups before applying
- `-d, --dry-run` - Preview changes without applying

**Example:**
```bash
cursor-prompt apply header-template src/**/*.ts --backup
```

### cursor-prompt validate

Validate template syntax.

```bash
cursor-prompt validate <template> [options]
```

**Arguments:**
- `template` - Template to validate

**Options:**
- `-s, --strict` - Enable strict validation
- `--fix` - Attempt to fix issues
- `-f, --format <type>` - Output format (table|json|yaml)

**Example:**
```bash
cursor-prompt validate my-template --strict --format json
```

### cursor-prompt list

List available templates.

```bash
cursor-prompt list [options]
```

**Options:**
- `-d, --detailed` - Show detailed information
- `-c, --category <name>` - Filter by category
- `-f, --format <type>` - Output format (table|json|list)

**Example:**
```bash
cursor-prompt list --detailed --category debug
```

### cursor-prompt config

Manage configuration.

```bash
cursor-prompt config <action> [key] [value] [options]
```

**Actions:**
- `get <key>` - Get configuration value
- `set <key> <value>` - Set configuration value
- `list` - List all settings
- `reset` - Reset to defaults

**Example:**
```bash
cursor-prompt config set templatesDir ./my-templates
cursor-prompt config get outputPreferences.copyToClipboard
```

## Core Classes

### TemplateEngine

The main template processing engine.

```typescript
class TemplateEngine {
  constructor()
  
  async render(
    template: string, 
    context: TemplateContext
  ): Promise<string>
  
  async renderFile(
    filePath: string,
    context: TemplateContext
  ): Promise<string>
}
```

**Methods:**

#### render(template, context)
Renders a template string with the provided context.

**Parameters:**
- `template: string` - Template content
- `context: TemplateContext` - Variables and data

**Returns:** `Promise<string>` - Rendered output

**Example:**
```typescript
const engine = new TemplateEngine();
const result = await engine.render(
  'Hello {{name}}!',
  { name: 'World' }
);
// Result: "Hello World!"
```

### TemplateValidator

Validates template syntax and structure.

```typescript
class TemplateValidator {
  validate(template: string): ValidationResult
  
  validateFile(filePath: string): Promise<ValidationResult>
  
  canAutoFix(errors: ValidationError[]): boolean
  
  autoFix(template: string): string
}
```

**Methods:**

#### validate(template)
Validates template syntax.

**Parameters:**
- `template: string` - Template to validate

**Returns:** `ValidationResult` - Validation results

## Services

### ContextAggregator

Aggregates context from multiple sources.

```typescript
class ContextAggregator {
  async gatherContext(
    options?: ContextOptions
  ): Promise<AggregatedContext>
  
  formatContext(
    context: AggregatedContext,
    format?: string
  ): string
  
  getContextSummary(
    context: AggregatedContext
  ): ContextSummary
}
```

### GitService

Git repository operations.

```typescript
class GitService {
  async isGitRepo(): Promise<boolean>
  
  async getStatus(): Promise<GitStatus>
  
  async getBranch(): Promise<string>
  
  async getDiff(staged?: boolean): Promise<string>
  
  async getCommits(limit?: number): Promise<GitCommit[]>
  
  async getContext(): Promise<GitContext>
}
```

### FileContextService

File system context operations.

```typescript
class FileContextService {
  async getFileInfo(filePath: string): Promise<FileInfo>
  
  async getProjectStructure(
    maxDepth?: number
  ): Promise<ProjectStructure>
  
  async getFileContent(
    filePath: string,
    options?: FileReadOptions
  ): Promise<FileContent>
  
  async getFileContents(
    patterns: string[]
  ): Promise<FileContent[]>
}
```

### ConfigService

Configuration management.

```typescript
class ConfigService {
  get<T>(key: string, defaultValue?: T): T
  
  set(key: string, value: any): void
  
  reset(): void
  
  load(configPath?: string): void
  
  save(): void
}
```

### TemplateService

Template discovery and management.

```typescript
class TemplateService {
  async discoverTemplates(): Promise<Template[]>
  
  async loadTemplate(name: string): Promise<Template>
  
  async saveTemplate(
    name: string,
    content: string
  ): Promise<void>
  
  async deleteTemplate(name: string): Promise<void>
  
  getTemplateInfo(name: string): TemplateInfo
}
```

## Security API

The Cursor Prompt Template Engine includes a comprehensive enterprise-grade security system with authentication, authorization, encryption, and audit capabilities.

### JWTAuthService

JWT-based authentication with role claims and comprehensive security controls.

```typescript
class JWTAuthService {
  constructor(config?: Partial<JWTAuthConfig>)
  
  async generateToken(user: UserInfo, deviceInfo?: DeviceInfo): Promise<TokenPair>
  
  async verifyToken(token: string): Promise<JWTPayload>
  
  async refreshToken(refreshToken: string, deviceInfo?: DeviceInfo): Promise<TokenPair>
  
  async revokeToken(token: string, reason?: string): Promise<void>
  
  async revokeAllUserTokens(userId: string): Promise<void>
  
  validateTokenStructure(token: string): TokenValidation
}
```

**Example:**
```typescript
const authService = new JWTAuthService({
  jwtSecret: process.env.JWT_SECRET,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d'
});

// Generate tokens for user
const tokens = await authService.generateToken({
  userId: '12345',
  username: 'john_doe',
  email: 'john@example.com',
  roles: ['user', 'admin'],
  permissions: ['read:templates', 'write:templates']
});

// Verify token
const payload = await authService.verifyToken(tokens.accessToken);
```

### RBACManagerService

Role-Based Access Control with hierarchical permissions and dynamic policies.

```typescript
class RBACManagerService {
  async createRole(role: RoleDefinition): Promise<void>
  
  async assignRole(userId: string, roleId: string, conditions?: RoleCondition[]): Promise<void>
  
  async checkPermission(userId: string, resource: string, action: string, context?: unknown): Promise<boolean>
  
  async getUserPermissions(userId: string): Promise<string[]>
  
  async getRoleHierarchy(roleId: string): Promise<Role[]>
}
```

**Example:**
```typescript
const rbac = new RBACManagerService();

// Create role with permissions
await rbac.createRole({
  id: 'template-admin',
  name: 'Template Administrator',
  permissions: ['templates:create', 'templates:edit', 'templates:delete'],
  inherits: ['template-user']
});

// Check user permissions
const canEdit = await rbac.checkPermission('user123', 'templates', 'edit');
```

### CryptographicService

FIPS 140-2 compliant encryption service for data protection.

```typescript
class CryptographicService {
  async encrypt(data: string, algorithm?: string): Promise<EncryptionResult>
  
  async decrypt(encryptedData: EncryptionResult): Promise<string>
  
  async generateKeyPair(): Promise<KeyPair>
  
  async sign(data: string, privateKey: string): Promise<string>
  
  async verify(data: string, signature: string, publicKey: string): Promise<boolean>
  
  generateSecureRandom(length: number): string
}
```

**Example:**
```typescript
const crypto = new CryptographicService();

// Encrypt sensitive data
const encrypted = await crypto.encrypt(sensitiveData, 'AES-256-GCM');

// Generate digital signature
const keyPair = await crypto.generateKeyPair();
const signature = await crypto.sign(document, keyPair.privateKey);
```

### SecretVaultService

Enterprise secrets management with encryption and rotation.

```typescript
class SecretVaultService {
  async storeSecret(key: string, value: string, metadata?: SecretMetadata): Promise<void>
  
  async getSecret(key: string): Promise<string | null>
  
  async rotateSecret(key: string): Promise<string>
  
  async listSecrets(pattern?: string): Promise<SecretInfo[]>
  
  async deleteSecret(key: string): Promise<void>
}
```

### AuditLoggerService

Comprehensive audit logging for compliance and security monitoring.

```typescript
class AuditLoggerService {
  async logSecurityEvent(event: SecurityEvent): Promise<void>
  
  async logAccessAttempt(userId: string, resource: string, action: string, result: 'granted' | 'denied'): Promise<void>
  
  async queryAuditLogs(criteria: AuditQueryCriteria): Promise<AuditLog[]>
  
  async generateComplianceReport(startDate: Date, endDate: Date, format?: 'json' | 'csv' | 'xml'): Promise<string>
}
```

### Authorization Middleware

Express.js middleware for request authorization.

```typescript
// Protect routes with permissions
app.use('/api/templates', 
  authMiddleware(),
  requirePermission('templates', 'read')
);

// Protect with role requirements
app.use('/api/admin/*',
  authMiddleware(),
  requireRole('admin')
);

// Custom authorization logic
app.use('/api/user/:userId/*',
  authMiddleware(),
  requireOwnership('userId')
);
```

### Security Configuration

```typescript
interface SecurityConfig {
  jwt: {
    secret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    algorithm: 'HS256' | 'RS256';
  };
  
  encryption: {
    algorithm: 'AES-256-GCM';
    keyDerivation: 'PBKDF2';
    iterations: number;
  };
  
  rbac: {
    enableHierarchy: boolean;
    cachePermissions: boolean;
    strictMode: boolean;
  };
  
  audit: {
    logLevel: 'minimal' | 'standard' | 'comprehensive';
    retentionDays: number;
    enableCompliance: boolean;
  };
}
```

## Interfaces

### TemplateContext

Variables and data for template rendering.

```typescript
interface TemplateContext {
  [key: string]: unknown;
}
```

### AggregatedContext

Combined context from all sources.

```typescript
interface AggregatedContext {
  system: SystemContext;
  git?: GitContext;
  project?: ProjectStructure;
  files?: Map<string, FileContent>;
  terminal?: TerminalContext;
  custom?: Record<string, unknown>;
}
```

### GitStatus

Git repository status information.

```typescript
interface GitStatus {
  branch: string;
  isClean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
  ahead: number;
  behind: number;
}
```

### FileContent

File content with metadata.

```typescript
interface FileContent {
  path: string;
  content: string;
  size: number;
  encoding: string;
  truncated: boolean;
  lines: number;
}
```

### Template

Template definition.

```typescript
interface Template {
  name: string;
  path: string;
  description?: string;
  category?: string;
  variables?: VariableConfig[];
  metadata?: TemplateMetadata;
  content?: string;
  commands?: TemplateCommand[];
}
```

### ValidationResult

Template validation results.

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  info: ValidationInfo[];
}
```

## Configuration

### Configuration Schema

```typescript
interface Config {
  templatesDir: string;
  defaultTemplate: string;
  autoContext: {
    includeGit: boolean;
    includeFiles: boolean;
    includeTerminal: boolean;
    terminalLines: number;
    filePatterns: string[];
  };
  outputPreferences: {
    copyToClipboard: boolean;
    showPreview: boolean;
    colorOutput: boolean;
    format: 'markdown' | 'plain' | 'json';
  };
  validation: {
    strict: boolean;
    autoFix: boolean;
    warnOnMissingVars: boolean;
  };
  performance: {
    maxFileSize: number;
    maxTotalSize: number;
    cacheTemplates: boolean;
    parallel: boolean;
  };
  gitIntegration: {
    enabled: boolean;
    includeStatus: boolean;
    includeDiff: boolean;
    includeCommits: boolean;
    commitLimit: number;
  };
}
```

### Environment Variables

- `CURSOR_PROMPT_TEMPLATES` - Override templates directory
- `CURSOR_PROMPT_CONFIG` - Custom config file path
- `CURSOR_PROMPT_NO_COLOR` - Disable colored output
- `CURSOR_PROMPT_DEBUG` - Enable debug logging
- `CURSOR_PROMPT_CACHE_DIR` - Cache directory location

## Error Handling

### Error Classes

```typescript
class TemplateError extends Error {
  code: string;
  details?: any;
}

class ValidationError extends TemplateError {
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
}

class ConfigError extends TemplateError {
  key?: string;
}

class FileError extends TemplateError {
  path?: string;
  operation?: string;
}
```

### Error Codes

- `TEMPLATE_NOT_FOUND` - Template does not exist
- `INVALID_SYNTAX` - Template syntax error
- `MISSING_VARIABLE` - Required variable not provided
- `CIRCULAR_INCLUDE` - Circular include detected
- `FILE_ACCESS_ERROR` - Cannot access file
- `CONFIG_INVALID` - Invalid configuration
- `GIT_NOT_REPO` - Not a git repository

## Template Syntax

See [Template Syntax Guide](./api/TEMPLATE_SYNTAX.md) for detailed template language documentation.

## Examples

### Basic Usage

```typescript
import { TemplateEngine, ContextAggregator } from 'cursor-prompt';

const engine = new TemplateEngine();
const aggregator = new ContextAggregator();

// Gather context
const context = await aggregator.gatherContext({
  includeGit: true,
  includeFiles: true,
  filePatterns: ['src/**/*.ts']
});

// Render template
const template = `
# Bug Fix Request

{{#if git.branch}}
Branch: {{git.branch}}
{{/if}}

{{#each files}}
## {{this.path}}
\`\`\`
{{this.content}}
\`\`\`
{{/each}}

Please fix the bug in the above code.
`;

const result = await engine.render(template, context);
console.log(result);
```

### Custom Service Integration

```typescript
import { TemplateService, ConfigService } from 'cursor-prompt';

const templateService = new TemplateService();
const configService = new ConfigService();

// Load configuration
configService.load('./my-config.json');

// Discover templates
const templates = await templateService.discoverTemplates();

// Load and render specific template
const template = await templateService.loadTemplate('bug-fix');
const rendered = await engine.render(template.content, {
  error: 'undefined variable',
  location: 'auth.ts:45'
});
```

## Error Handling

The Cursor Prompt Template Engine provides comprehensive error handling with specific error types for different failure scenarios.

### Error Types

#### TemplateProcessingError
Thrown when template processing fails due to syntax errors or rendering issues.

```typescript
class TemplateProcessingError extends Error {
  constructor(message: string, templatePath?: string, line?: number)
}

// Example
try {
  const result = await service.renderTemplate(template, variables);
} catch (error) {
  if (error instanceof TemplateProcessingError) {
    console.error('Template processing failed:', error.message);
    console.error('Template path:', error.templatePath);
  }
}
```

#### ValidationError
Thrown when input validation fails or template validation errors occur.

```typescript
class ValidationError extends Error {
  constructor(message: string, field?: string, value?: unknown)
}

// Example
try {
  await service.validateTemplate(template);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.message);
  }
}
```

#### FileNotFoundError
Thrown when template files or resources cannot be found.

```typescript
class FileNotFoundError extends Error {
  constructor(path: string)
}
```

#### AuthenticationError
Thrown when authentication fails or tokens are invalid.

```typescript
class AuthenticationError extends Error {
  constructor(message: string, code?: string)
}
```

#### AuthorizationError  
Thrown when user lacks required permissions for an action.

```typescript
class AuthorizationError extends Error {
  constructor(message: string, resource?: string, action?: string)
}
```

### Error Handling Best Practices

1. **Always use try-catch blocks** when calling async methods
2. **Check error types** using `instanceof` for specific handling
3. **Log errors appropriately** with context information
4. **Provide user-friendly error messages** in CLI commands
5. **Use error codes** for programmatic error handling

**Example:**
```typescript
try {
  const template = await service.loadTemplate(templatePath);
  const result = await service.renderTemplate(template, variables);
  console.log(result);
} catch (error) {
  if (error instanceof FileNotFoundError) {
    console.error(`Template not found: ${templatePath}`);
  } else if (error instanceof ValidationError) {
    console.error(`Invalid template variables: ${error.message}`);
  } else if (error instanceof TemplateProcessingError) {
    console.error(`Template processing failed: ${error.message}`);
  } else {
    console.error(`Unexpected error: ${error.message}`);
  }
}
```

---

*API Version: 1.0.0 | Last Updated: 2025-08-27*