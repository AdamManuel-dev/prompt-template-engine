# Template Validator Module

## Purpose
The Template Validator module provides comprehensive validation for template syntax, structure, and best practices. It ensures templates are syntactically correct, semantically valid, and follow established conventions before they are processed by the template engine.

## Dependencies
- Internal: Template Engine, Error utilities
- External: None (pure TypeScript validation)

## Key Components

### TemplateValidator
Main validation class that orchestrates all validation operations.

#### Public API
- `validate(template: string): ValidationResult` - Validates template syntax
- `validateFile(filePath: string): Promise<ValidationResult>` - Validates a template file
- `canAutoFix(errors: ValidationError[]): boolean` - Checks if errors can be auto-fixed
- `autoFix(template: string): string` - Attempts to fix common issues

### SchemaValidator
Validates template metadata and configuration against predefined schemas.

#### Public API
- `validateSchema(data: unknown, schema: Schema): ValidationResult` - Validates against schema
- `validateTemplateConfig(config: TemplateConfig): ValidationResult` - Validates template configuration

### VariableValidator
Validates variable usage within templates.

#### Public API
- `validateVariables(template: string, context?: TemplateContext): ValidationResult` - Validates variable references
- `extractVariables(template: string): string[]` - Extracts all variables from template
- `checkUnusedVariables(template: string, context: TemplateContext): string[]` - Finds unused variables

## Usage Examples

### Basic Validation
```typescript
import { TemplateValidator } from './validators/template.validator';

const validator = new TemplateValidator();
const result = validator.validate('Hello {{name}}!');

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

### File Validation with Auto-fix
```typescript
const validator = new TemplateValidator();
const result = await validator.validateFile('./templates/my-template.md');

if (!result.valid && validator.canAutoFix(result.errors)) {
  const fixed = validator.autoFix(templateContent);
  await fs.writeFile('./templates/my-template.md', fixed);
}
```

### Variable Validation
```typescript
import { VariableValidator } from './validators/variable.validator';

const validator = new VariableValidator();
const variables = validator.extractVariables(template);
const unused = validator.checkUnusedVariables(template, context);

if (unused.length > 0) {
  console.warn('Unused variables:', unused);
}
```

## Configuration
The validator can be configured through the main configuration file:

```json
{
  "validation": {
    "strict": true,
    "autoFix": true,
    "warnOnMissingVars": true,
    "maxNestingDepth": 10,
    "allowedTags": ["if", "unless", "each", "include"]
  }
}
```

## Error Handling
The validator provides detailed error information:

```typescript
interface ValidationError {
  code: string;
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
  suggestion?: string;
}
```

Common error codes:
- `UNCLOSED_TAG` - Missing closing tag
- `INVALID_SYNTAX` - Syntax error in template
- `UNDEFINED_VARIABLE` - Variable not in context
- `CIRCULAR_INCLUDE` - Circular template inclusion
- `INVALID_EXPRESSION` - Invalid JavaScript expression

## Security Considerations
- Validates against script injection in templates
- Checks for excessive nesting to prevent DoS
- Validates file paths in include statements
- Sanitizes variable names to prevent code execution

## Performance Notes
- Template validation is cached for repeated validations
- Async file operations for non-blocking validation
- Optimized regex patterns for fast parsing
- Lazy evaluation of complex validations

## Related Documentation
- [Template Engine](./template-engine.md) - Core template processing
- [Template Service](./template-service.md) - Template management
- [Variable Processor](../api/TEMPLATE_SYNTAX.md#variables) - Variable syntax documentation