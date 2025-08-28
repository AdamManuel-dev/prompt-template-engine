---
title: "How to Set Up PromptWizard Integration"
description: "Complete setup and configuration guide for PromptWizard service integration"
category: "how-to"
tags: [setup, configuration, installation]
---

# How to Set Up PromptWizard Integration

This guide covers the complete setup process for integrating Microsoft PromptWizard with the Cursor Prompt Template Engine.

## Prerequisites

Before starting, ensure you have:

- ✅ Node.js 18+ installed
- ✅ Python 3.9+ available
- ✅ Docker and Docker Compose (recommended)
- ✅ Git access to Microsoft PromptWizard repository
- ✅ Sufficient system resources (4GB RAM, 2GB disk space)

## Installation Methods

Choose the installation method that best fits your environment:

### Method 1: Docker Installation (Recommended)

#### 1. Clone and Set Up the Service

```bash
# Clone the PromptWizard repository
git clone https://github.com/microsoft/promptwizard.git
cd promptwizard

# Set up the Docker environment
cp .env.example .env
```

#### 2. Configure Environment Variables

Edit the `.env` file:

```bash
# Service configuration
PROMPTWIZARD_PORT=8000
PROMPTWIZARD_HOST=0.0.0.0
PROMPTWIZARD_ENV=production

# API Configuration
API_KEY_REQUIRED=true
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=3600

# Model API Keys (add your keys)
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GOOGLE_API_KEY=your_google_key_here
XAI_API_KEY=your_xai_key_here

# Cache Configuration
REDIS_URL=redis://redis:6379
REDIS_TTL=3600

# Database Configuration
DATABASE_URL=postgresql://promptwizard:password@postgres:5432/promptwizard

# Security
JWT_SECRET=your-jwt-secret-here
ENCRYPTION_KEY=your-encryption-key-here
```

#### 3. Start the Service

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f promptwizard-service
```

#### 4. Verify Installation

```bash
# Test service health
curl http://localhost:8000/health

# Expected response:
# {"status":"healthy","version":"1.0.0","timestamp":"2024-01-15T10:30:00Z"}
```

### Method 2: Local Python Installation

#### 1. Set Up Python Environment

```bash
# Create virtual environment
python3 -m venv promptwizard-env
source promptwizard-env/bin/activate  # On Windows: promptwizard-env\Scripts\activate

# Install PromptWizard
pip install git+https://github.com/microsoft/promptwizard.git

# Install service dependencies
pip install fastapi uvicorn redis postgresql-adapter
```

#### 2. Create Service Configuration

Create `config.py`:

```python
import os
from pydantic import BaseSettings

class Settings(BaseSettings):
    # Service settings
    port: int = 8000
    host: str = "127.0.0.1"
    environment: str = "development"
    
    # API settings
    api_key_required: bool = True
    rate_limit_enabled: bool = True
    max_requests_per_hour: int = 1000
    
    # Model API keys
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    google_api_key: str = os.getenv("GOOGLE_API_KEY", "")
    
    # Cache settings
    redis_url: str = "redis://localhost:6379"
    cache_ttl: int = 3600
    
    # Security
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-secret")
    
    class Config:
        env_file = ".env"

settings = Settings()
```

#### 3. Create Service Application

Create `main.py`:

```python
from fastapi import FastAPI, HTTPException
from promptwizard import PromptWizard
import uvicorn
from config import settings

app = FastAPI(title="PromptWizard Service", version="1.0.0")
wizard = PromptWizard()

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "environment": settings.environment
    }

@app.post("/api/v1/optimize")
async def optimize_prompt(request: OptimizationRequest):
    try:
        result = await wizard.optimize(
            prompt=request.prompt,
            task=request.task,
            model=request.model,
            iterations=request.iterations
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.environment == "development"
    )
```

#### 4. Start the Service

```bash
# Start the service
python main.py

# Service will be available at http://localhost:8000
```

### Method 3: Kubernetes Deployment

#### 1. Create Kubernetes Manifests

Create `k8s/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: promptwizard
```

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: promptwizard-service
  namespace: promptwizard
spec:
  replicas: 3
  selector:
    matchLabels:
      app: promptwizard-service
  template:
    metadata:
      labels:
        app: promptwizard-service
    spec:
      containers:
      - name: promptwizard
        image: promptwizard/service:latest
        ports:
        - containerPort: 8000
        env:
        - name: PROMPTWIZARD_ENV
          value: "production"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

#### 2. Deploy to Kubernetes

```bash
# Deploy namespace
kubectl apply -f k8s/namespace.yaml

# Deploy service
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Check deployment status
kubectl get pods -n promptwizard
```

## Configure the Template Engine

### 1. Install PromptWizard Integration

```bash
# Update to latest version with PromptWizard support
npm update @cursor/prompt-template-engine

# Or install from source
git pull origin main
npm install
npm run build
```

### 2. Configure Integration Settings

Create or update `cursor-prompt.config.json`:

```json
{
  "promptwizard": {
    "service": {
      "url": "http://localhost:8000",
      "timeout": 120000,
      "retries": 3,
      "apiKey": "your-api-key-here"
    },
    "optimization": {
      "defaultModel": "gpt-4",
      "mutateRefineIterations": 3,
      "fewShotCount": 5,
      "generateReasoning": true,
      "autoOptimize": false
    },
    "cache": {
      "enabled": true,
      "ttl": 86400,
      "maxSize": 1000,
      "redis": {
        "enabled": false,
        "url": "redis://localhost:6379"
      }
    },
    "monitoring": {
      "enabled": true,
      "logLevel": "info",
      "trackUsage": true
    }
  }
}
```

### 3. Environment Variables

Set up environment variables:

```bash
# Add to your .env file
PROMPTWIZARD_SERVICE_URL=http://localhost:8000
PROMPTWIZARD_API_KEY=your-api-key-here
PROMPTWIZARD_TIMEOUT=120000

# For production
PROMPTWIZARD_SERVICE_URL=https://your-promptwizard-service.com
PROMPTWIZARD_ENV=production
```

### 4. Test Integration

```bash
# Test the integration
cursor-prompt health-check

# Expected output:
# ✓ Cursor Prompt Template Engine: OK
# ✓ PromptWizard Service: OK
# ✓ Configuration: Valid
# ✓ API Connection: Healthy
```

## Production Deployment

### Security Configuration

#### 1. Set Up Authentication

```bash
# Generate API key
cursor-prompt generate-api-key --name "production-client"

# Set up JWT authentication
cursor-prompt configure-auth \
  --method jwt \
  --secret-key "your-jwt-secret" \
  --expiry 24h
```

#### 2. Enable HTTPS

Create SSL certificate and configure HTTPS:

```bash
# Generate self-signed certificate (for testing)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Or use Let's Encrypt for production
certbot certonly --standalone -d your-domain.com
```

Update service configuration for HTTPS:

```python
# In main.py
import ssl

if settings.environment == "production":
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain("cert.pem", "key.pem")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=443,
        ssl_context=ssl_context
    )
```

### Monitoring and Logging

#### 1. Set Up Prometheus Metrics

```bash
# Install prometheus client
pip install prometheus-client

# Add metrics endpoint
curl http://localhost:8000/metrics
```

#### 2. Configure Logging

Create `logging.conf`:

```ini
[loggers]
keys=root,promptwizard

[handlers]
keys=console,file

[formatters]
keys=standard

[logger_root]
level=INFO
handlers=console

[logger_promptwizard]
level=INFO
handlers=console,file
qualname=promptwizard

[handler_console]
class=StreamHandler
level=INFO
formatter=standard
args=(sys.stdout,)

[handler_file]
class=FileHandler
level=INFO
formatter=standard
args=('/var/log/promptwizard.log',)

[formatter_standard]
format=%(asctime)s [%(levelname)s] %(name)s: %(message)s
```

### High Availability Setup

#### 1. Load Balancer Configuration

Create `nginx.conf`:

```nginx
upstream promptwizard {
    server 127.0.0.1:8000;
    server 127.0.0.1:8001;
    server 127.0.0.1:8002;
}

server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://promptwizard;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Health check
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /health {
        proxy_pass http://promptwizard/health;
        access_log off;
    }
}
```

#### 2. Database Clustering

For PostgreSQL cluster:

```bash
# Primary database
docker run -d \
  --name postgres-primary \
  -e POSTGRES_DB=promptwizard \
  -e POSTGRES_USER=promptwizard \
  -e POSTGRES_PASSWORD=secure_password \
  -e POSTGRES_REPLICATION_MODE=master \
  -e POSTGRES_REPLICATION_USER=replicator \
  -e POSTGRES_REPLICATION_PASSWORD=rep_password \
  postgres:13

# Read replica
docker run -d \
  --name postgres-replica \
  -e PGUSER=replicator \
  -e PGPASSWORD=rep_password \
  -e POSTGRES_MASTER_IP=postgres-primary \
  -e POSTGRES_REPLICATION_MODE=slave \
  postgres:13
```

### Backup and Recovery

#### 1. Automated Backups

Create backup script `backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/backups/promptwizard"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -h localhost -U promptwizard promptwizard > $BACKUP_DIR/db_backup_$DATE.sql

# Backup configuration
cp -r /app/config $BACKUP_DIR/config_$DATE

# Backup Redis data (if applicable)
redis-cli --rdb $BACKUP_DIR/redis_backup_$DATE.rdb

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +30 -delete

echo "Backup completed: $DATE"
```

Schedule with cron:

```bash
# Add to crontab
0 2 * * * /path/to/backup.sh
```

#### 2. Recovery Procedures

Create recovery script `recover.sh`:

```bash
#!/bin/bash

BACKUP_FILE=$1
if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

# Stop service
docker-compose down

# Restore database
psql -h localhost -U promptwizard -d promptwizard < $BACKUP_FILE

# Start service
docker-compose up -d

echo "Recovery completed"
```

## Troubleshooting

### Common Issues

#### Service Won't Start

```bash
# Check logs
docker-compose logs promptwizard-service

# Common fixes:
# 1. Port already in use
sudo lsof -i :8000
kill -9 <PID>

# 2. Missing environment variables
docker-compose exec promptwizard-service env | grep PROMPTWIZARD

# 3. Database connection issues
docker-compose exec postgres psql -U promptwizard -d promptwizard -c "\dt"
```

#### Connection Timeouts

```bash
# Increase timeout settings
export PROMPTWIZARD_TIMEOUT=300000

# Check network connectivity
telnet localhost 8000

# Test with curl
curl -v http://localhost:8000/health
```

#### Memory Issues

```bash
# Check resource usage
docker stats promptwizard-service

# Increase memory limits
docker-compose up -d --scale promptwizard-service=2

# Monitor memory leaks
docker exec promptwizard-service python -c "
import psutil
print(f'Memory usage: {psutil.virtual_memory().percent}%')
"
```

### Performance Tuning

#### Optimize Service Performance

```python
# In main.py - add worker configuration
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        workers=4,  # Increase workers
        loop="uvloop",  # Use faster event loop
        http="httptools"  # Use faster HTTP parser
    )
```

#### Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX idx_optimization_requests_created ON optimization_requests(created_at);
CREATE INDEX idx_optimization_requests_status ON optimization_requests(status);
CREATE INDEX idx_templates_name ON templates(name);

-- Update database statistics
ANALYZE;
```

### Support and Updates

#### Enable Debug Mode

```bash
# Enable debug logging
export PROMPTWIZARD_LOG_LEVEL=DEBUG
docker-compose restart

# View detailed logs
docker-compose logs -f --tail=100 promptwizard-service
```

#### Update Service

```bash
# Pull latest image
docker-compose pull

# Restart with new version
docker-compose down
docker-compose up -d

# Verify update
curl http://localhost:8000/health | jq '.version'
```

## Next Steps

After successful setup:

1. **Test Integration**: Run the [Getting Started Tutorial](../tutorials/promptwizard-getting-started.md)
2. **Configure Optimization**: Set up [Prompt Optimization Workflows](./optimize-prompts.md)
3. **Enable Monitoring**: Implement monitoring and alerting
4. **Scale Up**: Configure for production load
5. **Security Review**: Conduct security audit and penetration testing

For additional support, see:

- [API Reference](../reference/promptwizard-api.md)
- [Troubleshooting Guide](./troubleshooting.md)
- [Architecture Documentation](../explanation/promptwizard-architecture.md)