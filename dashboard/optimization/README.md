# PromptWizard Optimization Dashboard

A real-time dashboard for monitoring PromptWizard optimization metrics, performance, and usage analytics.

## Features

- **Real-time Metrics**: Live monitoring of optimization statistics
- **Success Rate Tracking**: Monitor optimization success rates over time
- **Cost Savings Analytics**: Track token and cost reductions
- **Performance Monitoring**: Processing time and cache hit rate metrics
- **Activity Feed**: Real-time optimization events and notifications
- **Trend Analysis**: Historical data visualization and trends
- **WebSocket Integration**: Live updates without page refresh

## Setup

### 1. Basic Setup

Simply open `index.html` in your browser to view the dashboard with mock data.

### 2. Development Setup

For live data integration, ensure the PromptWizard service is running:

```bash
# Start the PromptWizard Python service
cd services/promptwizard-service
python main.py

# The dashboard will connect to:
# - REST API: http://localhost:8000/api/v1
# - WebSocket: ws://localhost:8001/ws/dashboard
```

### 3. Production Setup

For production deployment, configure a web server to serve the dashboard files:

```nginx
# Example nginx configuration
server {
    listen 80;
    server_name dashboard.your-domain.com;
    
    root /path/to/dashboard/optimization;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy API requests
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Proxy WebSocket connections
    location /ws/ {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Dashboard Sections

### Metrics Overview

- **Total Optimizations**: Number of optimization requests processed
- **Success Rate**: Percentage of successful optimizations
- **Tokens Saved**: Total tokens reduced through optimization
- **Cost Savings**: Total cost reduction achieved
- **Avg Processing Time**: Average time per optimization
- **Cache Hit Rate**: Percentage of requests served from cache

### Charts and Visualizations

1. **Optimizations Over Time**: Timeline showing optimization volume
2. **Success Rate Trend**: Success rate changes over time
3. **Popular Models**: Distribution of model usage

### Activity Feed

Real-time stream of optimization events:
- ✅ Successful optimizations
- ❌ Failed attempts
- 🔄 Cached results served

## Configuration

### API Endpoints

The dashboard expects the following API endpoints:

```javascript
// Metrics endpoint
GET /api/v1/analytics/metrics?range={timeRange}

// Activities endpoint  
GET /api/v1/analytics/activities?limit={count}

// Trends endpoint
GET /api/v1/analytics/trends?range={timeRange}
```

### WebSocket Events

The dashboard listens for these WebSocket event types:

```javascript
{
  "type": "optimization_complete",
  "data": {
    "tokenReduction": 25,
    "costReduction": 2.34,
    // ... other metrics
  }
}

{
  "type": "optimization_failed", 
  "data": {
    "error": "Rate limit exceeded"
  }
}

{
  "type": "cached_result",
  "data": {
    "cacheKey": "...",
    "responseTime": 45
  }
}

{
  "type": "metrics_update",
  "data": {
    "totalOptimizations": 1250,
    "successRate": 0.89,
    // ... updated metrics
  }
}
```

## Customization

### Styling

The dashboard uses CSS custom properties for easy theming:

```css
:root {
  --primary-color: #3b82f6;
  --success-color: #10b981;
  --error-color: #ef4444;
  --warning-color: #f59e0b;
  --background-color: #f8fafc;
  --card-background: white;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
}
```

### Time Ranges

Modify the available time range options:

```javascript
// In dashboard.js
const timeRanges = [
  { value: '1h', label: 'Last Hour' },
  { value: '6h', label: 'Last 6 Hours' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' }
];
```

### Chart Integration

To integrate with Chart.js or other charting libraries:

```javascript
// Example Chart.js integration
updateChartsDisplay() {
  const ctx = document.getElementById('optimizationsChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: this.data.trends.optimizationsOverTime.map(d => d.date),
      datasets: [{
        label: 'Optimizations',
        data: this.data.trends.optimizationsOverTime.map(d => d.count),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}
```

## Browser Support

- Chrome/Chromium 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Performance

The dashboard is optimized for performance:
- Efficient WebSocket connection management
- Automatic reconnection on connection loss
- Debounced updates to prevent UI thrashing
- Lazy loading of historical data
- Memory-efficient activity list (max 20 items)

## Security Considerations

- Implement proper authentication for production
- Use HTTPS/WSS for encrypted connections  
- Validate all incoming WebSocket messages
- Implement rate limiting on the API endpoints
- Consider using JWT tokens for API access

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Verify PromptWizard service is running
   - Check firewall settings
   - Confirm WebSocket URL is correct

2. **No Data Displayed**
   - Check API endpoint accessibility
   - Verify CORS headers are set correctly
   - Look for JavaScript console errors

3. **Charts Not Updating**
   - Ensure WebSocket connection is established
   - Check that service is emitting events
   - Verify event message format

### Debug Mode

Enable debug logging:

```javascript
// Add to dashboard.js constructor
this.debugMode = true; // Set to false for production

// Debug logging will appear in browser console
```

## License

This dashboard is part of the PromptWizard integration and follows the same MIT license as the main project.