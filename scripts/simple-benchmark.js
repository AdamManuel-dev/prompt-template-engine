#!/usr/bin/env node
/**
 * @fileoverview Simple performance benchmark for cursor-prompt-template-engine
 * @lastmodified 2025-08-23T05:00:00Z
 */

const { performance } = require('perf_hooks');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class SimpleBenchmark {
  constructor() {
    this.results = [];
  }

  async run() {
    console.log('🚀 Starting Performance Benchmarks...\n');
    
    await this.benchmarkTypeScript();
    await this.benchmarkFileOperations();
    await this.benchmarkBasicOperations();
    
    this.printResults();
  }

  async benchmarkTypeScript() {
    console.log('📝 Testing TypeScript compilation...');
    const start = performance.now();
    
    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
      const end = performance.now();
      
      this.results.push({
        name: 'TypeScript Compilation',
        duration: end - start,
        success: true,
        metrics: {
          compilation_time_ms: end - start
        }
      });
      
      console.log(`✅ TypeScript compilation: ${(end - start).toFixed(2)}ms\n`);
    } catch (error) {
      const end = performance.now();
      this.results.push({
        name: 'TypeScript Compilation',
        duration: end - start,
        success: false,
        error: error.message
      });
      console.log(`❌ TypeScript compilation failed\n`);
    }
  }

  async benchmarkFileOperations() {
    console.log('📁 Testing file operations...');
    
    const tempDir = path.join(__dirname, '../temp-benchmark');
    const iterations = 50;
    
    try {
      // Create temp directory
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const start = performance.now();
      
      // Write files
      for (let i = 0; i < iterations; i++) {
        const filePath = path.join(tempDir, `test-${i}.txt`);
        fs.writeFileSync(filePath, `Test content ${i}`.repeat(50));
      }
      
      const writeEnd = performance.now();
      
      // Read files
      for (let i = 0; i < iterations; i++) {
        const filePath = path.join(tempDir, `test-${i}.txt`);
        fs.readFileSync(filePath, 'utf8');
      }
      
      const readEnd = performance.now();
      
      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      this.results.push({
        name: 'File Operations',
        duration: readEnd - start,
        success: true,
        metrics: {
          write_time_ms: writeEnd - start,
          read_time_ms: readEnd - writeEnd,
          total_time_ms: readEnd - start,
          files_processed: iterations * 2
        }
      });
      
      console.log(`✅ File operations: ${iterations * 2} ops in ${(readEnd - start).toFixed(2)}ms\n`);
      
    } catch (error) {
      this.results.push({
        name: 'File Operations',
        duration: 0,
        success: false,
        error: error.message
      });
      console.log(`❌ File operations failed: ${error.message}\n`);
    }
  }

  async benchmarkBasicOperations() {
    console.log('⚡ Testing basic operations...');
    
    const iterations = 100000;
    const start = performance.now();
    
    // JSON parsing/stringifying
    const testData = { name: 'test', count: 42, items: Array.from({length: 100}, (_, i) => i) };
    
    for (let i = 0; i < iterations; i++) {
      const json = JSON.stringify(testData);
      JSON.parse(json);
    }
    
    const end = performance.now();
    
    this.results.push({
      name: 'JSON Operations',
      duration: end - start,
      success: true,
      metrics: {
        total_time_ms: end - start,
        operations: iterations * 2,
        ops_per_second: (iterations * 2) / ((end - start) / 1000)
      }
    });
    
    console.log(`✅ JSON operations: ${iterations * 2} ops in ${(end - start).toFixed(2)}ms\n`);
  }

  printResults() {
    console.log('📊 Benchmark Results Summary:');
    console.log('=' .repeat(70));
    
    let totalDuration = 0;
    let successCount = 0;
    
    for (const result of this.results) {
      totalDuration += result.duration;
      if (result.success) successCount++;
      
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.duration.toFixed(2)}ms`);
      
      if (result.metrics) {
        for (const [key, value] of Object.entries(result.metrics)) {
          const displayValue = typeof value === 'number' ? value.toFixed(2) : value;
          console.log(`   ${key.replace(/_/g, ' ')}: ${displayValue}`);
        }
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log();
    }
    
    console.log('=' .repeat(70));
    console.log(`📈 Overall Results:`);
    console.log(`   Total time: ${totalDuration.toFixed(2)}ms`);
    console.log(`   Success rate: ${successCount}/${this.results.length} (${((successCount / this.results.length) * 100).toFixed(1)}%)`);
    
    if (successCount === this.results.length) {
      console.log(`🎉 All benchmarks passed! TypeScript fixes are working correctly.`);
    } else {
      console.log(`⚠️  ${this.results.length - successCount} benchmark(s) failed.`);
    }
    
    // Performance assessment
    const compilationResult = this.results.find(r => r.name === 'TypeScript Compilation');
    if (compilationResult && compilationResult.success) {
      const compileTime = compilationResult.duration;
      if (compileTime < 5000) {
        console.log(`⚡ TypeScript compilation is fast (${compileTime.toFixed(0)}ms)`);
      } else if (compileTime < 15000) {
        console.log(`🟡 TypeScript compilation is moderate (${compileTime.toFixed(0)}ms)`);
      } else {
        console.log(`🔴 TypeScript compilation is slow (${compileTime.toFixed(0)}ms)`);
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  const benchmark = new SimpleBenchmark();
  benchmark.run().catch(console.error);
}

module.exports = { SimpleBenchmark };