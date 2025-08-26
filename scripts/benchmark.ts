#!/usr/bin/env npx ts-node
/**
 * @fileoverview Performance benchmark for cursor-prompt-template-engine
 * @lastmodified 2025-08-23T05:00:00Z
 * 
 * Features: TypeScript compilation, template loading, and rendering benchmarks
 * Main APIs: benchmarkTypeScript(), benchmarkTemplateLoading()
 * Constraints: Node.js environment, requires ts-node for execution
 * Patterns: Benchmark pattern, metric collection, performance analysis
 */

import { performance } from 'perf_hooks';
import { execSync } from 'child_process';
import { TemplateService } from '../src/services/template.service';
import { CacheService } from '../src/services/cache.service';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
  name: string;
  duration: number;
  success: boolean;
  error?: string;
  metrics?: Record<string, number>;
}

class BenchmarkRunner {
  private results: BenchmarkResult[] = [];

  async runAllBenchmarks(): Promise<void> {
    console.log('🚀 Starting Performance Benchmarks...\n');
    
    await this.benchmarkTypeScriptCompilation();
    await this.benchmarkTemplateService();
    await this.benchmarkCacheService();
    await this.benchmarkFileOperations();
    
    this.printResults();
  }

  private async benchmarkTypeScriptCompilation(): Promise<void> {
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
          'compilation_time_ms': end - start
        }
      });
      
      console.log(`✅ TypeScript compilation: ${(end - start).toFixed(2)}ms\n`);
    } catch (error: any) {
      const end = performance.now();
      this.results.push({
        name: 'TypeScript Compilation',
        duration: end - start,
        success: false,
        error: error.message
      });
      console.log(`❌ TypeScript compilation failed: ${error.message}\n`);
    }
  }

  private async benchmarkTemplateService(): Promise<void> {
    console.log('🔧 Testing TemplateService performance...');
    
    const service = new TemplateService();
    const iterations = 100;
    
    // Create a test template
    const testTemplate = {
      name: 'test-template',
      version: '1.0.0',
      description: 'Test template for benchmarking',
      files: [{
        path: 'test.txt',
        content: 'Hello {{name}}! This is a test with {{count}} items.'
      }],
      variables: {
        name: { type: 'string', default: 'World' },
        count: { type: 'number', default: 5 }
      },
      commands: [],
      metadata: {}
    };

    // Benchmark template rendering
    const renderStart = performance.now();
    let renderSuccess = 0;
    
    for (let i = 0; i < iterations; i++) {
      try {
        await service.renderTemplate(testTemplate as any, {
          name: `Test${i}`,
          count: i
        });
        renderSuccess++;
      } catch (error) {
        console.log(`Render error on iteration ${i}:`, error);
      }
    }
    
    const renderEnd = performance.now();
    const avgRenderTime = (renderEnd - renderStart) / iterations;
    
    this.results.push({
      name: 'Template Rendering',
      duration: renderEnd - renderStart,
      success: renderSuccess === iterations,
      metrics: {
        'total_time_ms': renderEnd - renderStart,
        'average_render_time_ms': avgRenderTime,
        'successful_renders': renderSuccess,
        'failed_renders': iterations - renderSuccess,
        'renders_per_second': 1000 / avgRenderTime
      }
    });
    
    console.log(`✅ Template rendering: ${iterations} iterations in ${(renderEnd - renderStart).toFixed(2)}ms`);
    console.log(`📊 Average: ${avgRenderTime.toFixed(2)}ms per render, ${(1000 / avgRenderTime).toFixed(0)} renders/sec\n`);
  }

  private async benchmarkCacheService(): Promise<void> {
    console.log('💾 Testing CacheService performance...');
    
    const cache = new CacheService<string>({
      maxSize: 1000,
      maxAge: 60000
    });
    
    const iterations = 10000;
    
    // Benchmark cache operations
    const start = performance.now();
    
    // Fill cache
    for (let i = 0; i < iterations; i++) {
      await cache.set(`key-${i}`, `value-${i}`);
    }
    
    const fillEnd = performance.now();
    
    // Read from cache
    let hits = 0;
    for (let i = 0; i < iterations; i++) {
      const value = await cache.get(`key-${i}`);
      if (value) hits++;
    }
    
    const readEnd = performance.now();
    
    const stats = cache.getStats();
    
    this.results.push({
      name: 'Cache Operations',
      duration: readEnd - start,
      success: true,
      metrics: {
        'fill_time_ms': fillEnd - start,
        'read_time_ms': readEnd - fillEnd,
        'total_time_ms': readEnd - start,
        'cache_hits': stats.hits,
        'cache_misses': stats.misses,
        'hit_rate_percent': stats.hitRate * 100,
        'operations_per_second': (iterations * 2) / ((readEnd - start) / 1000)
      }
    });
    
    console.log(`✅ Cache operations: ${iterations * 2} ops in ${(readEnd - start).toFixed(2)}ms`);
    console.log(`📊 Hit rate: ${(stats.hitRate * 100).toFixed(1)}%, ${((iterations * 2) / ((readEnd - start) / 1000)).toFixed(0)} ops/sec\n`);
  }

  private async benchmarkFileOperations(): Promise<void> {
    console.log('📁 Testing file operations performance...');
    
    const tempDir = path.join(__dirname, '../temp-benchmark');
    const iterations = 100;
    
    try {
      // Create temp directory
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const start = performance.now();
      
      // Write files
      for (let i = 0; i < iterations; i++) {
        const filePath = path.join(tempDir, `test-${i}.txt`);
        await fs.promises.writeFile(filePath, `Test content ${i}`.repeat(100));
      }
      
      const writeEnd = performance.now();
      
      // Read files
      for (let i = 0; i < iterations; i++) {
        const filePath = path.join(tempDir, `test-${i}.txt`);
        await fs.promises.readFile(filePath, 'utf8');
      }
      
      const readEnd = performance.now();
      
      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      this.results.push({
        name: 'File Operations',
        duration: readEnd - start,
        success: true,
        metrics: {
          'write_time_ms': writeEnd - start,
          'read_time_ms': readEnd - writeEnd,
          'total_time_ms': readEnd - start,
          'files_per_second': iterations / ((readEnd - start) / 1000)
        }
      });
      
      console.log(`✅ File operations: ${iterations * 2} ops in ${(readEnd - start).toFixed(2)}ms`);
      console.log(`📊 ${(iterations / ((readEnd - start) / 1000)).toFixed(0)} files/sec\n`);
      
    } catch (error: any) {
      this.results.push({
        name: 'File Operations',
        duration: 0,
        success: false,
        error: error.message
      });
      console.log(`❌ File operations failed: ${error.message}\n`);
    }
  }

  private printResults(): void {
    console.log('📊 Benchmark Results Summary:');
    console.log('=' .repeat(80));
    
    let totalDuration = 0;
    let successCount = 0;
    
    for (const result of this.results) {
      totalDuration += result.duration;
      if (result.success) successCount++;
      
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.duration.toFixed(2)}ms`);
      
      if (result.metrics) {
        for (const [key, value] of Object.entries(result.metrics)) {
          console.log(`   ${key}: ${typeof value === 'number' ? value.toFixed(2) : value}`);
        }
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log();
    }
    
    console.log('=' .repeat(80));
    console.log(`📈 Overall Results:`);
    console.log(`   Total time: ${totalDuration.toFixed(2)}ms`);
    console.log(`   Success rate: ${successCount}/${this.results.length} (${((successCount / this.results.length) * 100).toFixed(1)}%)`);
    
    if (successCount === this.results.length) {
      console.log(`🎉 All benchmarks passed! System performance is good.`);
    } else {
      console.log(`⚠️  ${this.results.length - successCount} benchmark(s) failed.`);
    }
  }
}

// Run benchmarks if called directly
if (require.main === module) {
  const runner = new BenchmarkRunner();
  runner.runAllBenchmarks().catch(console.error);
}

export { BenchmarkRunner };