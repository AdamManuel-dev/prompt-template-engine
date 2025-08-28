/**
 * @fileoverview Performance Tracker for PromptWizard Plugin
 * @lastmodified 2025-08-26T10:30:00Z
 *
 * Features: Real-time performance monitoring, token usage tracking, cost estimation
 * Main APIs: startTracking, endTracking, getMetrics, generateReport
 * Constraints: Monitors optimization pipeline performance
 * Patterns: Observer pattern, metrics collection, performance analysis
 */

class PerformanceTracker {
  constructor(config = {}) {
    this.config = {
      trackTokenUsage: true,
      trackResponseTime: true,
      trackCostEstimation: true,
      ...config.performanceMetrics || {}
    };

    // Active tracking sessions
    this.activeSessions = new Map();
    
    // Historical metrics
    this.historicalMetrics = [];
    
    // Performance thresholds
    this.thresholds = {
      maxResponseTime: 5000,      // 5 seconds
      maxTokenUsage: 2000,        // tokens
      maxCostPerRequest: 0.10     // $0.10
    };

    // Cost estimation rates (per 1K tokens)
    this.costRates = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'claude-3': { input: 0.015, output: 0.075 },
      'claude-haiku': { input: 0.0025, output: 0.0125 },
      'default': { input: 0.01, output: 0.03 }
    };

    // Metrics aggregation
    this.aggregatedMetrics = {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      averageResponseTime: 0,
      successRate: 0
    };

    // Performance monitoring state
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  /**
   * Start tracking performance for a template optimization session
   * @param {string} templateId - Template identifier
   * @param {Object} options - Tracking options
   * @returns {Promise<string>} Tracking session ID
   */
  async startTracking(templateId, options = {}) {
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      templateId,
      startTime: Date.now(),
      startMemory: this.getMemoryUsage(),
      options: {
        trackTokens: this.config.trackTokenUsage,
        trackTime: this.config.trackResponseTime,
        trackCost: this.config.trackCostEstimation,
        model: 'default',
        ...options
      },
      metrics: {
        responseTime: 0,
        tokenUsage: {
          input: 0,
          output: 0,
          total: 0
        },
        memoryUsage: {
          start: 0,
          peak: 0,
          end: 0
        },
        costEstimation: {
          inputCost: 0,
          outputCost: 0,
          totalCost: 0
        },
        performance: {
          optimizationTime: 0,
          qualityAnalysisTime: 0,
          cacheHits: 0,
          cacheMisses: 0
        }
      },
      checkpoints: [],
      errors: []
    };

    this.activeSessions.set(sessionId, session);
    
    // Start memory monitoring for this session
    if (this.config.trackMemoryUsage) {
      this.startMemoryMonitoring(sessionId);
    }

    return sessionId;
  }

  /**
   * Add a performance checkpoint during optimization
   * @param {string} sessionId - Tracking session ID
   * @param {string} checkpoint - Checkpoint name
   * @param {Object} data - Additional checkpoint data
   * @returns {Promise<void>}
   */
  async addCheckpoint(sessionId, checkpoint, data = {}) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const checkpointData = {
      name: checkpoint,
      timestamp: Date.now(),
      elapsed: Date.now() - session.startTime,
      memoryUsage: this.getMemoryUsage(),
      ...data
    };

    session.checkpoints.push(checkpointData);

    // Update specific timing metrics
    switch (checkpoint) {
      case 'optimization_start':
        session.optimizationStartTime = Date.now();
        break;
      case 'optimization_end':
        if (session.optimizationStartTime) {
          session.metrics.performance.optimizationTime = 
            Date.now() - session.optimizationStartTime;
        }
        break;
      case 'quality_analysis_start':
        session.qualityAnalysisStartTime = Date.now();
        break;
      case 'quality_analysis_end':
        if (session.qualityAnalysisStartTime) {
          session.metrics.performance.qualityAnalysisTime = 
            Date.now() - session.qualityAnalysisStartTime;
        }
        break;
      case 'cache_hit':
        session.metrics.performance.cacheHits++;
        break;
      case 'cache_miss':
        session.metrics.performance.cacheMisses++;
        break;
    }
  }

  /**
   * Update token usage for a session
   * @param {string} sessionId - Tracking session ID
   * @param {Object} tokenUsage - Token usage data
   * @returns {Promise<void>}
   */
  async updateTokenUsage(sessionId, tokenUsage) {
    const session = this.activeSessions.get(sessionId);
    if (!session || !this.config.trackTokenUsage) return;

    session.metrics.tokenUsage = {
      input: tokenUsage.input || 0,
      output: tokenUsage.output || 0,
      total: (tokenUsage.input || 0) + (tokenUsage.output || 0)
    };

    // Update cost estimation
    if (this.config.trackCostEstimation) {
      this.updateCostEstimation(session);
    }
  }

  /**
   * Record an error during tracking
   * @param {string} sessionId - Tracking session ID
   * @param {Error|string} error - Error information
   * @returns {Promise<void>}
   */
  async recordError(sessionId, error) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.errors.push({
      timestamp: Date.now(),
      elapsed: Date.now() - session.startTime,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }

  /**
   * End tracking and calculate final metrics
   * @param {string} sessionId - Tracking session ID
   * @param {Object} results - Optimization results
   * @returns {Promise<Object>} Final performance metrics
   */
  async endTracking(sessionId, results = {}) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Calculate final metrics
    const endTime = Date.now();
    const endMemory = this.getMemoryUsage();
    
    session.endTime = endTime;
    session.metrics.responseTime = endTime - session.startTime;
    session.metrics.memoryUsage.end = endMemory;
    session.metrics.memoryUsage.peak = Math.max(
      session.metrics.memoryUsage.peak || 0,
      endMemory
    );

    // Include optimization results
    if (results.tokenReduction) {
      session.metrics.optimization = {
        tokenReduction: results.tokenReduction,
        qualityImprovement: results.qualityImprovement || 0,
        efficiency: this.calculateEfficiency(session)
      };
    }

    // Calculate performance score
    session.metrics.performanceScore = this.calculatePerformanceScore(session);

    // Move to historical metrics
    const finalMetrics = this.createFinalMetrics(session);
    this.historicalMetrics.push(finalMetrics);
    this.updateAggregatedMetrics(finalMetrics);

    // Cleanup active session
    this.activeSessions.delete(sessionId);
    this.stopMemoryMonitoring(sessionId);

    return finalMetrics;
  }

  /**
   * Get current metrics for a tracking session
   * @param {string} sessionId - Tracking session ID
   * @returns {Object|null} Current session metrics
   */
  getCurrentMetrics(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId: session.id,
      templateId: session.templateId,
      elapsed: Date.now() - session.startTime,
      metrics: { ...session.metrics },
      checkpoints: [...session.checkpoints],
      errors: [...session.errors]
    };
  }

  /**
   * Get historical performance metrics
   * @param {Object} filters - Filter options
   * @returns {Array<Object>} Filtered historical metrics
   */
  getHistoricalMetrics(filters = {}) {
    let metrics = [...this.historicalMetrics];

    // Apply filters
    if (filters.templateId) {
      metrics = metrics.filter(m => m.templateId === filters.templateId);
    }
    if (filters.since) {
      const since = new Date(filters.since).getTime();
      metrics = metrics.filter(m => m.endTime >= since);
    }
    if (filters.limit) {
      metrics = metrics.slice(-filters.limit);
    }

    return metrics;
  }

  /**
   * Get aggregated performance metrics
   * @returns {Object} Aggregated metrics
   */
  getAggregatedMetrics() {
    return { ...this.aggregatedMetrics };
  }

  /**
   * Generate performance report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Performance report
   */
  async generateReport(options = {}) {
    const timeframe = options.timeframe || '24h';
    const since = this.getTimeframeSince(timeframe);
    
    const recentMetrics = this.getHistoricalMetrics({ since });
    
    if (recentMetrics.length === 0) {
      return {
        timeframe,
        totalRequests: 0,
        summary: 'No data available for the specified timeframe'
      };
    }

    // Calculate statistics
    const totalRequests = recentMetrics.length;
    const successfulRequests = recentMetrics.filter(m => m.errors.length === 0).length;
    
    const responseTimes = recentMetrics.map(m => m.responseTime);
    const tokenUsages = recentMetrics.map(m => m.tokenUsage.total);
    const costs = recentMetrics.map(m => m.costEstimation.totalCost);

    const report = {
      timeframe,
      period: {
        start: new Date(since).toISOString(),
        end: new Date().toISOString()
      },
      summary: {
        totalRequests,
        successfulRequests,
        successRate: (successfulRequests / totalRequests) * 100,
        errorRate: ((totalRequests - successfulRequests) / totalRequests) * 100
      },
      performance: {
        responseTime: {
          average: this.calculateAverage(responseTimes),
          median: this.calculateMedian(responseTimes),
          p95: this.calculatePercentile(responseTimes, 95),
          min: Math.min(...responseTimes),
          max: Math.max(...responseTimes)
        },
        tokenUsage: {
          average: this.calculateAverage(tokenUsages),
          median: this.calculateMedian(tokenUsages),
          total: tokenUsages.reduce((sum, tokens) => sum + tokens, 0)
        },
        cost: {
          average: this.calculateAverage(costs),
          total: costs.reduce((sum, cost) => sum + cost, 0)
        }
      },
      optimization: {
        averageTokenReduction: this.calculateAverageTokenReduction(recentMetrics),
        averageQualityImprovement: this.calculateAverageQualityImprovement(recentMetrics),
        cacheHitRate: this.calculateCacheHitRate(recentMetrics)
      },
      trends: this.analyzeTrends(recentMetrics),
      recommendations: this.generatePerformanceRecommendations(recentMetrics)
    };

    return report;
  }

  /**
   * Start continuous performance monitoring
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Collect every 30 seconds
  }

  /**
   * Stop continuous performance monitoring
   * @returns {Promise<void>}
   */
  async stop() {
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Cleanup performance tracker resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    await this.stop();
    this.activeSessions.clear();
    this.historicalMetrics = [];
  }

  // Private methods

  /**
   * Generate unique session ID
   * @returns {string} Session ID
   * @private
   */
  generateSessionId() {
    return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current memory usage
   * @returns {number} Memory usage in MB
   * @private
   */
  getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return Math.round(usage.heapUsed / 1024 / 1024);
    }
    return 0;
  }

  /**
   * Update cost estimation for a session
   * @param {Object} session - Tracking session
   * @private
   */
  updateCostEstimation(session) {
    const model = session.options.model || 'default';
    const rates = this.costRates[model] || this.costRates.default;
    
    const inputTokens = session.metrics.tokenUsage.input;
    const outputTokens = session.metrics.tokenUsage.output;
    
    session.metrics.costEstimation = {
      inputCost: (inputTokens / 1000) * rates.input,
      outputCost: (outputTokens / 1000) * rates.output,
      totalCost: (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output
    };
  }

  /**
   * Calculate efficiency score
   * @param {Object} session - Tracking session
   * @returns {number} Efficiency score (0-100)
   * @private
   */
  calculateEfficiency(session) {
    const responseTime = session.metrics.responseTime;
    const tokenUsage = session.metrics.tokenUsage.total;
    const cacheHitRate = session.metrics.performance.cacheHits / 
      (session.metrics.performance.cacheHits + session.metrics.performance.cacheMisses + 1);
    
    // Efficiency based on speed, token usage, and cache utilization
    const speedScore = Math.max(0, 100 - (responseTime / this.thresholds.maxResponseTime) * 50);
    const tokenScore = Math.max(0, 100 - (tokenUsage / this.thresholds.maxTokenUsage) * 50);
    const cacheScore = cacheHitRate * 100;
    
    return (speedScore * 0.4 + tokenScore * 0.4 + cacheScore * 0.2);
  }

  /**
   * Calculate performance score
   * @param {Object} session - Tracking session
   * @returns {number} Performance score (0-100)
   * @private
   */
  calculatePerformanceScore(session) {
    const responseTime = session.metrics.responseTime;
    const tokenUsage = session.metrics.tokenUsage.total;
    const cost = session.metrics.costEstimation.totalCost;
    const errorCount = session.errors.length;
    
    // Base score
    let score = 100;
    
    // Response time penalty
    if (responseTime > this.thresholds.maxResponseTime) {
      score -= 30;
    } else {
      score -= (responseTime / this.thresholds.maxResponseTime) * 15;
    }
    
    // Token usage penalty
    if (tokenUsage > this.thresholds.maxTokenUsage) {
      score -= 25;
    } else {
      score -= (tokenUsage / this.thresholds.maxTokenUsage) * 10;
    }
    
    // Cost penalty
    if (cost > this.thresholds.maxCostPerRequest) {
      score -= 20;
    } else {
      score -= (cost / this.thresholds.maxCostPerRequest) * 10;
    }
    
    // Error penalty
    score -= errorCount * 15;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Create final metrics object
   * @param {Object} session - Tracking session
   * @returns {Object} Final metrics
   * @private
   */
  createFinalMetrics(session) {
    return {
      sessionId: session.id,
      templateId: session.templateId,
      startTime: session.startTime,
      endTime: session.endTime,
      responseTime: session.metrics.responseTime,
      tokenUsage: { ...session.metrics.tokenUsage },
      costEstimation: { ...session.metrics.costEstimation },
      memoryUsage: { ...session.metrics.memoryUsage },
      performance: { ...session.metrics.performance },
      optimization: session.metrics.optimization || {},
      performanceScore: session.metrics.performanceScore,
      checkpoints: [...session.checkpoints],
      errors: [...session.errors],
      success: session.errors.length === 0
    };
  }

  /**
   * Update aggregated metrics
   * @param {Object} metrics - Session metrics
   * @private
   */
  updateAggregatedMetrics(metrics) {
    this.aggregatedMetrics.totalRequests++;
    this.aggregatedMetrics.totalTokens += metrics.tokenUsage.total;
    this.aggregatedMetrics.totalCost += metrics.costEstimation.totalCost;
    
    // Update average response time
    const totalTime = this.aggregatedMetrics.averageResponseTime * 
      (this.aggregatedMetrics.totalRequests - 1) + metrics.responseTime;
    this.aggregatedMetrics.averageResponseTime = totalTime / this.aggregatedMetrics.totalRequests;
    
    // Update success rate
    const successfulRequests = this.historicalMetrics.filter(m => m.success).length;
    this.aggregatedMetrics.successRate = (successfulRequests / this.aggregatedMetrics.totalRequests) * 100;
  }

  /**
   * Start memory monitoring for a session
   * @param {string} sessionId - Session ID
   * @private
   */
  startMemoryMonitoring(sessionId) {
    // Simple memory monitoring - in production, this would be more sophisticated
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.metrics.memoryUsage.start = this.getMemoryUsage();
    }
  }

  /**
   * Stop memory monitoring for a session
   * @param {string} sessionId - Session ID
   * @private
   */
  stopMemoryMonitoring(sessionId) {
    // Cleanup memory monitoring resources
  }

  /**
   * Collect system metrics
   * @private
   */
  collectSystemMetrics() {
    // Update peak memory for all active sessions
    const currentMemory = this.getMemoryUsage();
    for (const session of this.activeSessions.values()) {
      session.metrics.memoryUsage.peak = Math.max(
        session.metrics.memoryUsage.peak || 0,
        currentMemory
      );
    }
  }

  /**
   * Get timeframe start timestamp
   * @param {string} timeframe - Timeframe string
   * @returns {number} Start timestamp
   * @private
   */
  getTimeframeSince(timeframe) {
    const now = Date.now();
    const multipliers = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    const multiplier = multipliers[timeframe] || multipliers['24h'];
    return now - multiplier;
  }

  /**
   * Calculate average of array
   * @param {Array<number>} values - Values
   * @returns {number} Average
   * @private
   */
  calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate median of array
   * @param {Array<number>} values - Values
   * @returns {number} Median
   * @private
   */
  calculateMedian(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Calculate percentile
   * @param {Array<number>} values - Values
   * @param {number} percentile - Percentile (0-100)
   * @returns {number} Percentile value
   * @private
   */
  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate average token reduction
   * @param {Array<Object>} metrics - Metrics array
   * @returns {number} Average token reduction
   * @private
   */
  calculateAverageTokenReduction(metrics) {
    const reductions = metrics
      .filter(m => m.optimization?.tokenReduction)
      .map(m => m.optimization.tokenReduction);
    return this.calculateAverage(reductions);
  }

  /**
   * Calculate average quality improvement
   * @param {Array<Object>} metrics - Metrics array
   * @returns {number} Average quality improvement
   * @private
   */
  calculateAverageQualityImprovement(metrics) {
    const improvements = metrics
      .filter(m => m.optimization?.qualityImprovement)
      .map(m => m.optimization.qualityImprovement);
    return this.calculateAverage(improvements);
  }

  /**
   * Calculate cache hit rate
   * @param {Array<Object>} metrics - Metrics array
   * @returns {number} Cache hit rate (0-100)
   * @private
   */
  calculateCacheHitRate(metrics) {
    let totalHits = 0;
    let totalRequests = 0;
    
    for (const metric of metrics) {
      totalHits += metric.performance.cacheHits || 0;
      totalRequests += (metric.performance.cacheHits || 0) + (metric.performance.cacheMisses || 0);
    }
    
    return totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
  }

  /**
   * Analyze performance trends
   * @param {Array<Object>} metrics - Metrics array
   * @returns {Object} Trend analysis
   * @private
   */
  analyzeTrends(metrics) {
    if (metrics.length < 2) {
      return {
        responseTime: 'insufficient_data',
        tokenUsage: 'insufficient_data',
        cost: 'insufficient_data'
      };
    }

    const halfPoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, halfPoint);
    const secondHalf = metrics.slice(halfPoint);

    const firstHalfAvgTime = this.calculateAverage(firstHalf.map(m => m.responseTime));
    const secondHalfAvgTime = this.calculateAverage(secondHalf.map(m => m.responseTime));

    const firstHalfAvgTokens = this.calculateAverage(firstHalf.map(m => m.tokenUsage.total));
    const secondHalfAvgTokens = this.calculateAverage(secondHalf.map(m => m.tokenUsage.total));

    const firstHalfAvgCost = this.calculateAverage(firstHalf.map(m => m.costEstimation.totalCost));
    const secondHalfAvgCost = this.calculateAverage(secondHalf.map(m => m.costEstimation.totalCost));

    return {
      responseTime: this.getTrendDirection(firstHalfAvgTime, secondHalfAvgTime),
      tokenUsage: this.getTrendDirection(firstHalfAvgTokens, secondHalfAvgTokens),
      cost: this.getTrendDirection(firstHalfAvgCost, secondHalfAvgCost)
    };
  }

  /**
   * Get trend direction
   * @param {number} first - First period average
   * @param {number} second - Second period average
   * @returns {string} Trend direction
   * @private
   */
  getTrendDirection(first, second) {
    const change = ((second - first) / first) * 100;
    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Generate performance recommendations
   * @param {Array<Object>} metrics - Metrics array
   * @returns {Array<string>} Recommendations
   * @private
   */
  generatePerformanceRecommendations(metrics) {
    const recommendations = [];
    
    const avgResponseTime = this.calculateAverage(metrics.map(m => m.responseTime));
    const avgTokens = this.calculateAverage(metrics.map(m => m.tokenUsage.total));
    const cacheHitRate = this.calculateCacheHitRate(metrics);
    const errorRate = (metrics.filter(m => !m.success).length / metrics.length) * 100;

    if (avgResponseTime > this.thresholds.maxResponseTime) {
      recommendations.push('Consider optimizing response times by reducing prompt complexity');
    }

    if (avgTokens > this.thresholds.maxTokenUsage) {
      recommendations.push('Focus on token reduction through better prompt engineering');
    }

    if (cacheHitRate < 30) {
      recommendations.push('Improve caching strategy to reduce redundant optimizations');
    }

    if (errorRate > 10) {
      recommendations.push('Investigate and fix recurring optimization errors');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable thresholds');
    }

    return recommendations;
  }
}

module.exports = PerformanceTracker;