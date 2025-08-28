# PromptWizard Production Deployment Guide

This directory contains comprehensive deployment configurations and migration tools for the PromptWizard integration in production environments.

## 📁 Directory Structure

```
deployment/promptwizard/
├── docker/                     # Container configurations
│   ├── Dockerfile.production   # Production-ready Docker image
│   ├── docker-compose.prod.yml # Production Docker Compose
│   └── .env.production.template # Environment variables template
├── k8s/                        # Kubernetes manifests
│   ├── namespace.yaml          # Namespace with resource quotas
│   ├── configmap.yaml          # Configuration management
│   ├── secrets.yaml.template   # Secrets template
│   ├── deployment.yaml         # Service deployment
│   ├── service.yaml            # Networking configuration
│   └── hpa.yaml                # Auto-scaling configuration
├── ci-cd/                      # CI/CD pipeline
│   └── .github/workflows/      # GitHub Actions workflows
├── monitoring/                 # Monitoring and observability
│   ├── prometheus.yml          # Prometheus configuration
│   ├── alertmanager.yml        # Alerting rules
│   └── grafana-dashboards/     # Grafana dashboard definitions
└── backup-recovery/            # Backup and recovery scripts
    ├── backup-script.sh        # Automated backup script
    └── recovery-script.sh      # Disaster recovery script

scripts/migration/              # Migration tools
├── migrate-templates.ts        # Template migration orchestrator
├── batch-optimize.ts          # Batch processing engine
├── rollback.ts                # Rollback utilities
└── data-migration.ts          # Data format migration
```

## 🚀 Quick Start

### 1. Prerequisites

- Docker 20.10+ and Docker Compose v2
- Kubernetes 1.24+ (for production deployment)
- kubectl configured with cluster access
- Node.js 18+ and TypeScript (for migration tools)
- Required environment variables and secrets

### 2. Development Environment

```bash
# Start development environment
cd deployment/promptwizard/docker
cp .env.production.template .env.production
# Edit .env.production with your values
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Production Deployment

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml     # After configuring secrets
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
```

## 🔧 Configuration

### Environment Variables

Key environment variables for production deployment:

```bash
# Application Configuration
ENVIRONMENT=production
PORT=8000
WORKERS=4
LOG_LEVEL=INFO

# Redis Configuration
REDIS_URL=redis://redis-master:6379
REDIS_SENTINEL_URLS=redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379
REDIS_MASTER_NAME=mymaster

# External API Keys (managed via secrets)
OPENAI_API_KEY=<secret>
ANTHROPIC_API_KEY=<secret>
GOOGLE_API_KEY=<secret>

# Monitoring
METRICS_ENABLED=true
JAEGER_AGENT_HOST=jaeger-agent
JAEGER_AGENT_PORT=6831
```

### Secret Management

#### Using Kubernetes Secrets

```bash
# Create secrets manually
kubectl create secret generic promptwizard-secrets \
  --from-literal=SECRET_KEY="your-secret-key" \
  --from-literal=JWT_SECRET="your-jwt-secret" \
  --from-literal=API_KEY="your-api-key" \
  --from-literal=REDIS_PASSWORD="your-redis-password" \
  --from-literal=OPENAI_API_KEY="your-openai-key" \
  --from-literal=ANTHROPIC_API_KEY="your-anthropic-key" \
  --namespace=promptwizard
```

#### Using External Secrets Operator (Recommended)

```bash
# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace

# Apply ExternalSecret configuration (included in secrets.yaml.template)
kubectl apply -f k8s/secrets.yaml.template
```

## 📊 Monitoring

### Prometheus Metrics

The service exposes metrics at `/metrics` endpoint including:

- HTTP request metrics
- Optimization performance metrics
- Cache hit rates
- Resource utilization
- Business metrics (optimization success rates, etc.)

### Grafana Dashboards

Pre-configured dashboards available in `monitoring/grafana-dashboards/`:

- **PromptWizard Overview**: Service health, performance, and optimization metrics
- **Resource Usage**: CPU, memory, and network utilization
- **Business Metrics**: Optimization success rates, user satisfaction scores

### Alerting Rules

Key alerts configured in `monitoring/alertmanager.yml`:

- **Service Down**: Critical alert when service becomes unavailable
- **High Error Rate**: Warning when error rate exceeds 5%
- **High Response Time**: Warning when 95th percentile > 1 second
- **Resource Exhaustion**: Memory/CPU usage above thresholds
- **Optimization Failures**: High failure rate in optimization pipeline

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

The `.github/workflows/promptwizard-deploy.yml` provides:

1. **Quality Gate**: Linting, testing, security scanning
2. **Build & Push**: Multi-architecture container builds
3. **Security Scanning**: Trivy container scanning, SBOM generation
4. **Deployment**: Zero-downtime Kubernetes deployment
5. **Validation**: Health checks and smoke tests
6. **Rollback**: Automatic rollback on failure

### Deployment Triggers

- **Push to main**: Production deployment
- **Push to develop**: Staging deployment
- **Release tags**: Tagged production releases
- **Manual trigger**: Custom environment deployment

## 📦 Backup and Recovery

### Automated Backups

```bash
# Run backup script
./backup-recovery/backup-script.sh

# Backup includes:
# - PostgreSQL database dump
# - Redis data backup
# - Kubernetes configurations
# - Persistent volume data
# - Application logs and metrics
```

### Disaster Recovery

```bash
# Full system recovery
./backup-recovery/recovery-script.sh <backup-id>

# Partial recovery options
./backup-recovery/recovery-script.sh <backup-id> database-only
./backup-recovery/recovery-script.sh <backup-id> config-only
./backup-recovery/recovery-script.sh <backup-id> volume-only

# Dry run for validation
./backup-recovery/recovery-script.sh <backup-id> full true
```

### Backup Schedule

- **Full backup**: Daily at 2 AM UTC
- **Incremental backup**: Every 6 hours
- **Configuration backup**: On every deployment
- **Retention**: 30 days for daily, 7 days for incremental

## 🔄 Migration Tools

### Template Migration

Migrate existing templates to optimized versions:

```bash
# Basic migration
npm run migrate:templates

# Advanced options
npm run migrate:templates -- \
  --batch-size 20 \
  --max-concurrency 5 \
  --skip-existing \
  --output ./migration-results \
  --filter "user-*" \
  --priority high
```

### Batch Optimization

Process multiple templates with queue management:

```bash
# Start batch optimization
npm run batch:optimize -- \
  --concurrency 10 \
  --timeout 300000 \
  --enable-checkpoints \
  --output ./batch-results

# Resume from checkpoint
npm run batch:optimize -- --resume

# Monitor progress
npm run batch:status
```

### Rollback Operations

Rollback to previous versions:

```bash
# List available versions
npm run rollback:list

# Rollback to specific version
npm run rollback:version v1.2.3

# Rollback to last known good
npm run rollback:last-good

# Create system snapshot
npm run rollback:snapshot "Pre-deployment snapshot"
```

### Data Migration

Upgrade data formats between schema versions:

```bash
# Upgrade from v2.0 to v3.0
npm run data:migrate upgrade 2.0 3.0 -- \
  --batch-size 100 \
  --validation comprehensive \
  --output ./migration-results

# Validate data integrity
npm run data:validate 3.0

# Dry run migration
npm run data:migrate upgrade 2.0 3.0 --dry-run
```

## 🛡️ Security

### Container Security

- **Base Image**: Minimal Python 3.11 slim image
- **Non-root User**: Runs as user ID 1000
- **Read-only Filesystem**: Immutable container filesystem
- **Security Scanning**: Trivy and Grype integration
- **SBOM Generation**: Software Bill of Materials tracking

### Kubernetes Security

- **Network Policies**: Restricted pod-to-pod communication
- **RBAC**: Minimal required permissions
- **Pod Security Standards**: Enforced security contexts
- **Secrets Management**: External secrets integration
- **Resource Limits**: CPU/memory constraints

### Runtime Security

- **TLS Encryption**: All external communications encrypted
- **API Authentication**: JWT-based authentication
- **Rate Limiting**: Request rate limiting per client
- **Input Validation**: Comprehensive input sanitization
- **Audit Logging**: Security events logged and monitored

## 📈 Scaling

### Horizontal Pod Autoscaler (HPA)

Automatic scaling based on:
- CPU utilization (70% target)
- Memory utilization (80% target)
- Custom metrics (active connections, queue length, response time)

### Vertical Pod Autoscaler (VPA)

Right-sizing recommendations for:
- CPU requests and limits
- Memory requests and limits
- Optimization based on historical usage

### KEDA Integration

Event-driven autoscaling using:
- Redis queue length
- Prometheus metrics
- HTTP request rates
- Custom business metrics

## 🔧 Troubleshooting

### Common Issues

1. **Service Not Starting**
   ```bash
   kubectl logs -f deployment/promptwizard-service -n promptwizard
   kubectl describe pod -l app=promptwizard -n promptwizard
   ```

2. **Database Connection Issues**
   ```bash
   kubectl exec -it deployment/promptwizard-service -n promptwizard -- \
     python -c "from app.database import test_connection; test_connection()"
   ```

3. **Redis Connection Problems**
   ```bash
   kubectl exec -it deployment/redis-master-0 -n promptwizard -- \
     redis-cli ping
   ```

4. **Performance Issues**
   - Check Grafana dashboards
   - Review Prometheus metrics
   - Analyze application logs
   - Verify resource limits

### Debug Mode

Enable debug mode for troubleshooting:

```bash
kubectl set env deployment/promptwizard-service \
  LOG_LEVEL=DEBUG -n promptwizard
```

### Log Analysis

```bash
# Stream application logs
kubectl logs -f deployment/promptwizard-service -n promptwizard

# Search logs for errors
kubectl logs deployment/promptwizard-service -n promptwizard | grep ERROR

# Export logs for analysis
kubectl logs deployment/promptwizard-service -n promptwizard > debug.log
```

## 📞 Support

### Documentation

- [API Documentation](../../docs/API.md)
- [Architecture Guide](../../docs/ARCHITECTURE.md)
- [Troubleshooting Guide](../../docs/TROUBLESHOOTING.md)

### Monitoring Dashboards

- Grafana: `https://grafana.company.com/d/promptwizard-overview`
- Prometheus: `https://prometheus.company.com/targets`
- Jaeger: `https://jaeger.company.com/search`

### Emergency Contacts

- **On-call Engineer**: `+1-555-ON-CALL`
- **DevOps Team**: `devops@company.com`
- **PromptWizard Team**: `promptwizard-team@company.com`

### Runbooks

- [Service Down Incident Response](./runbooks/service-down.md)
- [Performance Degradation](./runbooks/performance-issues.md)
- [Data Recovery Procedures](./runbooks/data-recovery.md)
- [Security Incident Response](./runbooks/security-incident.md)

---

## 🤝 Contributing

When making changes to deployment configurations:

1. Test in development environment first
2. Update documentation
3. Review security implications
4. Test rollback procedures
5. Update monitoring and alerting
6. Coordinate with DevOps team

## 📝 Changelog

See [CHANGELOG.md](../../CHANGELOG.md) for version history and changes.

---

**Last Updated**: 2024-08-26  
**Version**: 1.0.0  
**Maintainer**: PromptWizard DevOps Team