# Refactoring Template

---
category: refactor
description: Template for code refactoring and architecture improvements
version: 1.0.0
variables:
  - refactoring_goal: Primary objective of the refactoring
  - current_state: Description of the current code/architecture
  - target_state: Description of the desired end state
  - motivation: Why this refactoring is needed
  - approach: Step-by-step refactoring approach
  - files_affected: List of files that will be changed
  - breaking_changes: Any breaking changes introduced
  - migration_guide: How to migrate existing code/usage
  - testing_strategy: How to ensure refactoring doesn't break functionality
  - performance_impact: Expected performance improvements or considerations
  - additional_context: Any other relevant information
---

# Refactoring: {{refactoring_goal}}

## Current State
{{current_state}}

## Target State
{{target_state}}

## Motivation
{{motivation}}

## Refactoring Approach
{{approach}}

## Impact Analysis

### Files Affected
{{files_affected}}

### Breaking Changes
{{breaking_changes}}

### Migration Guide
{{migration_guide}}

## Testing Strategy
{{testing_strategy}}

## Performance Impact
{{performance_impact}}

## Additional Context
{{additional_context}}

## Refactoring Checklist
- [ ] Current code analyzed and understood
- [ ] Refactoring plan documented
- [ ] Backup/branch created
- [ ] Tests written to preserve behavior
- [ ] Incremental changes planned
- [ ] Code review process defined
- [ ] Migration path documented
- [ ] Performance benchmarks established
- [ ] Refactoring implementation started
- [ ] Tests passing after each change
- [ ] Code coverage maintained
- [ ] Documentation updated
- [ ] Team training completed (if needed)
- [ ] Rollback plan prepared
- [ ] Monitoring for issues post-deployment