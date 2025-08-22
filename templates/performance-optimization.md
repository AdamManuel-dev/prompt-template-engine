---
name: Performance Optimization
description: Analyze and optimize code performance with repository context
context:
  git: true
  system: true
  files:
    - package.json
  patterns:
    - "**/*.{ts,js}"
variables:
  area:
    description: Specific area to optimize (e.g., API, database, frontend)
    required: false
  metrics:
    description: Current performance metrics if available
    required: false
---

# Performance Optimization Request

## 🎯 Optimization Focus
{{#if area}}
**Target Area**: {{area}}
{{else}}
General performance optimization across the codebase.
{{/if}}

{{#if metrics}}
## 📊 Current Metrics
{{metrics}}
{{/if}}

## 🔍 Repository Analysis
{{#if git}}
### Current State
- **Branch**: {{git.branch}}
- **Modified Files**: {{git.files.modified.length}}
{{#if git.lastCommit}}
- **Recent Work**: {{git.lastCommit.message}}
{{/if}}
{{/if}}

{{#if project}}
### Project Overview
- **Size**: {{project.totalFiles}} files
- **Primary Language**: {{project.mainLanguage}}
{{/if}}

## 🚀 Performance Analysis Areas

### 1. Code-Level Optimizations
Please analyze for:
- [ ] **Algorithm Complexity**: O(n²) or worse operations
- [ ] **Loop Optimizations**: Nested loops, unnecessary iterations
- [ ] **Memory Usage**: Memory leaks, large object creation
- [ ] **String Operations**: Concatenation in loops
- [ ] **Regular Expressions**: Complex or repeated regex compilation

### 2. Data Structure & Algorithms
- [ ] **Collection Choice**: Array vs Set vs Map usage
- [ ] **Caching Opportunities**: Memoization, result caching
- [ ] **Data Access Patterns**: Random vs sequential access
- [ ] **Sorting/Searching**: Optimal algorithm selection

### 3. Asynchronous Operations
- [ ] **Async/Await Usage**: Proper parallelization
- [ ] **Promise Patterns**: Promise.all() vs sequential
- [ ] **Event Loop Blocking**: Long-running synchronous operations
- [ ] **Batching**: Group operations for efficiency

### 4. Database & I/O
- [ ] **Query Optimization**: N+1 problems, missing indexes
- [ ] **Connection Pooling**: Proper pool management
- [ ] **Lazy Loading**: Defer expensive operations
- [ ] **File Operations**: Streaming vs loading entire files

### 5. Network & API
- [ ] **HTTP Requests**: Minimize round trips
- [ ] **Payload Size**: Compression, pagination
- [ ] **Caching Headers**: ETags, Cache-Control
- [ ] **Request Batching**: Combine multiple requests

### 6. Frontend Specific (if applicable)
- [ ] **Bundle Size**: Code splitting, tree shaking
- [ ] **Render Performance**: Virtual DOM, re-renders
- [ ] **Asset Optimization**: Images, fonts, CSS
- [ ] **Lazy Loading**: Components, routes, assets

## 📈 Optimization Goals

### Performance Targets
- **Response Time**: < 200ms for API calls
- **Page Load**: < 3 seconds
- **Memory Usage**: Stable under load
- **CPU Usage**: < 70% under normal load

### Metrics to Track
1. **Execution Time**: Before/after measurements
2. **Memory Footprint**: Heap size, garbage collection
3. **Throughput**: Requests/operations per second
4. **Resource Utilization**: CPU, memory, disk, network

## 🔧 Optimization Deliverables

Please provide:

1. **Performance Bottlenecks**
   - Identify top 5 performance issues
   - Impact assessment for each
   - Root cause analysis

2. **Optimization Recommendations**
   - Specific code changes
   - Priority order (high/medium/low)
   - Estimated performance improvement

3. **Implementation Guide**
   - Step-by-step optimization plan
   - Code examples
   - Testing approach

4. **Monitoring Strategy**
   - Key metrics to track
   - Alerting thresholds
   - Performance regression prevention

## 🧪 Testing Approach

### Performance Testing
- Load testing scenarios
- Stress testing limits
- Benchmark comparisons
- Profiling results

### Validation
- Before/after metrics
- A/B testing plan
- Rollback strategy
- Success criteria

## Context
- **Analysis Date**: {{date}}
- **System**: {{system.platform}}
- **Node Version**: {{system.nodeVersion}}
- **Working Directory**: {{system.cwd}}

---
*Generated with cursor-prompt-template-engine*