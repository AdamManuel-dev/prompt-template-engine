# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the PromptWizard optimization system.

## Service Connection Problems

### PromptWizard Service Not Responding

**Symptoms:**
- `curl http://localhost:8000/api/v1/health` times out
- CLI commands fail with "service unavailable"
- Connection refused errors

**Diagnostic Steps:**

```bash
# 1. Check if service is running
ps aux | grep promptwizard
docker ps | grep promptwizard

# 2. Check service logs
# For direct Python execution:
tail -f promptwizard-service.log

# For Docker:
docker logs promptwizard-service

# 3. Check port availability
netstat -tulpn | grep 8000
lsof -i :8000
```

**Solutions:**

```bash
# Restart Python service
cd services/promptwizard-service
pkill -f "python main.py"
python main.py &

# Restart Docker service
docker-compose restart promptwizard-service

# For production deployment:
docker-compose -f docker-compose.prod.yml restart
```

### Port Conflicts

**Symptoms:**
- Service fails to start with "Address already in use"
- Multiple services trying to use port 8000

**Solution:**

```bash
# Find process using port 8000
lsof -i :8000

# Kill conflicting process
sudo kill -9 <PID>

# Or use alternative port
export PROMPTWIZARD_PORT=8001
python main.py
```

**Alternative Configuration:**

```yaml
# .cursor-prompt.yaml
promptWizard:
  serviceUrl: http://localhost:8001
  # ... rest of config
```

### Docker Issues

**Common Docker Problems:**

```bash
# Docker daemon not running
sudo systemctl start docker

# Insufficient permissions
sudo usermod -aG docker $USER
# Logout and login again

# Clean up Docker resources
docker system prune -a

# Rebuild containers
docker-compose down --volumes
docker-compose up --build
```

## Performance Optimization Tips

### Slow Optimization Response

**Symptoms:**
- Optimization takes more than 5 minutes
- Frequent timeouts
- High CPU/memory usage

**Diagnostic Steps:**

```bash
# Monitor resource usage
htop
docker stats

# Check service logs for bottlenecks
docker logs promptwizard-service | grep -i slow
docker logs promptwizard-service | grep -i timeout
```

**Performance Solutions:**

1. **Increase Service Resources:**

```yaml
# docker-compose.yml
services:
  promptwizard-service:
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
```

2. **Optimize Configuration:**

```yaml
# .cursor-prompt.yaml
promptWizard:
  defaults:
    mutateRefineIterations: 2  # Reduce iterations
    fewShotCount: 3           # Fewer examples
  cache:
    enabled: true
    ttl: 3600                 # Longer cache TTL
```

3. **Use Performance Mode:**

```bash
# Run optimization with performance flags
cprompt optimize my-template \
  --fast-mode \
  --skip-examples \
  --iterations 2
```

### Memory Issues

**Symptoms:**
- Out of memory errors
- Service crashes during optimization
- System becomes unresponsive

**Solutions:**

```bash
# Increase swap space (Linux)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Monitor memory usage
free -h
docker stats --no-stream
```

**Memory-Efficient Configuration:**

```yaml
promptWizard:
  cache:
    maxSize: 50  # Limit cache size
  optimization:
    maxConcurrency: 1  # Process one at a time
```

## Cache Management

### Cache Not Working

**Symptoms:**
- Same optimization takes full time repeatedly
- Cache hit rate is 0%
- `--skip-cache` has no effect

**Diagnostic Steps:**

```bash
# Check cache status
cprompt cache-status

# View cache contents
cprompt cache-list

# Check cache configuration
cprompt config show | grep cache
```

**Cache Fixes:**

```bash
# Clear and restart cache
cprompt cache-clear
cprompt optimize --clear-cache

# Verify cache permissions (Linux/macOS)
ls -la ~/.cache/cursor-prompt/
chmod -R 755 ~/.cache/cursor-prompt/

# Reset cache service
docker-compose restart redis  # If using Redis
```

### Redis Connection Issues

**Symptoms:**
- "Redis connection failed" in logs
- Cache misses despite proper configuration
- Distributed cache not working

**Solutions:**

```bash
# Check Redis service
redis-cli ping
# Expected: PONG

# Check Redis logs
docker logs redis

# Restart Redis
docker-compose restart redis

# Test Redis connectivity
redis-cli -h localhost -p 6379 info
```

**Redis Configuration:**

```yaml
promptWizard:
  cache:
    redis:
      enabled: true
      url: redis://localhost:6379
      password: ${REDIS_PASSWORD}
      db: 0
      maxConnections: 10
```

## Error Recovery Procedures

### Optimization Failures

**Common Error Types:**

1. **Template Loading Errors:**

```bash
# Error: Template not found: my-template
cprompt list  # Check available templates
cprompt optimize ./path/to/template.yaml  # Use full path
```

2. **Invalid Template Format:**

```bash
# Error: Invalid YAML syntax
yaml-lint templates/my-template.yaml

# Fix YAML formatting
cprompt validate my-template
```

3. **API Rate Limiting:**

```bash
# Error: Rate limit exceeded
# Wait and retry:
sleep 60
cprompt optimize my-template

# Or configure retry settings:
cprompt optimize my-template --retries 5 --retry-delay 30
```

4. **Model Access Errors:**

```bash
# Error: Model not available
# Check API keys:
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY

# Test model access:
cprompt test-models
```

### Recovery Commands

```bash
# Reset optimization service
cprompt reset-service

# Clear all caches and restart
cprompt full-reset

# Recover from corrupted state
cprompt recover --from-backup

# Emergency rollback
cprompt rollback-all --to-date 2023-12-01
```

## Configuration Issues

### Invalid Configuration

**Symptoms:**
- Service fails to start
- Configuration validation errors
- Unexpected behavior

**Validation Steps:**

```bash
# Validate configuration syntax
cprompt config validate

# Check configuration values
cprompt config show

# Test configuration
cprompt config test
```

**Common Configuration Fixes:**

1. **YAML Syntax Errors:**

```yaml
# Bad (missing quotes):
promptWizard:
  serviceUrl: http://localhost:8000  # Should be quoted if contains special chars

# Good:
promptWizard:
  serviceUrl: "http://localhost:8000"
```

2. **Environment Variables:**

```bash
# Check environment variables
env | grep PROMPT

# Set required variables
export PROMPTWIZARD_SERVICE_URL=http://localhost:8000
export OPENAI_API_KEY=your-api-key-here
```

3. **File Permissions:**

```bash
# Fix configuration file permissions
chmod 644 .cursor-prompt.yaml
chmod -R 755 ~/.cursor-prompt/
```

## Model-Specific Issues

### OpenAI API Issues

```bash
# Test OpenAI connectivity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models

# Common solutions:
# 1. Verify API key is valid
# 2. Check billing/quota limits
# 3. Ensure correct model names
```

### Anthropic API Issues

```bash
# Test Anthropic connectivity
curl -H "x-api-key: $ANTHROPIC_API_KEY" \
     https://api.anthropic.com/v1/messages

# Common issues:
# 1. API key format (should start with 'sk-ant-')
# 2. Region restrictions
# 3. Model availability
```

### Model Fallback Configuration

```yaml
promptWizard:
  models:
    fallbackChain:
      - gpt-4
      - claude-3-opus
      - claude-3-sonnet
  retry:
    enabled: true
    attempts: 3
    backoff: exponential
```

## Debugging Commands

### Verbose Logging

```bash
# Enable debug mode
export CURSOR_PROMPT_DEBUG=1
cprompt optimize my-template --debug

# View detailed logs
cprompt logs --tail 100 --level debug

# Service-specific debugging
docker logs promptwizard-service --follow
```

### Health Checks

```bash
# Comprehensive system health check
cprompt health-check --comprehensive

# Check specific components
cprompt health-check --service promptwizard
cprompt health-check --cache
cprompt health-check --models
```

### Diagnostic Report

```bash
# Generate diagnostic report
cprompt diagnose --output diagnostic-report.json

# Share-safe diagnostic info
cprompt diagnose --anonymize --output safe-diagnostic.json
```

## Common Error Messages

### "Template not found"

```bash
# Solution 1: Check template exists
cprompt list | grep my-template

# Solution 2: Use full path
cprompt optimize ./templates/my-template.yaml

# Solution 3: Check working directory
pwd
ls templates/
```

### "Service unavailable"

```bash
# Check service health
curl -f http://localhost:8000/api/v1/health

# If unhealthy, restart service
docker-compose restart promptwizard-service

# Check firewall (Linux)
sudo ufw status
sudo ufw allow 8000
```

### "Optimization timeout"

```bash
# Increase timeout
cprompt optimize my-template --timeout 300000  # 5 minutes

# Or reduce complexity
cprompt optimize my-template --iterations 2 --examples 3
```

### "Invalid API key"

```bash
# Check API key format
echo $OPENAI_API_KEY | cut -c1-10  # Should start with 'sk-'

# Reload environment
source ~/.bashrc
# or
source ~/.zshrc

# Test API key
cprompt test-api-keys
```

### "Rate limit exceeded"

```bash
# Wait and retry
sleep 60
cprompt optimize my-template

# Check usage
cprompt usage-stats --period 1h

# Configure rate limiting
cprompt config set rateLimiting.enabled true
cprompt config set rateLimiting.requestsPerMinute 10
```

## Prevention Strategies

### Monitoring Setup

```yaml
# .cursor-prompt.yaml
monitoring:
  enabled: true
  healthChecks:
    interval: 30  # seconds
    timeout: 10
    retries: 3
  alerts:
    - type: email
      trigger: service_down
      recipients: ["admin@company.com"]
    - type: slack
      trigger: optimization_failure
      webhook: ${SLACK_WEBHOOK_URL}
```

### Backup and Recovery

```bash
# Backup optimization results
cprompt backup --include results,cache,config --output backup.tar.gz

# Scheduled backups (cron)
0 2 * * * /usr/local/bin/cprompt backup --output /backups/$(date +\%Y\%m\%d).tar.gz
```

### Monitoring Commands

```bash
# Real-time monitoring
cprompt monitor --live

# Performance dashboard
cprompt dashboard --port 3000

# Set up alerts
cprompt alert create --type optimization-failure --threshold 3 --action restart-service
```

## Getting Help

### Log Collection

```bash
# Collect all relevant logs
cprompt collect-logs --output support-logs.tar.gz

# Include system information
cprompt collect-logs --include-system --output complete-logs.tar.gz
```

### Support Information

When reporting issues, include:

1. **System Information:**
   ```bash
   cprompt --version
   node --version
   python --version
   docker --version
   uname -a
   ```

2. **Configuration (anonymized):**
   ```bash
   cprompt config show --anonymize
   ```

3. **Recent Logs:**
   ```bash
   cprompt logs --tail 100 --since 1h
   ```

4. **Error Messages:**
   - Full error text
   - Stack traces
   - Reproduction steps

### Community Resources

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check latest docs for updates
- **Community Forum**: Ask questions and share solutions
- **Discord/Slack**: Real-time community support

By following this troubleshooting guide, you should be able to resolve most common issues with the PromptWizard optimization system. If problems persist, collect diagnostic information and reach out to the community or support team.

Next: [API Reference](./api-reference.md) for detailed API documentation.