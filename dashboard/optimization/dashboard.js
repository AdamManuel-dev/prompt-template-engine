/**
 * PromptWizard Optimization Dashboard JavaScript
 * Real-time metrics visualization and monitoring
 */

class OptimizationDashboard {
    constructor() {
        this.apiBaseUrl = 'http://localhost:8000/api/v1';
        this.wsUrl = 'ws://localhost:8001/ws/dashboard';
        this.websocket = null;
        this.updateInterval = null;
        this.data = {
            metrics: {},
            activities: [],
            trends: {}
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initWebSocket();
        await this.loadInitialData();
        this.startPeriodicUpdates();
    }

    setupEventListeners() {
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadInitialData();
        });

        document.getElementById('timeRange').addEventListener('change', (e) => {
            this.loadInitialData(e.target.value);
        });
    }

    initWebSocket() {
        try {
            this.websocket = new WebSocket(this.wsUrl);
            
            this.websocket.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus(true);
            };

            this.websocket.onclose = () => {
                console.log('WebSocket disconnected');
                this.updateConnectionStatus(false);
                // Attempt reconnection after 5 seconds
                setTimeout(() => this.initWebSocket(), 5000);
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(false, 'warning');
            };

            this.websocket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            this.updateConnectionStatus(false, 'error');
        }
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'optimization_complete':
                this.addActivity({
                    type: 'success',
                    title: 'Optimization Completed',
                    description: `Template optimized with ${message.data.tokenReduction}% token reduction`,
                    timestamp: new Date()
                });
                this.updateMetrics();
                break;

            case 'optimization_failed':
                this.addActivity({
                    type: 'error',
                    title: 'Optimization Failed',
                    description: message.data.error || 'Unknown error',
                    timestamp: new Date()
                });
                break;

            case 'cached_result':
                this.addActivity({
                    type: 'cached',
                    title: 'Cached Result Served',
                    description: 'Optimization served from cache',
                    timestamp: new Date()
                });
                break;

            case 'metrics_update':
                this.data.metrics = { ...this.data.metrics, ...message.data };
                this.updateMetricsDisplay();
                break;
        }
    }

    async loadInitialData(timeRange = '24h') {
        try {
            // Show loading state
            this.showLoading(true);

            // Load metrics
            const metricsResponse = await this.fetchWithTimeout(`${this.apiBaseUrl}/analytics/metrics?range=${timeRange}`);
            if (metricsResponse.ok) {
                this.data.metrics = await metricsResponse.json();
            } else {
                // Use mock data for demonstration
                this.data.metrics = this.generateMockMetrics();
            }

            // Load activities
            const activitiesResponse = await this.fetchWithTimeout(`${this.apiBaseUrl}/analytics/activities?limit=20`);
            if (activitiesResponse.ok) {
                this.data.activities = await activitiesResponse.json();
            } else {
                // Use mock data for demonstration
                this.data.activities = this.generateMockActivities();
            }

            // Load trends
            const trendsResponse = await this.fetchWithTimeout(`${this.apiBaseUrl}/analytics/trends?range=${timeRange}`);
            if (trendsResponse.ok) {
                this.data.trends = await trendsResponse.json();
            } else {
                // Use mock data for demonstration
                this.data.trends = this.generateMockTrends();
            }

            this.updateDisplay();
            this.showLoading(false);

        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load dashboard data. Using demo data.');
            
            // Use mock data
            this.data.metrics = this.generateMockMetrics();
            this.data.activities = this.generateMockActivities();
            this.data.trends = this.generateMockTrends();
            
            this.updateDisplay();
            this.showLoading(false);
        }
    }

    async fetchWithTimeout(url, timeout = 5000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    updateDisplay() {
        this.updateMetricsDisplay();
        this.updateChartsDisplay();
        this.updateActivitiesDisplay();
    }

    updateMetricsDisplay() {
        const metrics = this.data.metrics;

        // Update metric values
        this.updateMetricValue('totalOptimizations', metrics.totalOptimizations || 0);
        this.updateMetricValue('successRate', `${((metrics.successfulOptimizations || 0) / (metrics.totalOptimizations || 1) * 100).toFixed(1)}%`);
        this.updateMetricValue('tokensSaved', this.formatNumber(metrics.totalTokensSaved || 0));
        this.updateMetricValue('costSavings', `$${(metrics.totalCostSaved || 0).toFixed(2)}`);
        this.updateMetricValue('avgProcessingTime', `${((metrics.averageProcessingTime || 0) / 1000).toFixed(1)}s`);
        this.updateMetricValue('cacheHitRate', `${((metrics.cachedOptimizations || 0) / (metrics.totalOptimizations || 1) * 100).toFixed(1)}%`);

        // Update changes (mock data for demonstration)
        this.updateMetricChange('totalOptimizationsChange', '+12%', 'positive');
        this.updateMetricChange('successRateChange', '+2.3%', 'positive');
        this.updateMetricChange('tokensSavedChange', '+450', 'positive');
        this.updateMetricChange('costSavingsChange', '+$12.45', 'positive');
        this.updateMetricChange('avgProcessingTimeChange', '-0.3s', 'positive');
        this.updateMetricChange('cacheHitRateChange', '+5.2%', 'positive');
    }

    updateMetricValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    updateMetricChange(elementId, value, type) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
            element.className = `metric-change ${type}`;
        }
    }

    updateChartsDisplay() {
        // For demonstration, we'll show placeholder text
        // In a real implementation, you would integrate with Chart.js or similar
        
        const optimizationsChart = document.getElementById('optimizationsChart');
        const successRateChart = document.getElementById('successRateChart');
        const popularModelsChart = document.getElementById('popularModelsChart');

        if (this.data.trends.optimizationsOverTime) {
            optimizationsChart.innerHTML = this.generateSimpleChart(this.data.trends.optimizationsOverTime, 'Optimizations');
        }

        if (this.data.trends.successRateOverTime) {
            successRateChart.innerHTML = this.generateSimpleChart(this.data.trends.successRateOverTime, 'Success Rate');
        }

        if (this.data.metrics.mostUsedModels) {
            popularModelsChart.innerHTML = this.generateModelChart(this.data.metrics.mostUsedModels);
        }
    }

    generateSimpleChart(data, label) {
        if (!data || !Array.isArray(data)) {
            return `<div style="color: #64748b;">No ${label.toLowerCase()} data available</div>`;
        }

        const maxValue = Math.max(...data.map(d => d.count || d.rate || 0));
        let chartHtml = `<div style="display: flex; align-items: end; height: 250px; gap: 8px; padding: 20px;">`;

        data.slice(-20).forEach((item, index) => {
            const height = maxValue > 0 ? ((item.count || item.rate || 0) / maxValue * 200) : 0;
            const date = new Date(item.date).toLocaleDateString();
            
            chartHtml += `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                    <div style="background: #3b82f6; width: 100%; height: ${height}px; margin-bottom: 8px; border-radius: 2px;" 
                         title="${date}: ${item.count || item.rate || 0}"></div>
                    <div style="font-size: 10px; color: #64748b; transform: rotate(-45deg);">${date.split('/')[1]}/${date.split('/')[2]}</div>
                </div>
            `;
        });

        chartHtml += '</div>';
        return chartHtml;
    }

    generateModelChart(models) {
        if (!models || !Array.isArray(models)) {
            return '<div style="color: #64748b;">No model usage data available</div>';
        }

        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
        let chartHtml = '<div style="padding: 20px;">';

        models.slice(0, 5).forEach((model, index) => {
            const percentage = model.percentage || 0;
            chartHtml += `
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-weight: 500;">${model.model}</span>
                        <span style="color: #64748b;">${percentage.toFixed(1)}%</span>
                    </div>
                    <div style="background: #f1f5f9; height: 8px; border-radius: 4px;">
                        <div style="background: ${colors[index % colors.length]}; height: 100%; width: ${percentage}%; border-radius: 4px;"></div>
                    </div>
                </div>
            `;
        });

        chartHtml += '</div>';
        return chartHtml;
    }

    updateActivitiesDisplay() {
        const container = document.getElementById('activitiesContainer');
        
        if (!this.data.activities || !Array.isArray(this.data.activities) || this.data.activities.length === 0) {
            container.innerHTML = '<div style="color: #64748b; padding: 20px; text-align: center;">No recent activities</div>';
            return;
        }

        const activitiesHtml = this.data.activities.map(activity => {
            const iconClass = activity.type === 'success' ? 'activity-success' : 
                             activity.type === 'error' ? 'activity-error' : 'activity-cached';
            
            const iconText = activity.type === 'success' ? '✓' : 
                            activity.type === 'error' ? '✗' : '◉';

            const timeAgo = this.timeAgo(new Date(activity.timestamp));

            return `
                <div class="activity-item">
                    <div class="activity-icon ${iconClass}">${iconText}</div>
                    <div class="activity-details">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-description">${activity.description}</div>
                    </div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = activitiesHtml;
    }

    addActivity(activity) {
        this.data.activities.unshift(activity);
        // Keep only the latest 20 activities
        this.data.activities = this.data.activities.slice(0, 20);
        this.updateActivitiesDisplay();
    }

    async updateMetrics() {
        try {
            const response = await this.fetchWithTimeout(`${this.apiBaseUrl}/analytics/metrics`);
            if (response.ok) {
                const metrics = await response.json();
                this.data.metrics = { ...this.data.metrics, ...metrics };
                this.updateMetricsDisplay();
            }
        } catch (error) {
            console.error('Error updating metrics:', error);
        }
    }

    updateConnectionStatus(connected, type = 'online') {
        const indicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        if (connected) {
            indicator.className = 'status-indicator status-online';
            statusText.textContent = 'Connected';
        } else {
            const statusClass = type === 'warning' ? 'status-warning' : 'status-offline';
            indicator.className = `status-indicator ${statusClass}`;
            statusText.textContent = type === 'warning' ? 'Connection Issues' : 'Disconnected';
        }
    }

    startPeriodicUpdates() {
        // Update metrics every 30 seconds
        this.updateInterval = setInterval(() => {
            this.updateMetrics();
        }, 30000);
    }

    showLoading(show) {
        // Implementation would show/hide loading indicators
        console.log(show ? 'Loading...' : 'Loading complete');
    }

    showError(message) {
        // Create error message element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        
        // Insert at the top of the container
        const container = document.querySelector('.container');
        container.insertBefore(errorDiv, container.firstChild);
        
        // Remove after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    timeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    }

    // Mock data generators for demonstration
    generateMockMetrics() {
        return {
            totalOptimizations: 1247,
            successfulOptimizations: 1189,
            failedOptimizations: 58,
            cachedOptimizations: 312,
            averageProcessingTime: 4200,
            totalTokensSaved: 45680,
            totalCostSaved: 127.34,
            averageConfidenceScore: 0.85,
            mostUsedModels: [
                { model: 'gpt-4', count: 487, percentage: 39.1 },
                { model: 'claude-3-sonnet', count: 324, percentage: 26.0 },
                { model: 'gpt-3.5-turbo', count: 298, percentage: 23.9 },
                { model: 'gemini-pro', count: 138, percentage: 11.1 }
            ]
        };
    }

    generateMockActivities() {
        const activities = [];
        const types = ['success', 'error', 'cached'];
        const titles = {
            success: ['Optimization Completed', 'Template Improved', 'Performance Enhanced'],
            error: ['Optimization Failed', 'Rate Limit Exceeded', 'Service Unavailable'],
            cached: ['Cached Result Served', 'Quick Response', 'Cache Hit']
        };

        for (let i = 0; i < 15; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const title = titles[type][Math.floor(Math.random() * titles[type].length)];
            
            activities.push({
                type,
                title,
                description: this.generateMockDescription(type),
                timestamp: new Date(Date.now() - Math.random() * 86400000) // Random time in last 24h
            });
        }

        return activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    generateMockDescription(type) {
        const descriptions = {
            success: [
                'Template optimized with 23% token reduction',
                'Improved clarity and reduced cost by $2.34',
                'Processing completed in 3.2 seconds'
            ],
            error: [
                'Connection timeout after 30 seconds',
                'API quota exceeded for current hour',
                'Invalid prompt format detected'
            ],
            cached: [
                'Optimization served from cache',
                'Instant response from cache store',
                'Previous optimization result returned'
            ]
        };

        const typeDescriptions = descriptions[type] || ['Unknown activity'];
        return typeDescriptions[Math.floor(Math.random() * typeDescriptions.length)];
    }

    generateMockTrends() {
        const trends = {
            optimizationsOverTime: [],
            successRateOverTime: []
        };

        // Generate 14 days of data
        for (let i = 13; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            
            trends.optimizationsOverTime.push({
                date: date.toISOString().split('T')[0],
                count: Math.floor(Math.random() * 100) + 20
            });

            trends.successRateOverTime.push({
                date: date.toISOString().split('T')[0],
                rate: 0.8 + Math.random() * 0.15 // 80-95% success rate
            });
        }

        return trends;
    }

    destroy() {
        if (this.websocket) {
            this.websocket.close();
        }
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new OptimizationDashboard();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
        window.dashboard.destroy();
    }
});