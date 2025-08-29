# Building Custom Templates

**You'll build:** A custom template for API endpoint generation with validation and tests
**Time:** 45 minutes
**You'll learn:** Template structure, advanced helpers, conditionals, and includes through practical examples

## Before we begin

By the end of this tutorial, you'll have:
- Created a custom template from scratch
- Used advanced template features (conditionals, loops, includes)
- Implemented template validation
- Built reusable template components

Let's see what we'll create:

```bash
# Final result - a custom template for API endpoints
cursor-prompt generate api-endpoint --variables '{
  "name": "UserProfile",
  "methods": ["GET", "POST", "PUT"],
  "auth": true,
  "validation": "zod"
}'
# Output: Complete API endpoint with routes, validation, tests, and documentation
```

## Step 1: Template Structure

Create a new template directory:

```bash
mkdir templates/api-endpoint
cd templates/api-endpoint
```

Create the main template file `template.yaml`:

```yaml
name: api-endpoint
description: Generate REST API endpoint with validation and tests
version: 1.0.0

variables:
  - name: name
    description: API endpoint name (e.g., UserProfile)
    type: string
    required: true
    validation: "^[A-Z][a-zA-Z0-9]*$"
  
  - name: methods
    description: HTTP methods to support
    type: array
    default: ["GET", "POST"]
    options: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  
  - name: auth
    description: Require authentication
    type: boolean
    default: true
  
  - name: validation
    description: Validation library
    type: string
    default: "zod"
    options: ["zod", "joi", "yup", "none"]

includes:
  - partials/routes.hbs
  - partials/validation.hbs
  - partials/tests.hbs

tags:
  - api
  - backend
  - rest

prompt: |
  # API Endpoint: {{name}}
  
  ## Context
  {{>context}}
  
  ## Requirements
  Create a complete REST API endpoint for {{name}} with the following specifications:
  
  ### HTTP Methods
  {{#each methods}}
  - {{uppercase this}}: {{>method-description method=this name=../name}}
  {{/each}}
  
  ### Authentication
  {{#if auth}}
  ✅ Authentication required using JWT tokens
  - Implement auth middleware
  - Add user context to requests
  - Handle unauthorized access (401)
  {{else}}
  ❌ No authentication required (public endpoint)
  {{/if}}
  
  ### Validation
  {{>validation-schema}}
  
  ### Implementation Requirements
  1. **Route Handler**: Express.js route with proper error handling
  2. **Request Validation**: {{#if_eq validation "none"}}No validation{{else}}{{titlecase validation}} schema validation{{/if_eq}}
  3. **Response Format**: Consistent JSON response structure
  4. **Error Handling**: Proper HTTP status codes and error messages
  5. **Documentation**: OpenAPI/Swagger documentation
  6. **Testing**: Unit and integration tests
  
  ### File Structure
  ```
  src/
  ├── routes/{{kebabCase name}}.ts       # Main route handler
  ├── middleware/auth.ts                 # Authentication middleware
  ├── validators/{{kebabCase name}}.ts   # Request validation schemas
  ├── types/{{kebabCase name}}.ts        # TypeScript interfaces
  └── tests/{{kebabCase name}}.test.ts   # Test cases
  ```
  
  ### Database Integration
  {{>database-operations}}
  
  ### Tests to Include
  {{>test-cases}}
  
  ## Implementation Notes
  - Follow RESTful conventions
  - Use TypeScript for type safety
  - Implement proper logging
  - Add rate limiting if needed
  - Consider caching for GET requests
  
  Please generate the complete implementation with all files.
```

## Step 2: Creating Partials

Templates become powerful when you break them into reusable components. Create the `partials` directory:

```bash
mkdir partials
```

### Route Description Partial

Create `partials/routes.hbs`:

```handlebars
{{!-- Method-specific descriptions --}}
{{#if_eq method "GET"}}
Retrieve {{name}} data with filtering and pagination support
{{/if_eq}}
{{#if_eq method "POST"}}
Create a new {{name}} with validation and conflict checking
{{/if_eq}}
{{#if_eq method "PUT"}}
Update existing {{name}} with full replacement
{{/if_eq}}
{{#if_eq method "DELETE"}}
Delete {{name}} with proper cascade handling
{{/if_eq}}
{{#if_eq method "PATCH"}}
Partially update {{name}} fields
{{/if_eq}}
```

### Validation Schema Partial

Create `partials/validation.hbs`:

```handlebars
{{#if_eq validation "zod"}}
```typescript
import { z } from 'zod';

const {{camelCase name}}Schema = z.object({
  // Define your schema fields here
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type {{pascalCase name}} = z.infer<typeof {{camelCase name}}Schema>;
```
{{/if_eq}}

{{#if_eq validation "joi"}}
```typescript
import Joi from 'joi';

const {{camelCase name}}Schema = Joi.object({
  id: Joi.string().uuid().optional(),
  name: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
});
```
{{/if_eq}}

{{#if_eq validation "yup"}}
```typescript
import * as yup from 'yup';

const {{camelCase name}}Schema = yup.object({
  id: yup.string().uuid().optional(),
  name: yup.string().min(1).max(100).required(),
  email: yup.string().email().optional(),
  createdAt: yup.date().optional(),
  updatedAt: yup.date().optional(),
});
```
{{/if_eq}}

{{#if_eq validation "none"}}
// No validation schema - manual validation in route handlers
{{/if_eq}}
```

### Test Cases Partial

Create `partials/tests.hbs`:

```handlebars
### Test Coverage Required

{{#each methods}}
#### {{uppercase this}} Tests
{{#if_eq this "GET"}}
- ✅ Should return 200 with valid data
- ✅ Should handle pagination (limit, offset)
- ✅ Should filter by query parameters  
- ✅ Should return 404 for non-existent resource
{{/if_eq}}
{{#if_eq this "POST"}}
- ✅ Should create resource and return 201
- ✅ Should validate required fields (400)
- ✅ Should handle duplicate creation (409)
- ✅ Should sanitize input data
{{/if_eq}}
{{#if_eq this "PUT"}}
- ✅ Should update resource and return 200
- ✅ Should return 404 for non-existent resource
- ✅ Should validate all required fields (400)
{{/if_eq}}
{{#if_eq this "DELETE"}}
- ✅ Should delete resource and return 204
- ✅ Should return 404 for non-existent resource
- ✅ Should handle cascade deletions
{{/if_eq}}
{{/each}}

{{#if auth}}
#### Authentication Tests
- ✅ Should reject requests without token (401)
- ✅ Should reject invalid tokens (401)
- ✅ Should accept valid tokens
- ✅ Should handle expired tokens (401)
{{/if}}

#### Error Handling Tests
- ✅ Should handle malformed JSON (400)
- ✅ Should handle server errors gracefully (500)
- ✅ Should provide meaningful error messages
```

### Database Operations Partial  

Create `partials/database.hbs`:

```handlebars
{{#each methods}}
{{#if_eq this "GET"}}
```typescript
// GET operations
const find{{pascalCase ../name}} = async (id: string) => {
  return await db.{{camelCase ../name}}.findUnique({ where: { id } });
};

const findMany{{pascalCase ../name}} = async (filters: any, pagination: any) => {
  return await db.{{camelCase ../name}}.findMany({
    where: filters,
    skip: pagination.offset,
    take: pagination.limit,
    orderBy: { createdAt: 'desc' }
  });
};
```
{{/if_eq}}

{{#if_eq this "POST"}}
```typescript
// CREATE operations
const create{{pascalCase ../name}} = async (data: {{pascalCase ../name}}Input) => {
  return await db.{{camelCase ../name}}.create({
    data: {
      ...data,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });
};
```
{{/if_eq}}

{{#if_eq this "PUT"}}
```typescript
// UPDATE operations
const update{{pascalCase ../name}} = async (id: string, data: {{pascalCase ../name}}Input) => {
  return await db.{{camelCase ../name}}.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date()
    }
  });
};
```
{{/if_eq}}

{{#if_eq this "DELETE"}}
```typescript
// DELETE operations
const delete{{pascalCase ../name}} = async (id: string) => {
  return await db.{{camelCase ../name}}.delete({
    where: { id }
  });
};
```
{{/if_eq}}
{{/each}}
```

## Step 3: Testing Your Template

Create a test configuration file `test-variables.json`:

```json
{
  "name": "UserProfile",
  "methods": ["GET", "POST", "PUT"],
  "auth": true,
  "validation": "zod"
}
```

Test your template:

```bash
cursor-prompt generate api-endpoint --variables test-variables.json --preview
```

## Step 4: Advanced Features

### Conditional Logic

Add advanced conditionals to your main template:

```handlebars
{{#if (and auth (includes methods "POST"))}}
// Authentication required for creating resources
{{/if}}

{{#unless (eq validation "none")}}
// Validation is enabled
{{/unless}}

{{#each methods}}
{{#if (eq this "GET")}}
// Special handling for GET requests
{{/if}}
{{/each}}
```

### Custom Helpers

Register custom helpers for complex logic:

```yaml
# In template.yaml, add helpers section
helpers:
  - name: requiresAuth
    description: Check if method requires authentication
    type: function
    
  - name: isPublicEndpoint  
    description: Check if endpoint is public
    type: boolean
```

### Template Inheritance

Create a base template for all API endpoints:

```yaml
extends: base-api-template
```

## Step 5: Validation and Testing

Add comprehensive validation to your template:

```yaml
validation:
  strict: true
  required: ["name"]
  dependencies:
    - when: "auth == true"
      require: ["jwt"]
    - when: "methods includes 'POST'"
      require: ["validation != 'none'"]
```

Test with invalid input:

```bash
# This should fail validation
cursor-prompt generate api-endpoint --variables '{"methods": ["INVALID"]}'
```

## Step 6: Documentation

Add comprehensive documentation to your template:

```yaml
examples:
  - name: Basic API
    description: Simple CRUD API with authentication
    variables:
      name: "User"
      methods: ["GET", "POST", "PUT", "DELETE"]
      auth: true
      validation: "zod"
      
  - name: Public Read-only API
    description: Public API for retrieving data
    variables:
      name: "Article"  
      methods: ["GET"]
      auth: false
      validation: "none"

troubleshooting:
  - problem: "Template fails to generate"
    solution: "Check that all required variables are provided"
  - problem: "Invalid method error"
    solution: "Use only supported HTTP methods: GET, POST, PUT, DELETE, PATCH"
```

## What you've accomplished

✅ **Template Structure**: Built a complete template with YAML configuration  
✅ **Partials**: Created reusable components for complex logic  
✅ **Conditionals**: Used advanced template logic for dynamic content  
✅ **Validation**: Added input validation and error handling  
✅ **Testing**: Created comprehensive test coverage  
✅ **Documentation**: Added examples and troubleshooting  

## Next steps

1. **Extend your template**: Add database migrations, Docker configuration
2. **Create variations**: Build templates for GraphQL, gRPC endpoints
3. **Share your template**: Publish to the template marketplace
4. **Advanced features**: Add webhook integration, monitoring

## Need help?

- 📖 [Template Syntax Reference](../reference/template-syntax.md)
- 🔧 [Advanced Template Features](../how-to/template-management.md)  
- 💬 [Community Examples](https://github.com/AdamManuel-dev/cursor-prompt-template-engine/discussions)

**You're now ready to build sophisticated templates that generate complete, production-ready code!**