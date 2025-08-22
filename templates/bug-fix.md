# Bug Fix Template

---
category: bug-fix
description: Template for systematic bug fixing and root cause analysis
version: 1.0.0
variables:
  - problem_description: Description of the bug or issue
  - expected_behavior: What should happen normally
  - current_behavior: What is actually happening
  - steps_to_reproduce: How to reproduce the issue
  - root_cause: Identified cause of the bug
  - proposed_solution: How to fix the issue
  - files_to_modify: List of files that need changes
  - testing_strategy: How to test the fix
  - additional_context: Any other relevant information
---

## Problem Description
{{problem_description}}

## Expected vs Current Behavior

### Expected Behavior
{{expected_behavior}}

### Current Behavior
{{current_behavior}}

## Steps to Reproduce
{{steps_to_reproduce}}

## Root Cause Analysis
{{root_cause}}

## Proposed Solution
{{proposed_solution}}

## Implementation Plan

### Files to Modify
{{files_to_modify}}

### Testing Strategy
{{testing_strategy}}

## Additional Context
{{additional_context}}

## Checklist
- [ ] Bug reproduced and understood
- [ ] Root cause identified
- [ ] Solution designed
- [ ] Tests written/updated
- [ ] Implementation completed
- [ ] Manual testing performed
- [ ] Code review completed
- [ ] Documentation updated