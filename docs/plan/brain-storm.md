Problem Statement

  The user wants to create consistent, optimized prompts for Cursor + Claude interactions, believing that structured prompts with
  proper context will yield better results. However, the actual problem may be simpler: lack of reusable templates and manual
  context gathering, not the need for complex optimization logic.

  Recommended Solution

  Simple TypeScript Template Engine with Context Helpers

  A lightweight TypeScript CLI tool that:
  - Loads markdown prompt templates with variable placeholders
  - Provides simple commands to gather common context (open files, git status)
  - Outputs formatted prompts ready for Cursor
  - Skips complex "optimization" in favor of good templates

  Why This Approach

  - Solves the actual problem (repetitive prompt writing) without over-engineering
  - TypeScript provides type safety for template variables
  - Minimal maintenance burden for solo developer
  - Leverages Cursor's existing context features
  - 90% of benefit with 10% of proposed complexity

  Success Criteria

  - Reduce prompt writing time by 50%
  - Consistent prompt structure across different task types
  - Easy to modify templates without code changes
  - Works within existing Cursor workflow
  - No complex dependencies or integrations

  Constraints & Assumptions

  - Assumes current prompts lack consistency, not quality
  - Assumes Cursor's built-in context is sufficient
  - Limited to markdown templates with variable substitution
  - No VS Code extension needed (just CLI)
  - Templates stored as simple markdown files

  Complexity Assessment

  Overall Complexity: Simple

  Factors considered:
  - Basic file I/O and string templating
  - No complex parsing or AST manipulation
  - No IDE integration required
  - Standard CLI interface
  - Reuses existing Cursor features

  Human Review Required

  - Assumption: Current prompts are inconsistent rather than ineffective
  - Derived requirement: Templates with variables solve 80% of the need
  - Success criteria: 50% time reduction is meaningful and measurable

  Technical Implementation Note

  This brainstorming session focused on requirements only. The shift from Python to TypeScript is noted, but implementation
  details (specific libraries, file structures, etc.) will be addressed in the implementation phase.
