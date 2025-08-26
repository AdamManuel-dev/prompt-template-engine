# Getting Started with Cursor Prompt Template Engine

**You'll build:** A working prompt template system for Cursor IDE
**Time:** 30 minutes
**You'll learn:** Template basics, variable substitution, and Cursor IDE integration through hands-on practice

## Before we begin

By the end of this tutorial, you'll have:
- Installed the Cursor Prompt Template Engine
- Created your first template
- Generated prompts with dynamic content
- Integrated with Cursor IDE

Let's see what we'll create:

```bash
# Final result - a generated prompt with your context
cursor-prompt generate bug-fix --variables '{"error": "undefined variable"}'
# Output: A complete, context-aware prompt ready for Cursor IDE
```

## Step 1: Installation

Open your terminal and run exactly this command:

```bash
npm install -g cursor-prompt
```

✓ **Check:** Verify the installation by running:
```bash
cursor-prompt --version
```

You should see:
```
cursor-prompt version 0.1.0
```

If you see an error, make sure Node.js 18+ is installed.

## Step 2: Initialize your project

Navigate to your project directory and initialize:

```bash
cd your-project
cursor-prompt init
```

✓ **Check:** You should see:
```
✓ Created .cursor-prompt directory
✓ Initialized default templates
✓ Created configuration file
Ready to use cursor-prompt!
```

**Notice:** The `.cursor-prompt` directory now contains your templates. This is where all your reusable prompts live.

## Step 3: Create your first template

Let's create a simple bug fix template. Type exactly:

```bash
cursor-prompt template:create my-bug-fix
```

When prompted, enter:
```
Name: My Bug Fix Template
Description: Template for fixing bugs
Content: Fix the {{error}} in {{file}}. The error occurs at line {{line}}.
```

✓ **Check:** List your templates:
```bash
cursor-prompt list
```

You should see your new template in the list.

## Step 4: Generate a prompt

Now let's use your template to generate a real prompt:

```bash
cursor-prompt generate my-bug-fix --variables '{
  "error": "TypeError: Cannot read property of undefined",
  "file": "src/auth.ts",
  "line": "45"
}'
```

✓ **Check:** You should see the generated prompt:
```
Fix the TypeError: Cannot read property of undefined in src/auth.ts. The error occurs at line 45.
```

**Notice:** The variables were substituted into your template. This is the power of templates - consistent structure with dynamic content.

## Step 5: Add context automatically

Templates can gather context automatically. Let's enhance our template:

```bash
cursor-prompt template:edit my-bug-fix
```

Update the content to:
```
Fix the {{error}} in {{file}} at line {{line}}.

Current git diff:
{{git_diff}}

File content:
{{file_content}}
```

Now generate with context:
```bash
cursor-prompt generate my-bug-fix --variables '{
  "error": "TypeError",
  "file": "src/auth.ts",
  "line": "45"
}' --context git,file
```

✓ **Check:** The output now includes actual git changes and file content automatically!

## Step 6: Connect to Cursor IDE

Now the exciting part - direct integration with Cursor:

```bash
cursor-prompt cursor:sync
```

✓ **Check:** You should see:
```
✓ Connected to Cursor IDE
✓ Templates synchronized
✓ Ready for injection
```

## Step 7: Inject directly into Cursor

With Cursor IDE open, inject a template:

```bash
cursor-prompt cursor:inject my-bug-fix --variables '{
  "error": "undefined variable",
  "file": "main.ts",
  "line": "12"
}'
```

✓ **Check:** Switch to Cursor IDE - your prompt appears in the active editor, ready to use with Claude!

## Step 8: Use a built-in template

The engine comes with powerful built-in templates:

```bash
cursor-prompt generate feature --variables '{
  "name": "user authentication",
  "description": "Add login and registration"
}'
```

✓ **Check:** You get a comprehensive feature prompt with:
- Requirements analysis
- Implementation steps
- Test considerations
- Documentation needs

## What you've accomplished

✅ Installed and configured Cursor Prompt Template Engine
✅ Created a custom template with variables
✅ Generated prompts with automatic context
✅ Connected to Cursor IDE for seamless workflow
✅ Learned to use built-in templates

## Next steps

**Ready to do more?** Here's where to go next:

1. **Learn advanced templates:** [Building Custom Templates](building-custom-templates.md)
2. **Start working:** [Common Tasks](../how-to/common-tasks.md)
3. **Explore templates:** [Template Marketplace](../how-to/marketplace.md)

## Quick reference card

Keep these commands handy:

```bash
cursor-prompt init                    # Initialize project
cursor-prompt list                    # List templates
cursor-prompt generate <template>     # Generate prompt
cursor-prompt cursor:sync             # Connect to Cursor
cursor-prompt cursor:inject <template> # Inject into Cursor
```

---

Congratulations! You're now ready to accelerate your Cursor IDE workflow with templates. 🚀