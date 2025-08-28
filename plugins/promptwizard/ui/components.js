/**
 * @fileoverview UI Components for PromptWizard Plugin
 * @lastmodified 2025-08-26T10:30:00Z
 *
 * Features: Configuration UI, quality score visualization, performance dashboards
 * Main APIs: ConfigPanel, QualityScoreCard, PerformanceDashboard, OptimizationStatus
 * Constraints: CLI-based and terminal-friendly components with fallback
 * Patterns: Component architecture, responsive design, accessibility
 */

class UIComponents {
  constructor(config = {}) {
    this.config = config;
    this.themes = {
      default: {
        primary: '\x1b[36m',    // Cyan
        secondary: '\x1b[35m',  // Magenta
        success: '\x1b[32m',    // Green
        warning: '\x1b[33m',    // Yellow
        error: '\x1b[31m',      // Red
        info: '\x1b[34m',       // Blue
        reset: '\x1b[0m',       // Reset
        bold: '\x1b[1m',        // Bold
        dim: '\x1b[2m'          // Dim
      }
    };
    this.currentTheme = this.themes.default;
  }

  /**
   * Initialize UI components
   * @returns {Promise<void>}
   */
  async initialize() {
    // Setup terminal capabilities
    this.setupTerminal();
    
    // Initialize component state
    this.componentState = {
      configPanel: { visible: false },
      dashboard: { visible: false, data: null },
      notifications: []
    };
  }

  /**
   * Setup terminal capabilities and detection
   * @private
   */
  setupTerminal() {
    this.terminalInfo = {
      supportsColor: process.stdout.isTTY || process.env.FORCE_COLOR,
      width: process.stdout.columns || 80,
      height: process.stdout.rows || 24,
      supportsUnicode: process.env.LANG && process.env.LANG.includes('UTF-8')
    };
  }

  /**
   * Render configuration panel
   * @param {Object} currentConfig - Current plugin configuration
   * @returns {string} Rendered configuration panel
   */
  renderConfigPanel(currentConfig = {}) {
    const { primary, secondary, reset, bold } = this.currentTheme;
    
    let output = '';
    output += this.renderHeader('PromptWizard Configuration');
    output += '\n';

    // Optimization Settings
    output += `${bold}${primary}Optimization Settings${reset}\n`;
    output += `  Enabled: ${this.renderToggle(currentConfig.enabled)}\n`;
    output += `  Level: ${this.renderSelect(currentConfig.optimizationLevel, ['basic', 'standard', 'advanced', 'aggressive'])}\n`;
    output += `  Real-time Feedback: ${this.renderToggle(currentConfig.realTimeFeedback)}\n`;
    output += `  Quality Threshold: ${this.renderSlider(currentConfig.qualityThreshold, 0, 100)}\n`;
    output += '\n';

    // Performance Metrics
    output += `${bold}${secondary}Performance Metrics${reset}\n`;
    const perfMetrics = currentConfig.performanceMetrics || {};
    output += `  Track Token Usage: ${this.renderToggle(perfMetrics.trackTokenUsage)}\n`;
    output += `  Track Response Time: ${this.renderToggle(perfMetrics.trackResponseTime)}\n`;
    output += `  Track Cost Estimation: ${this.renderToggle(perfMetrics.trackCostEstimation)}\n`;
    output += '\n';

    // Marketplace Integration
    output += `${bold}${primary}Marketplace Integration${reset}\n`;
    const marketplace = currentConfig.marketplaceIntegration || {};
    output += `  Show Optimized Badge: ${this.renderToggle(marketplace.showOptimizedBadge)}\n`;
    output += `  Display Quality Score: ${this.renderToggle(marketplace.displayQualityScore)}\n`;
    output += `  Enable Performance Filters: ${this.renderToggle(marketplace.enablePerformanceFilters)}\n`;
    output += '\n';

    output += this.renderFooter('Use arrow keys to navigate, Enter to edit, Esc to exit');
    
    return output;
  }

  /**
   * Render quality score card
   * @param {number} score - Quality score (0-100)
   * @param {Object} analysis - Quality analysis data
   * @returns {string} Rendered quality score card
   */
  renderQualityScoreCard(score, analysis = {}) {
    const { success, warning, error, reset, bold } = this.currentTheme;
    
    let output = '';
    output += this.renderBox('Quality Score', () => {
      let content = '';
      
      // Score display
      const scoreColor = score >= 90 ? success : score >= 75 ? warning : error;
      content += `${bold}${scoreColor}${score.toFixed(1)}/100${reset}\n`;
      
      // Score visualization
      content += this.renderProgressBar(score, 100, 20) + '\n';
      
      // Quality category
      const category = this.getQualityCategory(score);
      content += `Category: ${bold}${category}${reset}\n`;
      
      // Strengths and weaknesses
      if (analysis.strengths && analysis.strengths.length > 0) {
        content += `\n${success}Strengths:${reset}\n`;
        analysis.strengths.slice(0, 3).forEach(strength => {
          content += `  ${this.renderIcon('✓')} ${strength}\n`;
        });
      }
      
      if (analysis.weaknesses && analysis.weaknesses.length > 0) {
        content += `\n${warning}Areas for Improvement:${reset}\n`;
        analysis.weaknesses.slice(0, 3).forEach(weakness => {
          content += `  ${this.renderIcon('!')} ${weakness}\n`;
        });
      }
      
      return content.trim();
    });
    
    return output;
  }

  /**
   * Render performance dashboard
   * @param {Object} performanceData - Performance metrics data
   * @returns {string} Rendered performance dashboard
   */
  renderPerformanceDashboard(performanceData) {
    const { primary, secondary, success, info, reset, bold } = this.currentTheme;
    
    let output = '';
    output += this.renderHeader('Performance Dashboard');
    output += '\n';

    // Summary metrics
    if (performanceData.summary) {
      const summary = performanceData.summary;
      output += `${bold}${primary}Summary (Last 24h)${reset}\n`;
      output += `  Total Requests: ${bold}${summary.totalRequests}${reset}\n`;
      output += `  Success Rate: ${bold}${success}${summary.successRate?.toFixed(1)}%${reset}\n`;
      output += `  Avg Response Time: ${bold}${summary.averageResponseTime?.toFixed(0)}ms${reset}\n`;
      output += `  Total Tokens Processed: ${bold}${summary.totalTokens?.toLocaleString()}${reset}\n`;
      output += '\n';
    }

    // Performance trends
    if (performanceData.trends) {
      output += `${bold}${secondary}Trends${reset}\n`;
      const trends = performanceData.trends;
      output += `  Response Time: ${this.renderTrend(trends.responseTime)}\n`;
      output += `  Token Usage: ${this.renderTrend(trends.tokenUsage)}\n`;
      output += `  Cost: ${this.renderTrend(trends.cost)}\n`;
      output += '\n';
    }

    // Real-time metrics chart
    if (performanceData.realtimeMetrics) {
      output += `${bold}${info}Real-time Metrics (Last Hour)${reset}\n`;
      output += this.renderMiniChart(performanceData.realtimeMetrics);
      output += '\n';
    }

    // Recommendations
    if (performanceData.recommendations && performanceData.recommendations.length > 0) {
      output += `${bold}${primary}Recommendations${reset}\n`;
      performanceData.recommendations.slice(0, 3).forEach(rec => {
        output += `  ${this.renderIcon('💡')} ${rec}\n`;
      });
    }

    return output;
  }

  /**
   * Render optimization status indicator
   * @param {string} status - Optimization status
   * @param {Object} progress - Progress information
   * @returns {string} Rendered status indicator
   */
  renderOptimizationStatus(status, progress = {}) {
    const { primary, success, warning, error, reset, bold } = this.currentTheme;
    
    let output = '';
    
    // Status indicator
    switch (status) {
      case 'idle':
        output += `${bold}Status:${reset} Ready for optimization`;
        break;
      case 'analyzing':
        output += `${warning}Status:${reset} Analyzing template... ${this.renderSpinner()}`;
        break;
      case 'optimizing':
        output += `${primary}Status:${reset} Optimizing... ${this.renderProgressBar(progress.percent || 0, 100, 10)}`;
        break;
      case 'completed':
        output += `${success}Status:${reset} Optimization completed ${this.renderIcon('✓')}`;
        break;
      case 'error':
        output += `${error}Status:${reset} Optimization failed ${this.renderIcon('✗')}`;
        break;
      default:
        output += `Status: ${status}`;
    }
    
    // Progress details
    if (progress.stage) {
      output += `\n${progress.stage}`;
    }
    
    if (progress.eta) {
      output += ` (ETA: ${progress.eta})`;
    }
    
    return output;
  }

  /**
   * Render metrics comparison table
   * @param {Object} beforeMetrics - Metrics before optimization
   * @param {Object} afterMetrics - Metrics after optimization
   * @returns {string} Rendered comparison table
   */
  renderMetricsComparison(beforeMetrics, afterMetrics) {
    const { success, warning, primary, reset, bold } = this.currentTheme;
    
    let output = '';
    output += this.renderHeader('Optimization Results');
    output += '\n';

    const metrics = [
      { label: 'Quality Score', before: beforeMetrics.qualityScore, after: afterMetrics.qualityScore, unit: '/100', higher: true },
      { label: 'Token Count', before: beforeMetrics.tokenCount, after: afterMetrics.tokenCount, unit: '', higher: false },
      { label: 'Estimated Cost', before: beforeMetrics.estimatedCost, after: afterMetrics.estimatedCost, unit: '$', higher: false },
      { label: 'Readability', before: beforeMetrics.readability, after: afterMetrics.readability, unit: '/100', higher: true }
    ];

    // Table headers
    output += `${bold}${'Metric'.padEnd(15)} ${'Before'.padEnd(12)} ${'After'.padEnd(12)} ${'Change'.padEnd(12)}${reset}\n`;
    output += '─'.repeat(55) + '\n';

    metrics.forEach(metric => {
      if (metric.before !== undefined && metric.after !== undefined) {
        const change = metric.after - metric.before;
        const changePercent = metric.before !== 0 ? (change / metric.before) * 100 : 0;
        const isImprovement = metric.higher ? change > 0 : change < 0;
        
        const changeColor = isImprovement ? success : change === 0 ? primary : warning;
        const changeSymbol = change > 0 ? '+' : '';
        
        output += `${metric.label.padEnd(15)} `;
        output += `${metric.before.toFixed(metric.label.includes('Cost') ? 4 : 1)}${metric.unit}`.padEnd(12);
        output += `${metric.after.toFixed(metric.label.includes('Cost') ? 4 : 1)}${metric.unit}`.padEnd(12);
        output += `${changeColor}${changeSymbol}${change.toFixed(metric.label.includes('Cost') ? 4 : 1)} (${changeSymbol}${changePercent.toFixed(1)}%)${reset}\n`;
      }
    });

    return output;
  }

  /**
   * Render notification toast
   * @param {Object} notification - Notification data
   * @returns {string} Rendered notification
   */
  renderNotification(notification) {
    const { success, warning, error, info, reset, bold } = this.currentTheme;
    
    let color = info;
    let icon = 'ℹ';
    
    switch (notification.type) {
      case 'success':
        color = success;
        icon = '✓';
        break;
      case 'warning':
        color = warning;
        icon = '⚠';
        break;
      case 'error':
        color = error;
        icon = '✗';
        break;
    }
    
    return `${color}${bold}${this.renderIcon(icon)} ${notification.title}${reset}\n${notification.message}`;
  }

  // Utility rendering methods

  /**
   * Render a header with styling
   * @param {string} title - Header title
   * @returns {string} Rendered header
   */
  renderHeader(title) {
    const { primary, reset, bold } = this.currentTheme;
    const width = Math.min(this.terminalInfo.width, 60);
    const padding = Math.max(0, Math.floor((width - title.length - 4) / 2));
    
    let output = '';
    output += '┌' + '─'.repeat(width - 2) + '┐\n';
    output += '│' + ' '.repeat(padding) + `${bold}${primary}${title}${reset}` + ' '.repeat(width - title.length - padding - 2) + '│\n';
    output += '└' + '─'.repeat(width - 2) + '┘';
    
    return output;
  }

  /**
   * Render a footer with styling
   * @param {string} message - Footer message
   * @returns {string} Rendered footer
   */
  renderFooter(message) {
    const { dim, reset } = this.currentTheme;
    return `\n${dim}${message}${reset}`;
  }

  /**
   * Render a box with content
   * @param {string} title - Box title
   * @param {Function} contentFn - Function that returns box content
   * @returns {string} Rendered box
   */
  renderBox(title, contentFn) {
    const { primary, reset, bold } = this.currentTheme;
    const content = contentFn();
    const lines = content.split('\n');
    const maxWidth = Math.max(title.length + 4, ...lines.map(line => this.stripAnsi(line).length + 4));
    const width = Math.min(maxWidth, this.terminalInfo.width - 4);
    
    let output = '';
    output += '┌─' + `${bold}${primary} ${title} ${reset}`.padEnd(width - 4, '─') + '─┐\n';
    
    lines.forEach(line => {
      const strippedLine = this.stripAnsi(line);
      const padding = Math.max(0, width - strippedLine.length - 4);
      output += `│ ${line}${' '.repeat(padding)} │\n`;
    });
    
    output += '└' + '─'.repeat(width - 2) + '┘';
    
    return output;
  }

  /**
   * Render a toggle control
   * @param {boolean} value - Toggle value
   * @returns {string} Rendered toggle
   */
  renderToggle(value) {
    const { success, error, reset } = this.currentTheme;
    const color = value ? success : error;
    const symbol = value ? '●' : '○';
    const text = value ? 'ON' : 'OFF';
    
    return `${color}${symbol} ${text}${reset}`;
  }

  /**
   * Render a select control
   * @param {string} value - Current value
   * @param {Array<string>} options - Available options
   * @returns {string} Rendered select
   */
  renderSelect(value, options) {
    const { primary, dim, reset } = this.currentTheme;
    const index = options.indexOf(value);
    const displayOptions = options.map((opt, i) => 
      i === index ? `${primary}[${opt}]${reset}` : `${dim}${opt}${reset}`
    ).join(' ');
    
    return displayOptions;
  }

  /**
   * Render a slider control
   * @param {number} value - Current value
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {string} Rendered slider
   */
  renderSlider(value, min, max) {
    const { primary, dim, reset } = this.currentTheme;
    const normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const sliderWidth = 20;
    const filledWidth = Math.round(normalizedValue * sliderWidth);
    
    const filled = '█'.repeat(filledWidth);
    const empty = '░'.repeat(sliderWidth - filledWidth);
    
    return `${primary}${filled}${dim}${empty}${reset} ${value}`;
  }

  /**
   * Render a progress bar
   * @param {number} value - Current value
   * @param {number} max - Maximum value
   * @param {number} width - Bar width
   * @returns {string} Rendered progress bar
   */
  renderProgressBar(value, max, width = 20) {
    const { success, dim, reset } = this.currentTheme;
    const percent = Math.max(0, Math.min(1, value / max));
    const filledWidth = Math.round(percent * width);
    
    const filled = '█'.repeat(filledWidth);
    const empty = '░'.repeat(width - filledWidth);
    
    return `${success}${filled}${dim}${empty}${reset} ${(percent * 100).toFixed(1)}%`;
  }

  /**
   * Render an icon with unicode fallback
   * @param {string} icon - Icon character
   * @returns {string} Rendered icon
   */
  renderIcon(icon) {
    if (!this.terminalInfo.supportsUnicode) {
      const fallbacks = {
        '✓': '[OK]',
        '✗': '[X]',
        '!': '[!]',
        '💡': '[TIP]',
        '⚠': '[WARN]',
        'ℹ': '[INFO]',
        '●': '*',
        '○': 'o'
      };
      return fallbacks[icon] || icon;
    }
    
    return icon;
  }

  /**
   * Render a spinner animation
   * @returns {string} Rendered spinner
   */
  renderSpinner() {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const frame = frames[Date.now() % frames.length] || '|';
    
    return this.renderIcon(frame);
  }

  /**
   * Render trend indicator
   * @param {string} trend - Trend direction
   * @returns {string} Rendered trend
   */
  renderTrend(trend) {
    const { success, warning, error, info, reset } = this.currentTheme;
    
    switch (trend) {
      case 'improving':
      case 'decreasing': // For metrics where lower is better
        return `${success}↓ Improving${reset}`;
      case 'degrading':
      case 'increasing': // For metrics where higher is worse
        return `${error}↑ Degrading${reset}`;
      case 'stable':
        return `${info}→ Stable${reset}`;
      default:
        return `${warning}? ${trend}${reset}`;
    }
  }

  /**
   * Render mini chart for metrics visualization
   * @param {Array<number>} data - Chart data points
   * @returns {string} Rendered mini chart
   */
  renderMiniChart(data) {
    if (!data || data.length === 0) return 'No data available';
    
    const { primary, dim, reset } = this.currentTheme;
    const height = 5;
    const width = Math.min(data.length, 40);
    const normalizedData = this.normalizeData(data.slice(-width), height);
    
    let output = '';
    for (let row = height - 1; row >= 0; row--) {
      for (let col = 0; col < width; col++) {
        if (normalizedData[col] > row) {
          output += `${primary}▆${reset}`;
        } else {
          output += `${dim}░${reset}`;
        }
      }
      output += '\n';
    }
    
    return output.trim();
  }

  /**
   * Get quality category label
   * @param {number} score - Quality score
   * @returns {string} Category label
   * @private
   */
  getQualityCategory(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  }

  /**
   * Strip ANSI escape codes from string
   * @param {string} str - String with ANSI codes
   * @returns {string} Clean string
   * @private
   */
  stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Normalize data for chart rendering
   * @param {Array<number>} data - Raw data
   * @param {number} maxHeight - Maximum chart height
   * @returns {Array<number>} Normalized data
   * @private
   */
  normalizeData(data, maxHeight) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    return data.map(value => 
      Math.floor(((value - min) / range) * (maxHeight - 1))
    );
  }

  /**
   * Clear screen (if supported)
   * @returns {string} Clear screen sequence
   */
  clearScreen() {
    return '\x1b[2J\x1b[0;0H';
  }

  /**
   * Move cursor to position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {string} Cursor move sequence
   */
  moveCursor(x, y) {
    return `\x1b[${y};${x}H`;
  }

  /**
   * Hide cursor
   * @returns {string} Hide cursor sequence
   */
  hideCursor() {
    return '\x1b[?25l';
  }

  /**
   * Show cursor
   * @returns {string} Show cursor sequence
   */
  showCursor() {
    return '\x1b[?25h';
  }
}

module.exports = UIComponents;