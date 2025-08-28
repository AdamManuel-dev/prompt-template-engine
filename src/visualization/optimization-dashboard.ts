/**
 * @fileoverview Optimization dashboard for quality scoring and performance metrics visualization
 * @lastmodified 2025-08-26T10:30:00Z
 *
 * Features: Interactive dashboards, quality score visualization, performance charts, real-time monitoring
 * Main APIs: OptimizationDashboard class for comprehensive metrics display
 * Constraints: Terminal-based with web fallback, configurable display options
 * Patterns: Dashboard pattern, real-time updates, responsive visualization
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { UIComponents } from '../../plugins/promptwizard/ui/components';
import {
  OptimizationTier,
  QUALITY_TIERS,
  PERFORMANCE_THRESHOLDS,
} from '../marketplace/optimization-features';

/**
 * Dashboard configuration options
 */
export interface DashboardConfig {
  /** Update interval in milliseconds */
  updateInterval: number;

  /** Auto-refresh enabled */
  autoRefresh: boolean;

  /** Maximum data points to display */
  maxDataPoints: number;

  /** Dashboard theme */
  theme: 'dark' | 'light' | 'auto';

  /** Display options */
  display: {
    showRealTimeMetrics: boolean;
    showHistoricalCharts: boolean;
    showQualityDistribution: boolean;
    showPerformanceMetrics: boolean;
    showRecommendations: boolean;
  };

  /** Chart configuration */
  charts: {
    height: number;
    width: number;
    colors: {
      primary: string;
      secondary: string;
      success: string;
      warning: string;
      error: string;
    };
  };
}

/**
 * Dashboard metrics data structure
 */
export interface DashboardMetrics {
  /** Overall statistics */
  summary: {
    totalTemplates: number;
    optimizedTemplates: number;
    averageQualityScore: number;
    optimizationRate: number;
  };

  /** Quality score distribution */
  qualityDistribution: Record<OptimizationTier, number>;

  /** Performance metrics */
  performance: {
    averageResponseTime: number;
    averageTokenEfficiency: number;
    averageCostPerRequest: number;
    cacheHitRate: number;
    successRate: number;
  };

  /** Time-series data */
  timeSeries: {
    timestamps: string[];
    qualityScores: number[];
    responseTime: number[];
    tokenUsage: number[];
    optimizationCount: number[];
  };

  /** Top performers */
  topPerformers: Array<{
    templateId: string;
    name: string;
    qualityScore: number;
    performanceScore: number;
    optimizationLevel: string;
  }>;

  /** Recent activity */
  recentActivity: Array<{
    timestamp: string;
    action: string;
    templateId: string;
    details: string;
    status: 'success' | 'warning' | 'error';
  }>;

  /** Recommendations */
  recommendations: Array<{
    type: 'quality' | 'performance' | 'optimization';
    priority: 'high' | 'medium' | 'low';
    message: string;
    action: string;
  }>;
}

/**
 * Chart data structure
 */
export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color: string;
    backgroundColor?: string;
    borderColor?: string;
    fill?: boolean;
  }>;
}

/**
 * Main optimization dashboard class
 */
export class OptimizationDashboard extends EventEmitter {
  private config: DashboardConfig;

  private uiComponents: UIComponents;

  private metricsData: DashboardMetrics | null = null;

  private updateTimer: ReturnType<typeof setTimeout> | null = null;

  private isRunning: boolean = false;

  constructor(config: Partial<DashboardConfig> = {}) {
    super();

    this.config = {
      updateInterval: 5000, // 5 seconds
      autoRefresh: true,
      maxDataPoints: 100,
      theme: 'auto',
      display: {
        showRealTimeMetrics: true,
        showHistoricalCharts: true,
        showQualityDistribution: true,
        showPerformanceMetrics: true,
        showRecommendations: true,
      },
      charts: {
        height: 20,
        width: 80,
        colors: {
          primary: '#3b82f6',
          secondary: '#6b7280',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
        },
      },
      ...config,
    };

    this.uiComponents = new UIComponents(this.config);
  }

  /**
   * Initialize the dashboard
   * @returns Promise resolving when dashboard is initialized
   */
  async initialize(): Promise<void> {
    try {
      await this.uiComponents.initialize();

      // Load initial data
      await this.refreshMetrics();

      logger.info('Optimization dashboard initialized');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize optimization dashboard:', error);
      throw error;
    }
  }

  /**
   * Start the dashboard with auto-refresh
   * @returns Promise resolving when dashboard starts
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start auto-refresh if enabled
    if (this.config.autoRefresh) {
      this.startAutoRefresh();
    }

    // Render initial dashboard
    await this.render();

    logger.info('Optimization dashboard started');
    this.emit('started');
  }

  /**
   * Stop the dashboard
   * @returns Promise resolving when dashboard stops
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.stopAutoRefresh();

    logger.info('Optimization dashboard stopped');
    this.emit('stopped');
  }

  /**
   * Refresh metrics data
   * @returns Promise resolving when metrics are refreshed
   */
  async refreshMetrics(): Promise<void> {
    try {
      // In a real implementation, this would fetch data from:
      // - Plugin registry
      // - Optimization cache
      // - Performance tracker
      // - Analytics system

      this.metricsData = await this.fetchMetricsData();

      if (this.isRunning) {
        await this.render();
      }

      this.emit('metricsUpdated', this.metricsData);
    } catch (error) {
      logger.error('Failed to refresh metrics:', error);
      this.emit('error', error);
    }
  }

  /**
   * Render the complete dashboard
   * @returns Promise resolving when dashboard is rendered
   */
  async render(): Promise<void> {
    if (!this.metricsData) {
      console.log('No metrics data available');
      return;
    }

    try {
      // Clear screen and move cursor to top
      console.log(this.uiComponents.clearScreen());
      console.log(this.uiComponents.moveCursor(1, 1));

      // Render dashboard components
      await this.renderHeader();
      await this.renderSummaryCards();

      if (this.config.display.showQualityDistribution) {
        await this.renderQualityDistribution();
      }

      if (this.config.display.showPerformanceMetrics) {
        await this.renderPerformanceMetrics();
      }

      if (this.config.display.showHistoricalCharts) {
        await this.renderHistoricalCharts();
      }

      if (this.config.display.showRecommendations) {
        await this.renderRecommendations();
      }

      await this.renderFooter();
    } catch (error) {
      logger.error('Failed to render dashboard:', error);
    }
  }

  /**
   * Export dashboard data
   * @param format - Export format
   * @param filePath - Optional file path
   * @returns Promise resolving to export file path
   */
  async exportData(
    filePath?: string,
    format: 'json' | 'csv' | 'html' = 'json'
  ): Promise<string> {
    if (!this.metricsData) {
      throw new Error('No metrics data to export');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = `./exports/optimization-dashboard-${timestamp}.${format}`;
    const outputPath = filePath || defaultPath;

    try {
      const fs = await import('fs');
      const path = await import('path');

      // Ensure export directory exists
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

      if (format === 'json') {
        const exportData = {
          exportedAt: new Date().toISOString(),
          config: this.config,
          metrics: this.metricsData,
        };
        await fs.promises.writeFile(
          outputPath,
          JSON.stringify(exportData, null, 2)
        );
      } else if (format === 'html') {
        const htmlContent = await this.generateHTMLReport();
        await fs.promises.writeFile(outputPath, htmlContent);
      } else if (format === 'csv') {
        const csvContent = this.generateCSVReport();
        await fs.promises.writeFile(outputPath, csvContent);
      }

      logger.info(`Dashboard data exported to ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error('Failed to export dashboard data:', error);
      throw error;
    }
  }

  // Private methods

  /**
   * Start auto-refresh timer
   * @private
   */
  private startAutoRefresh(): void {
    if (this.updateTimer) {
      return;
    }

    this.updateTimer = setInterval(async () => {
      await this.refreshMetrics();
    }, this.config.updateInterval);
  }

  /**
   * Stop auto-refresh timer
   * @private
   */
  private stopAutoRefresh(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Fetch metrics data from various sources
   * @private
   */
  private async fetchMetricsData(): Promise<DashboardMetrics> {
    // This would integrate with actual data sources
    // For now, return mock data
    return {
      summary: {
        totalTemplates: 150,
        optimizedTemplates: 95,
        averageQualityScore: 78.5,
        optimizationRate: 63.3,
      },
      qualityDistribution: {
        [OptimizationTier.PREMIUM]: 8,
        [OptimizationTier.ADVANCED]: 22,
        [OptimizationTier.STANDARD]: 35,
        [OptimizationTier.BASIC]: 25,
        [OptimizationTier.UNOPTIMIZED]: 60,
      },
      performance: {
        averageResponseTime: 1250,
        averageTokenEfficiency: 82.3,
        averageCostPerRequest: 0.035,
        cacheHitRate: 67.8,
        successRate: 94.2,
      },
      timeSeries: {
        timestamps: this.generateTimeStamps(24),
        qualityScores: this.generateMockData(24, 70, 85),
        responseTime: this.generateMockData(24, 1000, 2000),
        tokenUsage: this.generateMockData(24, 200, 800),
        optimizationCount: this.generateMockData(24, 5, 25),
      },
      topPerformers: [
        {
          templateId: 'template-001',
          name: 'Code Review Assistant',
          qualityScore: 92.5,
          performanceScore: 88.3,
          optimizationLevel: 'advanced',
        },
        {
          templateId: 'template-002',
          name: 'Bug Report Generator',
          qualityScore: 89.2,
          performanceScore: 85.7,
          optimizationLevel: 'standard',
        },
        {
          templateId: 'template-003',
          name: 'API Documentation',
          qualityScore: 87.8,
          performanceScore: 82.1,
          optimizationLevel: 'advanced',
        },
      ],
      recentActivity: [
        {
          timestamp: new Date(Date.now() - 300000).toISOString(),
          action: 'Template Optimized',
          templateId: 'template-045',
          details: 'Quality score improved from 65.2 to 78.9',
          status: 'success',
        },
        {
          timestamp: new Date(Date.now() - 600000).toISOString(),
          action: 'Performance Alert',
          templateId: 'template-032',
          details: 'Response time exceeded threshold (3.2s)',
          status: 'warning',
        },
        {
          timestamp: new Date(Date.now() - 900000).toISOString(),
          action: 'Optimization Failed',
          templateId: 'template-018',
          details: 'Network timeout during optimization',
          status: 'error',
        },
      ],
      recommendations: [
        {
          type: 'performance',
          priority: 'high',
          message: '5 templates have response times >3s',
          action: 'Optimize slow templates',
        },
        {
          type: 'quality',
          priority: 'medium',
          message: '12 templates below quality threshold',
          action: 'Review and improve template quality',
        },
        {
          type: 'optimization',
          priority: 'low',
          message: 'Cache hit rate could be improved',
          action: 'Adjust caching strategy',
        },
      ],
    };
  }

  /**
   * Render dashboard header
   * @private
   */
  private async renderHeader(): Promise<void> {
    const header = this.uiComponents.renderHeader('Optimization Dashboard');
    console.log(header);

    // Show last update time
    const updateTime = new Date().toLocaleString();
    console.log(`\nLast Updated: ${updateTime}`);

    if (this.config.autoRefresh) {
      console.log(`Auto-refresh: ${this.config.updateInterval / 1000}s`);
    }

    console.log(`\n${'═'.repeat(80)}\n`);
  }

  /**
   * Render summary cards
   * @private
   */
  private async renderSummaryCards(): Promise<void> {
    if (!this.metricsData) return;

    const { summary } = this.metricsData;

    console.log('📊 Summary Metrics\n');

    // Create summary cards layout
    const cards = [
      {
        title: 'Total Templates',
        value: summary.totalTemplates.toString(),
        color: this.config.charts.colors.primary,
      },
      {
        title: 'Optimized',
        value: summary.optimizedTemplates.toString(),
        color: this.config.charts.colors.success,
      },
      {
        title: 'Avg Quality',
        value: `${summary.averageQualityScore.toFixed(1)}`,
        color: this.getQualityColor(summary.averageQualityScore),
      },
      {
        title: 'Optimization Rate',
        value: `${summary.optimizationRate.toFixed(1)}%`,
        color: this.config.charts.colors.secondary,
      },
    ];

    // Render cards in a row
    const cardWidth = 18;
    const spacing = 2;

    // Card headers
    let headerLine = '';
    let valueLine = '';
    let borderLine = '';

    cards.forEach((card, index) => {
      const padding = cardWidth - card.title.length;
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;

      headerLine += `┌${'─'.repeat(cardWidth - 2)}┐`;
      valueLine += `│${' '.repeat(leftPad)}${card.title}${' '.repeat(rightPad)}│`;
      borderLine += `└${'─'.repeat(cardWidth - 2)}┘`;

      if (index < cards.length - 1) {
        headerLine += ' '.repeat(spacing);
        valueLine += ' '.repeat(spacing);
        borderLine += ' '.repeat(spacing);
      }
    });

    console.log(headerLine);
    console.log(valueLine);

    // Value line
    let valueDisplayLine = '';
    cards.forEach((card, index) => {
      const padding = cardWidth - card.value.length;
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;

      valueDisplayLine += `│${' '.repeat(leftPad)}${card.value}${' '.repeat(rightPad)}│`;

      if (index < cards.length - 1) {
        valueDisplayLine += ' '.repeat(spacing);
      }
    });

    console.log(valueDisplayLine);
    console.log(borderLine);
    console.log();
  }

  /**
   * Render quality distribution chart
   * @private
   */
  private async renderQualityDistribution(): Promise<void> {
    if (!this.metricsData) return;

    console.log('🎯 Quality Score Distribution\n');

    const { qualityDistribution } = this.metricsData;
    const total = Object.values(qualityDistribution).reduce(
      (sum, count) => sum + count,
      0
    );

    // Create horizontal bar chart
    Object.entries(qualityDistribution).forEach(([tier, count]) => {
      const tierConfig = QUALITY_TIERS[tier as OptimizationTier];
      const percentage = total > 0 ? (count / total) * 100 : 0;
      const barLength = Math.round(percentage / 2); // Scale to fit console

      const bar = '█'.repeat(Math.max(1, barLength));
      const label = `${tierConfig.icon} ${tierConfig.label}`.padEnd(20);
      const stats = `${count.toString().padStart(3)} (${percentage.toFixed(1)}%)`;

      console.log(`${label} ${bar} ${stats}`);
    });

    console.log();
  }

  /**
   * Render performance metrics
   * @private
   */
  private async renderPerformanceMetrics(): Promise<void> {
    if (!this.metricsData) return;

    console.log('⚡ Performance Metrics\n');

    const { performance } = this.metricsData;

    const metrics = [
      {
        label: 'Response Time',
        value: `${performance.averageResponseTime}ms`,
        indicator: this.getPerformanceIndicator(
          performance.averageResponseTime,
          'responseTime'
        ),
      },
      {
        label: 'Token Efficiency',
        value: `${performance.averageTokenEfficiency.toFixed(1)}%`,
        indicator: this.getPerformanceIndicator(
          performance.averageTokenEfficiency,
          'tokenEfficiency'
        ),
      },
      {
        label: 'Cost per Request',
        value: `$${performance.averageCostPerRequest.toFixed(4)}`,
        indicator: this.getPerformanceIndicator(
          performance.averageCostPerRequest,
          'cost'
        ),
      },
      {
        label: 'Cache Hit Rate',
        value: `${performance.cacheHitRate.toFixed(1)}%`,
        indicator:
          performance.cacheHitRate >= 60
            ? '🟢'
            : performance.cacheHitRate >= 30
              ? '🟡'
              : '🔴',
      },
      {
        label: 'Success Rate',
        value: `${performance.successRate.toFixed(1)}%`,
        indicator:
          performance.successRate >= 95
            ? '🟢'
            : performance.successRate >= 85
              ? '🟡'
              : '🔴',
      },
    ];

    metrics.forEach(metric => {
      console.log(
        `${metric.indicator} ${metric.label.padEnd(20)} ${metric.value}`
      );
    });

    console.log();
  }

  /**
   * Render historical charts
   * @private
   */
  private async renderHistoricalCharts(): Promise<void> {
    if (!this.metricsData) return;

    console.log('📈 Historical Trends\n');

    const { timeSeries } = this.metricsData;

    // Render quality score trend
    console.log('Quality Scores (24h):');
    console.log(this.uiComponents.renderMiniChart(timeSeries.qualityScores));

    // Render response time trend
    console.log('Response Times (24h):');
    console.log(this.uiComponents.renderMiniChart(timeSeries.responseTime));

    console.log();
  }

  /**
   * Render recommendations
   * @private
   */
  private async renderRecommendations(): Promise<void> {
    if (!this.metricsData) return;

    console.log('💡 Recommendations\n');

    const { recommendations } = this.metricsData;

    recommendations.forEach(rec => {
      const priorityIcon =
        rec.priority === 'high'
          ? '🔴'
          : rec.priority === 'medium'
            ? '🟡'
            : '🟢';
      const typeIcon =
        rec.type === 'performance'
          ? '⚡'
          : rec.type === 'quality'
            ? '🎯'
            : '🔧';

      console.log(`${priorityIcon} ${typeIcon} ${rec.message}`);
      console.log(`   → ${rec.action}\n`);
    });
  }

  /**
   * Render footer
   * @private
   */
  private async renderFooter(): Promise<void> {
    console.log('═'.repeat(80));
    console.log('Press Ctrl+C to exit | R to refresh | E to export');
  }

  /**
   * Generate HTML report
   * @private
   */
  private async generateHTMLReport(): Promise<string> {
    if (!this.metricsData) return '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Optimization Dashboard Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .metric { display: flex; justify-content: space-between; margin: 8px 0; }
        .quality-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    </style>
</head>
<body>
    <h1>Optimization Dashboard Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <div class="card">
        <h2>Summary</h2>
        <div class="metric">
            <span>Total Templates:</span>
            <span>${this.metricsData.summary.totalTemplates}</span>
        </div>
        <div class="metric">
            <span>Optimized Templates:</span>
            <span>${this.metricsData.summary.optimizedTemplates}</span>
        </div>
        <div class="metric">
            <span>Average Quality Score:</span>
            <span>${this.metricsData.summary.averageQualityScore.toFixed(1)}</span>
        </div>
        <div class="metric">
            <span>Optimization Rate:</span>
            <span>${this.metricsData.summary.optimizationRate.toFixed(1)}%</span>
        </div>
    </div>

    <div class="card">
        <h2>Top Performers</h2>
        <table>
            <tr>
                <th>Template</th>
                <th>Quality Score</th>
                <th>Performance Score</th>
                <th>Level</th>
            </tr>
            ${this.metricsData.topPerformers
              .map(
                template => `
            <tr>
                <td>${template.name}</td>
                <td>${template.qualityScore.toFixed(1)}</td>
                <td>${template.performanceScore.toFixed(1)}</td>
                <td>${template.optimizationLevel}</td>
            </tr>
            `
              )
              .join('')}
        </table>
    </div>

    <div class="card">
        <h2>Recommendations</h2>
        ${this.metricsData.recommendations
          .map(
            rec => `
        <div class="metric">
            <strong>${rec.type.toUpperCase()}</strong> (${rec.priority}): ${rec.message}
            <br><em>→ ${rec.action}</em>
        </div>
        `
          )
          .join('')}
    </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate CSV report
   * @private
   */
  private generateCSVReport(): string {
    if (!this.metricsData) return '';

    const lines = [
      'Metric,Value',
      `Total Templates,${this.metricsData.summary.totalTemplates}`,
      `Optimized Templates,${this.metricsData.summary.optimizedTemplates}`,
      `Average Quality Score,${this.metricsData.summary.averageQualityScore}`,
      `Optimization Rate,${this.metricsData.summary.optimizationRate}%`,
      '',
      'Top Performers',
      'Template,Quality Score,Performance Score,Level',
      ...this.metricsData.topPerformers.map(
        t =>
          `${t.name},${t.qualityScore},${t.performanceScore},${t.optimizationLevel}`
      ),
    ];

    return lines.join('\n');
  }

  /**
   * Get quality color based on score
   * @private
   */
  private getQualityColor(score: number): string {
    if (score >= 90) return this.config.charts.colors.success;
    if (score >= 75) return this.config.charts.colors.warning;
    return this.config.charts.colors.error;
  }

  /**
   * Get performance indicator
   * @private
   */
  private getPerformanceIndicator(
    value: number,
    type: 'responseTime' | 'tokenEfficiency' | 'cost'
  ): string {
    const thresholds = PERFORMANCE_THRESHOLDS;
    let level = 'poor';

    switch (type) {
      case 'responseTime':
        if (value < thresholds.responseTime.excellent) level = 'excellent';
        else if (value < thresholds.responseTime.good) level = 'good';
        else if (value < thresholds.responseTime.fair) level = 'fair';
        break;
      case 'tokenEfficiency':
        if (value >= thresholds.tokenEfficiency.excellent) level = 'excellent';
        else if (value >= thresholds.tokenEfficiency.good) level = 'good';
        else if (value >= thresholds.tokenEfficiency.fair) level = 'fair';
        break;
      case 'cost':
        if (value < thresholds.costEffectiveness.excellent) level = 'excellent';
        else if (value < thresholds.costEffectiveness.good) level = 'good';
        else if (value < thresholds.costEffectiveness.fair) level = 'fair';
        break;
      default:
        level = 'poor';
        break;
    }

    const indicators = {
      excellent: '🟢',
      good: '🟡',
      fair: '🟠',
      poor: '🔴',
    };

    return indicators[level as keyof typeof indicators];
  }

  /**
   * Generate timestamps for time series
   * @private
   */
  private generateTimeStamps(count: number): string[] {
    const timestamps = [];
    const now = Date.now();
    const interval = 60 * 60 * 1000; // 1 hour

    for (let i = count - 1; i >= 0; i--) {
      const time = new Date(now - i * interval);
      timestamps.push(time.toISOString());
    }

    return timestamps;
  }

  /**
   * Generate mock data for charts
   * @private
   */
  private generateMockData(count: number, min: number, max: number): number[] {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push(min + Math.random() * (max - min));
    }
    return data;
  }
}

/**
 * Create and initialize optimization dashboard
 * @param config - Dashboard configuration
 * @returns Initialized dashboard instance
 */
export async function createOptimizationDashboard(
  config: Partial<DashboardConfig> = {}
): Promise<OptimizationDashboard> {
  const dashboard = new OptimizationDashboard(config);
  await dashboard.initialize();
  return dashboard;
}
