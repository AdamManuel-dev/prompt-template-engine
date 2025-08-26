# Optimization Test Suite

## Overview

This directory contains comprehensive tests for the PromptWizard optimization system, ensuring reliable, high-performance, and high-quality prompt optimization functionality.

## Test Structure

```
tests/optimization/
├── README.md                 # This documentation
├── index.test.ts            # Test suite orchestration
├── optimizer.test.ts        # Core optimizer unit tests
├── integration.test.ts      # Service integration tests
├── e2e.test.ts             # End-to-end workflow tests
├── performance.test.ts      # Performance benchmarks
├── load.test.ts            # Load and stress testing
├── quality-metrics.test.ts  # Quality validation tests
├── quality-validator.ts     # Quality validation utilities
└── fixtures.ts             # Test fixtures and mocks
```

## Test Categories

### 1. Unit Tests (`optimizer.test.ts`)

Tests core optimization components in isolation:

- **PromptOptimizationService**: Template optimization, batch processing, caching
- **OptimizationPipeline**: Pipeline stages, metadata extraction, result processing
- **Event handling**: Job lifecycle events, progress tracking
- **Cache management**: Result caching, invalidation, statistics
- **Error handling**: Timeout handling, failure recovery, retry logic

**Coverage Target**: >90% line coverage

### 2. Integration Tests (`integration.test.ts`)

Tests service integration and communication:

- **PromptWizard Client**: HTTP API communication, authentication, retry logic
- **Service Communication**: Request/response handling, error propagation
- **Cache Integration**: Multi-tier caching, cache service coordination
- **Network Simulation**: Timeout handling, connection failures, rate limiting
- **Event Integration**: Real-time progress updates, job status tracking

**Coverage Target**: >80% coverage

### 3. End-to-End Tests (`e2e.test.ts`)

Tests complete optimization workflows:

- **CLI Integration**: Optimize command execution, file operations
- **Template Processing**: Simple to complex template optimization
- **Batch Operations**: Multi-template processing, partial failures
- **Progress Reporting**: Real-time updates, completion notifications
- **Validation Workflows**: Result validation, quality checks
- **Error Recovery**: Service interruption handling, graceful degradation

**Coverage Target**: Complete workflow validation

### 4. Performance Tests (`performance.test.ts`)

Establishes and validates performance benchmarks:

- **Single Optimization**: Response time thresholds by template complexity
- **Batch Processing**: Throughput measurement, concurrency efficiency
- **Memory Management**: Usage tracking, leak detection, resource cleanup
- **Cache Performance**: Hit/miss ratios, speed improvements
- **Baseline Monitoring**: Performance regression detection

**Performance Targets**:
- Simple templates: <1 second
- Medium templates: <3 seconds
- Complex templates: <8 seconds
- Batch throughput: >1.5 ops/second
- Memory usage: <500MB peak

### 5. Load/Stress Tests (`load.test.ts`)

Validates system scalability and stability:

- **Concurrent Load**: Multi-user simulation, resource contention
- **Stress Testing**: Breaking point identification, failure modes
- **Recovery Testing**: Post-stress recovery, service restoration
- **Resource Pressure**: Memory/CPU pressure testing
- **Scalability Analysis**: Performance degradation patterns

**Load Targets**:
- Concurrent requests: >40 simultaneous
- Error rate: <10% under normal load
- Recovery time: <30 seconds after stress
- Memory stability: No significant leaks

### 6. Quality Validation Tests (`quality-metrics.test.ts`)

Ensures optimization quality and correctness:

- **Quality Validator**: Threshold validation, statistical analysis
- **Semantic Preservation**: Content similarity, meaning retention
- **Variable Integrity**: Template variable preservation
- **Regression Detection**: Quality degradation identification
- **Statistical Analysis**: Confidence intervals, trend analysis

**Quality Targets**:
- Minimum quality score: >0.7
- Semantic similarity: >0.8
- Variable preservation: 100%
- Confidence level: >0.6

## Supporting Infrastructure

### Quality Validator (`quality-validator.ts`)

Comprehensive quality assurance utilities:

- **Validation Framework**: Configurable thresholds, multiple validators
- **Metric Calculation**: Statistical analysis, trend detection
- **Baseline Management**: Performance comparison, regression tracking
- **Reporting**: Quality reports, issue identification, recommendations

### Test Fixtures (`fixtures.ts`)

Extensive test data and mock factories:

- **Template Fixtures**: Templates by category and complexity
- **Mock Factories**: Realistic optimization results, API responses
- **Test Data Generation**: Randomized data, batch test support
- **Performance Scenarios**: Benchmarking test cases

## Running Tests

### Individual Test Suites

```bash
# Unit tests
npm test -- tests/optimization/optimizer.test.ts

# Integration tests
npm test -- tests/optimization/integration.test.ts

# Performance tests (extended timeout)
npm test -- tests/optimization/performance.test.ts --testTimeout=300000

# Load tests (requires significant resources)
npm test -- tests/optimization/load.test.ts --testTimeout=600000
```

### Full Test Suite

```bash
# Run all optimization tests
npm test -- tests/optimization/

# Run with coverage
npm test -- tests/optimization/ --coverage

# Run in CI mode
npm test -- tests/optimization/ --ci --coverage --maxWorkers=2
```

### Test Configuration

Tests use extended timeouts for performance and load testing:

```json
{
  "testTimeout": {
    "unit": 30000,
    "integration": 60000, 
    "performance": 300000,
    "load": 600000
  }
}
```

## Quality Gates

All tests must pass these quality gates:

1. **Functional Correctness**: All unit and integration tests pass
2. **Performance Standards**: Benchmarks within acceptable thresholds
3. **Quality Assurance**: Optimization quality meets standards
4. **Scalability Requirements**: Load tests demonstrate acceptable performance
5. **Regression Prevention**: No degradation in key metrics

## Continuous Integration

### Pre-commit Hooks
- Unit tests execution
- Code coverage validation
- Quality standard verification

### CI Pipeline
- Full test suite execution
- Performance benchmark validation  
- Coverage reporting
- Quality metrics analysis

### Deployment Gates
- All tests must pass
- Coverage thresholds met
- Performance baselines satisfied
- Quality standards maintained

## Troubleshooting

### Common Issues

**Test Timeouts**:
```bash
# Increase timeout for load tests
jest --testTimeout=900000 tests/optimization/load.test.ts
```

**Memory Issues**:
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm test
```

**Performance Variability**:
- Run tests multiple times for consistent results
- Consider system load when interpreting performance tests
- Use average results over multiple runs

### Debug Mode

```bash
# Run with verbose output
npm test -- tests/optimization/ --verbose

# Run specific test with debugging
NODE_ENV=verbose npm test -- tests/optimization/optimizer.test.ts
```

## Contributing

When adding new optimization tests:

1. **Follow Patterns**: Use existing test patterns and utilities
2. **Update Documentation**: Document new test scenarios
3. **Quality Gates**: Ensure tests meet quality standards
4. **Performance Impact**: Consider test execution time
5. **Coverage**: Maintain high test coverage standards

## Monitoring and Alerting

### Key Metrics
- Test execution time trends
- Coverage percentage changes
- Performance benchmark deviations  
- Quality score distributions

### Alerts
- Test failure notifications
- Performance regression alerts
- Coverage threshold violations
- Quality standard breaches

---

This test suite ensures the PromptWizard optimization system maintains high standards for reliability, performance, and quality across all operational scenarios.