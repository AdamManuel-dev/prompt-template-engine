# Automated Prompt Optimization System for Cursor + Claude

## 1. Setting Up the Prompt Optimization Pipeline

### Create a Prompt Templates Directory
```bash
# Project structure
project/
├── .cursor/
│   ├── prompt_templates/
│   │   ├── bug_fix.md
│   │   ├── feature.md
│   │   ├── refactor.md
│   │   ├── review.md
│   │   └── optimize.md
│   ├── prompt_optimizer.py
│   └── settings.json
├── .cursorrules
└── src/
```

### The Master Prompt Optimizer Template
```markdown
# .cursor/prompt_templates/optimize.md

@.cursor/prompt_templates/ @.cursorrules

<optimization_request>
I need to create an optimized prompt for the following task:
{USER_TASK}
</optimization_request>

<context_analysis>
Current files in context: {CURRENT_CONTEXT}
Terminal output: {TERMINAL_STATE}
Recent errors: {ERROR_CONTEXT}
</context_analysis>

<thinking>
Let me analyze the best prompt structure for this task:
1. What type of task is this? (bug fix, feature, refactor, etc.)
2. What context does Claude need?
3. What XML tags would be most effective?
4. What constraints should be specified?
5. What output format would be optimal?
</thinking>

<optimization_rules>
- Include relevant @-mentions for necessary files
- Use appropriate XML tags from the reference guide
- Structure with clear sections
- Add thinking tags for complex logic
- Specify clear success criteria
- Include examples if pattern matching needed
- Add constraints to prevent common issues
</optimization_rules>

Generate an optimized prompt that follows Cursor + Claude best practices.
```

## 2. Automated Prompt Builder Script

### Create the Prompt Optimizer
```python
# .cursor/prompt_optimizer.py

import os
import re
from typing import Dict, List, Optional
from pathlib import Path

class CursorPromptOptimizer:
    """
    Automatically generates optimized prompts for Cursor + Claude
    """
    
    def __init__(self):
        self.templates_dir = Path(".cursor/prompt_templates")
        self.context_patterns = {
            'bug_fix': ['error', 'bug', 'fix', 'broken', 'issue'],
            'feature': ['add', 'implement', 'create', 'new feature'],
            'refactor': ['refactor', 'improve', 'optimize', 'clean'],
            'review': ['review', 'check', 'analyze', 'audit'],
            'test': ['test', 'testing', 'unit test', 'coverage']
        }
    
    def detect_task_type(self, user_input: str) -> str:
        """Detect the type of task from user input"""
        user_input_lower = user_input.lower()
        
        for task_type, patterns in self.context_patterns.items():
            if any(pattern in user_input_lower for pattern in patterns):
                return task_type
        
        return 'general'
    
    def gather_context(self) -> Dict[str, any]:
        """Gather current context from Cursor environment"""
        context = {
            'open_files': self.get_open_files(),
            'recent_changes': self.get_git_changes(),
            'terminal_output': self.get_terminal_output(),
            'current_selection': self.get_selection(),
            'project_type': self.detect_project_type()
        }
        return context
    
    def get_open_files(self) -> List[str]:
        """Get currently open files in Cursor"""
        # This would integrate with Cursor's API
        # Placeholder implementation
        return ["@current_file.py", "@test_file.py"]
    
    def get_git_changes(self) -> str:
        """Get recent git changes"""
        # Run git diff or git status
        return "@git:changes"
    
    def get_terminal_output(self) -> str:
        """Get recent terminal output if relevant"""
        return "@terminal" if self.has_recent_errors() else ""
    
    def get_selection(self) -> str:
        """Get current code selection"""
        return "@selection" if self.has_selection() else ""
    
    def build_optimized_prompt(
        self, 
        user_task: str, 
        task_type: Optional[str] = None
    ) -> str:
        """
        Build an optimized prompt based on task and context
        """
        if not task_type:
            task_type = self.detect_task_type(user_task)
        
        context = self.gather_context()
        
        # Select appropriate template
        template = self.load_template(task_type)
        
        # Build the optimized prompt
        optimized_prompt = self.construct_prompt(
            template, 
            user_task, 
            context, 
            task_type
        )
        
        return optimized_prompt
    
    def load_template(self, task_type: str) -> str:
        """Load the appropriate template"""
        template_path = self.templates_dir / f"{task_type}.md"
        
        if template_path.exists():
            return template_path.read_text()
        else:
            return self.get_default_template()
    
    def construct_prompt(
        self, 
        template: str, 
        user_task: str, 
        context: Dict, 
        task_type: str
    ) -> str:
        """
        Construct the final optimized prompt
        """
        # Build context mentions
        mentions = self.build_mentions(context, task_type)
        
        # Select appropriate XML tags
        xml_structure = self.select_xml_tags(task_type)
        
        # Build the prompt
        prompt = f"""
{mentions}

{xml_structure['opening']}

<task>
{user_task}
</task>

<context>
Project type: {context['project_type']}
Working on: {task_type}
</context>

{self.add_thinking_section(task_type)}

{self.add_requirements_section(task_type, user_task)}

{self.add_approach_section(task_type)}

{xml_structure['closing']}

Please proceed with the {task_type} following best practices.
"""
        return prompt.strip()
    
    def build_mentions(self, context: Dict, task_type: str) -> str:
        """Build appropriate @-mentions"""
        mentions = []
        
        # Always include current context
        mentions.extend(context['open_files'])
        
        # Add based on task type
        if task_type == 'bug_fix':
            mentions.append('@terminal')
            mentions.append('@problems')
        elif task_type == 'refactor':
            mentions.append('@codebase')
        elif task_type == 'test':
            mentions.append('@tests/')
        
        # Add git changes if reviewing
        if task_type == 'review':
            mentions.append('@git:changes')
        
        return ' '.join(mentions)
    
    def select_xml_tags(self, task_type: str) -> Dict[str, str]:
        """Select appropriate XML tags for task type"""
        tag_structures = {
            'bug_fix': {
                'opening': '<debugging>',
                'closing': '</debugging>'
            },
            'feature': {
                'opening': '<implementation>',
                'closing': '</implementation>'
            },
            'refactor': {
                'opening': '<refactoring>',
                'closing': '</refactoring>'
            },
            'review': {
                'opening': '<code_review>',
                'closing': '</code_review>'
            }
        }
        
        return tag_structures.get(task_type, {
            'opening': '<task_execution>',
            'closing': '</task_execution>'
        })
    
    def add_thinking_section(self, task_type: str) -> str:
        """Add appropriate thinking section"""
        thinking_prompts = {
            'bug_fix': """
<thinking>
Let me analyze the error:
1. Understand the error message
2. Trace the execution path
3. Identify the root cause
4. Plan the fix
</thinking>""",
            'feature': """
<thinking>
Let me plan this feature:
1. Understand requirements
2. Design the implementation
3. Consider edge cases
4. Plan testing approach
</thinking>""",
            'refactor': """
<thinking>
Let me analyze the current code:
1. Identify improvement opportunities
2. Ensure backward compatibility
3. Plan incremental changes
4. Maintain test coverage
</thinking>"""
        }
        
        return thinking_prompts.get(task_type, """
<thinking>
Let me understand the task and plan the approach...
</thinking>""")
    
    def add_requirements_section(self, task_type: str, user_task: str) -> str:
        """Add requirements based on task analysis"""
        requirements = ["<requirements>"]
        
        # Add standard requirements
        if 'test' in user_task.lower():
            requirements.append("- Include unit tests")
        if 'api' in user_task.lower():
            requirements.append("- Add API documentation")
        if 'security' in user_task.lower():
            requirements.append("- Follow security best practices")
        
        # Add task-specific requirements
        if task_type == 'bug_fix':
            requirements.append("- Preserve existing functionality")
            requirements.append("- Add regression test")
        elif task_type == 'feature':
            requirements.append("- Follow existing patterns")
            requirements.append("- Include error handling")
        elif task_type == 'refactor':
            requirements.append("- Maintain backward compatibility")
            requirements.append("- Keep tests green")
        
        requirements.append("</requirements>")
        
        return '\n'.join(requirements) if len(requirements) > 2 else ""
    
    def add_approach_section(self, task_type: str) -> str:
        """Add structured approach for task"""
        approaches = {
            'bug_fix': """
<approach>
1. Reproduce the issue
2. Identify root cause
3. Implement fix
4. Verify fix works
5. Add test to prevent regression
</approach>""",
            'feature': """
<approach>
1. Design the interface
2. Implement core logic
3. Add error handling
4. Write tests
5. Update documentation
</approach>""",
            'refactor': """
<approach>
1. Identify refactoring targets
2. Write characterization tests
3. Refactor incrementally
4. Verify tests still pass
5. Optimize if needed
</approach>"""
        }
        
        return approaches.get(task_type, "")
```

## 3. Cursor Integration Workflow

### Step 1: Create a Cursor Command
```yaml
# .cursor/commands/optimize_prompt.yaml
name: optimize_prompt
description: "Optimize prompt before sending to Claude"
shortcut: "cmd+shift+o"
script: |
  python .cursor/prompt_optimizer.py --task "${input}"
```

### Step 2: Create the Integration Script
```python
# .cursor/cursor_integration.py

import subprocess
import pyperclip
from prompt_optimizer import CursorPromptOptimizer

def optimize_and_copy():
    """
    Optimize prompt and copy to clipboard for Cursor
    """
    # Get user input
    user_task = input("What do you want to accomplish? ")
    
    # Initialize optimizer
    optimizer = CursorPromptOptimizer()
    
    # Generate optimized prompt
    optimized_prompt = optimizer.build_optimized_prompt(user_task)
    
    # Show the optimized prompt
    print("\n" + "="*50)
    print("OPTIMIZED PROMPT:")
    print("="*50)
    print(optimized_prompt)
    print("="*50 + "\n")
    
    # Copy to clipboard
    pyperclip.copy(optimized_prompt)
    print("✅ Optimized prompt copied to clipboard!")
    print("📋 Press Cmd+L in Cursor and paste to use")
    
    # Optionally save for reuse
    save = input("\nSave this prompt as template? (y/n): ")
    if save.lower() == 'y':
        name = input("Template name: ")
        save_template(name, optimized_prompt)

def save_template(name: str, prompt: str):
    """Save successful prompts for reuse"""
    template_path = Path(f".cursor/saved_prompts/{name}.md")
    template_path.parent.mkdir(exist_ok=True)
    template_path.write_text(prompt)
    print(f"✅ Saved as {name}")

if __name__ == "__main__":
    optimize_and_copy()
```

## 4. Pre-Prompt Optimization Templates

### Bug Fix Optimization Template
```markdown
# .cursor/prompt_templates/bug_fix.md

@file_with_error.py @terminal @problems

<error_analysis>
Error Type: {ERROR_TYPE}
Location: {ERROR_LOCATION}
Stack Trace: {STACK_TRACE}
</error_analysis>

<thinking>
Analyzing the error:
1. Parse error message
2. Identify affected code
3. Trace execution path
4. Find root cause
5. Plan fix strategy
</thinking>

<debugging_approach>
<step n="1">Reproduce the error</step>
<step n="2">Isolate the problem</step>
<step n="3">Implement fix</step>
<step n="4">Verify solution</step>
<step n="5">Add regression test</step>
</debugging_approach>

<constraints>
- Maintain existing functionality
- Don't break other features
- Follow project coding standards
- Add appropriate error handling
</constraints>

Fix the bug and explain what caused it.
```

### Feature Implementation Template
```markdown
# .cursor/prompt_templates/feature.md

@relevant_files @tests/ @docs/

<feature_request>
{FEATURE_DESCRIPTION}
</feature_request>

<thinking>
Planning the implementation:
1. Understand requirements
2. Design architecture
3. Identify dependencies
4. Plan testing strategy
</thinking>

<implementation_plan>
<phase n="1">
Core functionality
- Main logic implementation
- Basic error handling
</phase>
<phase n="2">
Edge cases and validation
- Input validation
- Edge case handling
</phase>
<phase n="3">
Testing and documentation
- Unit tests
- Integration tests
- Documentation
</phase>
</implementation_plan>

<requirements>
- Follow existing patterns in the codebase
- Include comprehensive error handling
- Write tests with >80% coverage
- Add documentation
- Ensure backward compatibility
</requirements>

Implement this feature following TDD principles.
```

### Refactoring Template
```markdown
# .cursor/prompt_templates/refactor.md

@target_files @tests/

<refactoring_goal>
{REFACTORING_OBJECTIVE}
</refactoring_goal>

<current_state_analysis>
Files to refactor: {TARGET_FILES}
Current patterns: {CURRENT_PATTERNS}
Technical debt: {IDENTIFIED_ISSUES}
</current_state_analysis>

<thinking>
Refactoring strategy:
1. Identify code smells
2. Plan incremental changes
3. Ensure test coverage
4. Implement improvements
5. Verify functionality preserved
</thinking>

<refactoring_approach>
<preserve>
- All existing functionality
- Public API contracts
- Test coverage
</preserve>
<improve>
- Code readability
- Performance
- Maintainability
- Type safety
</improve>
</refactoring_approach>

<constraints>
- No breaking changes
- Maintain backward compatibility
- Keep all tests passing
- Follow SOLID principles
</constraints>

Refactor the code incrementally with explanation for each change.
```

## 5. Interactive Prompt Builder

### Create Interactive Builder Script
```python
# .cursor/interactive_prompt_builder.py

import inquirer
from pathlib import Path
from typing import List, Dict

class InteractivePromptBuilder:
    """
    Interactive CLI for building optimized prompts
    """
    
    def __init__(self):
        self.optimizer = CursorPromptOptimizer()
    
    def run(self):
        """Run interactive prompt builder"""
        print("🚀 Cursor Prompt Optimizer")
        print("="*40)
        
        # Step 1: Task type selection
        task_type = self.select_task_type()
        
        # Step 2: Gather task details
        task_details = self.gather_task_details(task_type)
        
        # Step 3: Select files
        files = self.select_files()
        
        # Step 4: Add constraints
        constraints = self.select_constraints()
        
        # Step 5: Choose thinking depth
        thinking_depth = self.select_thinking_depth()
        
        # Step 6: Build the prompt
        prompt = self.build_prompt(
            task_type,
            task_details,
            files,
            constraints,
            thinking_depth
        )
        
        # Step 7: Review and edit
        final_prompt = self.review_and_edit(prompt)
        
        # Step 8: Copy to clipboard
        self.finalize(final_prompt)
    
    def select_task_type(self) -> str:
        """Interactive task type selection"""
        questions = [
            inquirer.List(
                'task_type',
                message="What type of task?",
                choices=[
                    'Bug Fix',
                    'New Feature',
                    'Refactoring',
                    'Code Review',
                    'Testing',
                    'Documentation',
                    'Performance Optimization',
                    'Security Audit',
                    'Custom'
                ],
            ),
        ]
        answers = inquirer.prompt(questions)
        return answers['task_type'].lower().replace(' ', '_')
    
    def gather_task_details(self, task_type: str) -> Dict:
        """Gather specific details about the task"""
        questions = []
        
        if task_type == 'bug_fix':
            questions = [
                inquirer.Text('error_msg', message="Error message"),
                inquirer.Text('location', message="Where is the bug?"),
                inquirer.Confirm('has_stacktrace', message="Include stacktrace?")
            ]
        elif task_type == 'new_feature':
            questions = [
                inquirer.Text('description', message="Feature description"),
                inquirer.Checkbox(
                    'components',
                    message="What components are needed?",
                    choices=['API endpoint', 'Database model', 'UI component', 
                            'Tests', 'Documentation']
                )
            ]
        else:
            questions = [
                inquirer.Text('description', message="Describe the task")
            ]
        
        return inquirer.prompt(questions)
    
    def select_files(self) -> List[str]:
        """Select files to include in context"""
        # Get project files
        project_files = self.get_project_files()
        
        questions = [
            inquirer.Checkbox(
                'files',
                message="Select files to include",
                choices=project_files
            ),
            inquirer.Confirm(
                'include_tests',
                message="Include test files?",
                default=True
            ),
            inquirer.Confirm(
                'include_terminal',
                message="Include terminal output?",
                default=False
            )
        ]
        
        answers = inquirer.prompt(questions)
        
        files = [f"@{f}" for f in answers['files']]
        if answers['include_tests']:
            files.append('@tests/')
        if answers['include_terminal']:
            files.append('@terminal')
        
        return files
    
    def select_constraints(self) -> List[str]:
        """Select constraints for the task"""
        questions = [
            inquirer.Checkbox(
                'constraints',
                message="Select constraints",
                choices=[
                    'Maintain backward compatibility',
                    'Follow existing patterns',
                    'Include error handling',
                    'Write tests',
                    'Update documentation',
                    'Optimize for performance',
                    'Ensure type safety',
                    'Follow security best practices'
                ]
            )
        ]
        
        return inquirer.prompt(questions)['constraints']
    
    def select_thinking_depth(self) -> str:
        """Select thinking depth"""
        questions = [
            inquirer.List(
                'thinking',
                message="How much thinking/analysis?",
                choices=[
                    ('Quick (simple task)', 'think'),
                    ('Standard (moderate complexity)', 'think step by step'),
                    ('Deep (complex logic)', 'think hard'),
                    ('Maximum (critical task)', 'think very hard')
                ]
            )
        ]
        
        return inquirer.prompt(questions)['thinking']
    
    def build_prompt(
        self,
        task_type: str,
        details: Dict,
        files: List[str],
        constraints: List[str],
        thinking: str
    ) -> str:
        """Build the complete prompt"""
        
        prompt_parts = []
        
        # Add file mentions
        prompt_parts.append(' '.join(files))
        prompt_parts.append('')
        
        # Add task description
        prompt_parts.append('<task>')
        prompt_parts.append(details.get('description', ''))
        prompt_parts.append('</task>')
        prompt_parts.append('')
        
        # Add thinking section
        prompt_parts.append(f'<{thinking}>')
        prompt_parts.append(self.get_thinking_content(task_type))
        prompt_parts.append(f'</{thinking}>')
        prompt_parts.append('')
        
        # Add constraints
        if constraints:
            prompt_parts.append('<constraints>')
            for constraint in constraints:
                prompt_parts.append(f'- {constraint}')
            prompt_parts.append('</constraints>')
            prompt_parts.append('')
        
        # Add task-specific sections
        prompt_parts.extend(self.get_task_specific_sections(task_type, details))
        
        return '\n'.join(prompt_parts)
    
    def review_and_edit(self, prompt: str) -> str:
        """Allow user to review and edit the prompt"""
        print("\n" + "="*50)
        print("GENERATED PROMPT:")
        print("="*50)
        print(prompt)
        print("="*50 + "\n")
        
        questions = [
            inquirer.Confirm(
                'edit',
                message="Would you like to edit this prompt?",
                default=False
            )
        ]
        
        if inquirer.prompt(questions)['edit']:
            # Open in editor or allow inline editing
            edited = inquirer.prompt([
                inquirer.Editor('edited_prompt', message="Edit prompt", 
                              default=prompt)
            ])
            return edited['edited_prompt']
        
        return prompt
    
    def finalize(self, prompt: str):
        """Copy to clipboard and provide instructions"""
        import pyperclip
        pyperclip.copy(prompt)
        
        print("\n✅ Optimized prompt copied to clipboard!")
        print("\n📋 Next steps:")
        print("1. Press Cmd+L in Cursor to open chat")
        print("2. Paste the optimized prompt")
        print("3. Review Claude's response")
        print("\n💡 Tip: Save successful prompts with Cmd+S for reuse")

if __name__ == "__main__":
    builder = InteractivePromptBuilder()
    builder.run()
```

## 6. VS Code Extension for Cursor

### Create Extension for Automatic Optimization
```javascript
// .cursor/extensions/prompt-optimizer/extension.js

const vscode = require('vscode');
const { spawn } = require('child_process');

function activate(context) {
    let disposable = vscode.commands.registerCommand(
        'cursor.optimizePrompt',
        async function () {
            // Get current selection or prompt user
            const editor = vscode.window.activeTextEditor;
            let taskDescription = "";
            
            if (editor && editor.selection) {
                taskDescription = editor.document.getText(editor.selection);
            }
            
            if (!taskDescription) {
                taskDescription = await vscode.window.showInputBox({
                    prompt: "Describe your task",
                    placeHolder: "e.g., Fix the authentication bug"
                });
            }
            
            // Run optimizer
            const optimizedPrompt = await optimizePrompt(taskDescription);
            
            // Show result
            const doc = await vscode.workspace.openTextDocument({
                content: optimizedPrompt,
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(doc);
            
            // Copy to clipboard
            await vscode.env.clipboard.writeText(optimizedPrompt);
            
            vscode.window.showInformationMessage(
                'Prompt optimized and copied to clipboard!'
            );
        }
    );
    
    context.subscriptions.push(disposable);
}

async function optimizePrompt(taskDescription) {
    return new Promise((resolve, reject) => {
        const python = spawn('python', [
            '.cursor/prompt_optimizer.py',
            '--task',
            taskDescription,
            '--format',
            'json'
        ]);
        
        let result = '';
        
        python.stdout.on('data', (data) => {
            result += data.toString();
        });
        
        python.on('close', (code) => {
            if (code === 0) {
                const parsed = JSON.parse(result);
                resolve(parsed.optimized_prompt);
            } else {
                reject(new Error('Optimization failed'));
            }
        });
    });
}

module.exports = { activate };
```

## 7. Usage Workflow

### Complete Workflow Example

1. **Start with raw task**:
```
"I need to fix the login bug where users get logged out randomly"
```

2. **Run optimizer** (Cmd+Shift+O):
```bash
python .cursor/interactive_prompt_builder.py
```

3. **Optimizer generates**:
```markdown
@auth/login.py @auth/session.py @models/user.py @terminal @problems

<debugging>

<task>
Fix the login bug where users get logged out randomly
</task>

<error_analysis>
Symptom: Random user logouts
Potential causes: Session timeout, token expiration, cache issues
Affected components: Authentication, Session management
</error_analysis>

<thinking>
Let me analyze this authentication issue:
1. Check session management logic
2. Review token expiration settings
3. Examine cache invalidation
4. Look for race conditions
5. Check for memory leaks
</thinking>

<investigation_approach>
<step n="1">Review session configuration</step>
<step n="2">Check Redis/cache settings</step>
<step n="3">Analyze token refresh logic</step>
<step n="4">Look for concurrent session issues</step>
<step n="5">Review error logs for patterns</step>
</investigation_approach>

<constraints>
- Maintain existing user sessions
- Don't break current authentication flow
- Preserve security measures
- Add comprehensive logging
</constraints>

<requirements>
- Identify root cause
- Implement robust fix
- Add monitoring/logging
- Write regression tests
- Document the solution
</requirements>

</debugging>

Debug and fix the random logout issue, explaining the root cause and solution.
```

4. **Copy and use in Cursor** (automatically copied)
5. **Review and iterate** based on Claude's response

## 8. Best Practices

### DO's
- ✅ Always run optimizer for complex tasks
- ✅ Save successful optimized prompts
- ✅ Customize templates for your project
- ✅ Include relevant context files
- ✅ Use appropriate thinking depth
- ✅ Add clear constraints
- ✅ Specify expected output format

### DON'Ts
- ❌ Don't include entire codebase in context
- ❌ Don't skip the optimization step for complex tasks
- ❌ Don't use generic prompts for specific problems
- ❌ Don't forget to include test requirements
- ❌ Don't ignore terminal output for debugging

## Quick Start Guide

```bash
# 1. Install dependencies
pip install inquirer pyperclip pathlib

# 2. Copy optimizer scripts to .cursor/
cp prompt_optimizer.py .cursor/
cp interactive_prompt_builder.py .cursor/

# 3. Create templates directory
mkdir -p .cursor/prompt_templates

# 4. Add to .cursorrules
echo "Always optimize prompts before sending to Claude" >> .cursorrules

# 5. Create alias for quick access
alias optimize="python .cursor/interactive_prompt_builder.py"

# 6. Use it!
optimize
```