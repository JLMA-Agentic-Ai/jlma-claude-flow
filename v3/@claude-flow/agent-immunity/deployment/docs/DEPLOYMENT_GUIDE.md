# AIS Plugin Production Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Options](#deployment-options)
4. [Security Configuration](#security-configuration)
5. [Monitoring Setup](#monitoring-setup)
6. [Performance Tuning](#performance-tuning)
7. [Troubleshooting](#troubleshooting)
8. [Operational Procedures](#operational-procedures)

## Overview

The Agent Immunity System (AIS) Plugin is designed for high-availability production deployment with comprehensive monitoring, security hardening, and operational excellence.

### Architecture Components

- **AIS Core**: Main immunity service with health checks
- **Redis**: Memory cache for immunity state
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Monitoring dashboards and visualization
- **Health Check Service**: Dedicated health monitoring

### Performance Targets

| Metric | Target | Monitoring |
|--------|---------|------------|
| Response Time | <30ms | Prometheus alerts |
| Uptime | 99.9% | SLA tracking |
| Immunity Violations | <5% | Real-time alerts |
| Memory Usage | <512MB | Resource monitoring |
| CPU Usage | <1 core | Auto-scaling triggers |

## Prerequisites

### System Requirements

- **Docker**: Version 20.10+ with Compose v2
- **Kubernetes**: Version 1.20+ (for K8s deployment)
- **Node.js**: Version 20+ (for local development)
- **Memory**: Minimum 2GB RAM available
- **Storage**: 10GB available disk space

### Network Requirements

- **Inbound Ports**: 8080 (health), 9090 (metrics), 3000 (Grafana)
- **Outbound**: Redis (6379), External APIs as needed
- **Internal**: Service mesh communication (if applicable)

### Security Requirements

- SSL/TLS certificates for production
- Secrets management system (Vault, K8s secrets)
- Network policies configured
- RBAC permissions set up

## Deployment Options

### Option 1: Docker Compose (Recommended for Testing)

**Quick Start:**
```bash
# Clone and navigate to deployment directory
cd v3/@claude-flow/agent-immunity/deployment

# Set environment variables
export REDIS_PASSWORD="secure-production-password"
export GRAFANA_PASSWORD="admin-dashboard-password"

# Deploy all services
./scripts/deploy.sh -t docker -e production
```

**Manual Steps:**
```bash
# Build and start services
cd docker/
docker-compose up -d

# Verify deployment
docker-compose ps
curl http://localhost:8080/health
```

### Option 2: Kubernetes (Production Recommended)

**Prerequisites:**
- Kubernetes cluster with RBAC enabled
- kubectl configured and connected
- Helm 3.x installed (for monitoring stack)

**Deployment:**
```bash
# Create namespace and secrets
kubectl create namespace claude-flow
kubectl create secret generic ais-secrets \
    --from-literal=redis_password="secure-redis-password" \
    -n claude-flow

# Deploy AIS Plugin
./scripts/deploy.sh -t kubernetes -n claude-flow -e production

# Verify deployment
kubectl get pods -n claude-flow
kubectl get services -n claude-flow
```

### Option 3: Canary Deployment

For zero-downtime updates with gradual traffic shifting:

```bash
# Deploy 10% traffic to new version
./scripts/deploy.sh -t kubernetes -c 10 --canary

# Monitor for 10 minutes, then promote to 100%
./scripts/deploy.sh -t kubernetes -c 100
```

## Security Configuration

### Container Security

The deployment includes multiple security hardening measures:

1. **Non-root execution**: All containers run as non-root users
2. **Read-only filesystems**: Root filesystem is read-only where possible
3. **Dropped capabilities**: All unnecessary Linux capabilities removed
4. **Security contexts**: Applied at pod and container levels

### Network Security

```yaml
# Network policies (apply separately)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ais-network-policy
spec:
  podSelector:
    matchLabels:
      app: ais-plugin
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: monitoring
    ports:
    - protocol: TCP
      port: 9090
```

### Secrets Management

**Environment Variables:**
- `REDIS_PASSWORD`: Redis authentication
- `GRAFANA_PASSWORD`: Grafana admin password
- `TLS_CERT_PATH`: SSL certificate path
- `TLS_KEY_PATH`: SSL private key path

**Kubernetes Secrets:**
```bash
# Create TLS secret
kubectl create secret tls ais-tls \
    --cert=path/to/tls.crt \
    --key=path/to/tls.key \
    -n claude-flow

# Create Redis password secret
kubectl create secret generic ais-redis \
    --from-literal=password="$(openssl rand -base64 32)" \
    -n claude-flow
```

## Monitoring Setup

### Prometheus Configuration

The deployment includes pre-configured Prometheus with:
- AIS Plugin metrics scraping
- Redis exporter integration
- Node exporter for system metrics
- Custom alerting rules

**Key Metrics:**
- `ais_immunity_violations_total`: Cumulative immunity violations
- `ais_response_time_ms`: Service response time
- `ais_immunity_status`: Individual immunity health status
- `ais_uptime_seconds`: Service uptime

### Grafana Dashboards

Access Grafana at `http://localhost:3000` (Docker) or via LoadBalancer (K8s):
- **Username**: admin
- **Password**: Set via `GRAFANA_PASSWORD` env var

**Pre-configured Dashboards:**
- AIS Production Overview
- Immunity Violations Analysis
- Performance Metrics
- Infrastructure Health

### Alert Configuration

Critical alerts configured in Prometheus:

| Alert | Trigger | Severity | Action |
|-------|---------|----------|---------|
| ImmunityViolationHigh | >5 violations/5min | Critical | Immediate investigation |
| ServiceDown | Health check fails | Critical | Auto-restart, escalate |
| ResponseTimeSLA | >30ms for 1min | Warning | Performance review |
| SecurityImmunityFail | Security immunity down | Critical | Security team alert |

## Performance Tuning

### Resource Optimization

**Memory Tuning:**
```yaml
# Kubernetes resource limits
resources:
  limits:
    memory: "512Mi"
    cpu: "1000m"
  requests:
    memory: "128Mi"
    cpu: "100m"
```

**Redis Configuration:**
```bash
# Optimized Redis settings
redis-server \
    --maxmemory 200mb \
    --maxmemory-policy allkeys-lru \
    --appendonly yes \
    --appendfsync everysec
```

### Auto-scaling Configuration

**Horizontal Pod Autoscaler (HPA):**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ais-plugin-hpa
spec:
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: ais_response_time_ms
      target:
        type: AverageValue
        averageValue: "25"
```

### Load Testing

Before production deployment, run load tests:

```bash
# Install load testing tools
npm install -g artillery

# Run performance tests
artillery run deployment/tests/load-test.yml

# Expected results:
# - Response time p95 < 30ms
# - Error rate < 1%
# - Immunity violations < 5%
```

## Troubleshooting

### Common Issues

**1. High Memory Usage**
```bash
# Check memory consumption
kubectl top pods -n claude-flow
docker stats ais-core

# Solution: Increase memory limits or investigate leaks
kubectl patch deployment ais-plugin -p '{"spec":{"template":{"spec":{"containers":[{"name":"ais-core","resources":{"limits":{"memory":"1Gi"}}}]}}}}'
```

**2. Immunity Violations Spike**
```bash
# Check immunity status
curl http://localhost:8080/immunity
kubectl logs -n claude-flow deployment/ais-plugin

# Common causes:
# - Agent context corruption
# - External service failures
# - Configuration drift
```

**3. Service Unavailable**
```bash
# Check service health
kubectl get pods -n claude-flow -l app=ais-plugin
kubectl describe pod <pod-name> -n claude-flow

# Check logs for errors
kubectl logs -n claude-flow deployment/ais-plugin --tail=100
```

**4. Prometheus/Grafana Issues**
```bash
# Restart monitoring stack
docker-compose restart ais-prometheus ais-grafana

# Check metrics endpoint
curl http://localhost:8080/metrics

# Verify Prometheus targets
curl http://localhost:9091/api/v1/targets
```

### Debug Commands

```bash
# Service status check
./scripts/deploy.sh --dry-run -t docker

# Container logs
docker logs ais-core --tail=100 -f

# Kubernetes debugging
kubectl get events -n claude-flow --sort-by='.lastTimestamp'
kubectl describe deployment ais-plugin -n claude-flow

# Health check debugging
curl -v http://localhost:8080/health
curl -v http://localhost:8080/immunity
curl -v http://localhost:8080/metrics
```

### Performance Debugging

```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8080/health

# Monitor resource usage
kubectl top pods -n claude-flow --containers

# Check Redis performance
redis-cli --latency-history -i 1

# Analyze metrics
curl http://localhost:9090/api/v1/query?query=ais_response_time_ms
```

## Operational Procedures

### Deployment Process

1. **Pre-deployment Checklist:**
   - [ ] Code reviewed and approved
   - [ ] Security scan completed
   - [ ] Load tests passed
   - [ ] Backup created
   - [ ] Monitoring alerts configured

2. **Deployment Steps:**
   ```bash
   # Production deployment
   ./scripts/deploy.sh -t kubernetes -e production -n claude-flow

   # Verify deployment
   kubectl rollout status deployment/ais-plugin -n claude-flow

   # Run smoke tests
   curl http://service-endpoint/health
   ```

3. **Post-deployment Validation:**
   - [ ] Health checks passing
   - [ ] Metrics being collected
   - [ ] Alerts functioning
   - [ ] Performance within SLA

### Rollback Procedures

**Immediate Rollback:**
```bash
# Kubernetes rollback
kubectl rollout undo deployment/ais-plugin -n claude-flow

# Docker rollback
docker-compose down
docker-compose up -d --scale ais-core=0
docker-compose up -d
```

**Restore from Backup:**
```bash
# Find backup location
ls /var/backups/ais-plugin/

# Restore configuration
kubectl apply -f /var/backups/ais-plugin/20240125_143000/k8s-resources.yaml
```

### Maintenance Windows

**Regular Maintenance Tasks:**
- Weekly: Review monitoring dashboards
- Monthly: Update dependencies and security patches
- Quarterly: Performance optimization review

**Scheduled Maintenance:**
```bash
# Scale down for maintenance
kubectl scale deployment ais-plugin --replicas=0 -n claude-flow

# Perform maintenance tasks
# - Update configurations
# - Apply security patches
# - Database maintenance

# Scale back up
kubectl scale deployment ais-plugin --replicas=3 -n claude-flow
```

### Backup and Recovery

**Automated Backups:**
```bash
# Daily configuration backup
kubectl get all,configmaps,secrets -n claude-flow -o yaml > backup-$(date +%Y%m%d).yaml

# Redis data backup
docker exec ais-redis redis-cli BGSAVE
docker cp ais-redis:/data/dump.rdb ./backup/
```

**Disaster Recovery:**
1. Assess extent of failure
2. Restore from most recent backup
3. Verify data integrity
4. Resume service operations
5. Conduct post-incident review

### Monitoring and Alerting

**Daily Operations:**
- Check Grafana dashboards for anomalies
- Review alert notifications
- Monitor resource utilization trends
- Verify backup completion

**Weekly Reviews:**
- Analyze performance trends
- Review immunity violation patterns
- Update capacity planning
- Security posture assessment

For additional support and advanced configuration options, refer to the [Claude Flow documentation](https://github.com/ruvnet/claude-flow) or contact the support team.