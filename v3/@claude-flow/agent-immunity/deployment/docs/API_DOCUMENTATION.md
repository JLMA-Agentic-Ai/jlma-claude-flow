# AIS Plugin API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Health Check API](#health-check-api)
4. [Immunity Status API](#immunity-status-api)
5. [Metrics API](#metrics-api)
6. [Configuration API](#configuration-api)
7. [WebSocket Events](#websocket-events)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [SDK Integration](#sdk-integration)

## Overview

The AIS Plugin exposes RESTful APIs for monitoring immunity system health, retrieving metrics, and configuring immunity parameters in real-time.

### Base URLs

- **Development**: `http://localhost:8080`
- **Production**: `https://ais.claude-flow.com`
- **Kubernetes**: `http://ais-plugin-service.claude-flow.svc.cluster.local:8080`

### API Versioning

All APIs are versioned using URL path versioning:
- Current version: `v1`
- Example: `/api/v1/immunity/status`

### Content Types

- **Request**: `application/json`
- **Response**: `application/json`
- **Metrics**: `text/plain` (Prometheus format)

## Authentication

### API Key Authentication

For production deployments, API access requires authentication:

```bash
# Include API key in requests
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://ais.claude-flow.com/api/v1/health
```

### mTLS (Mutual TLS)

For high-security environments, mTLS is supported:

```bash
# Client certificate authentication
curl --cert client.pem \
     --key client-key.pem \
     --cacert ca.pem \
     https://ais.claude-flow.com/api/v1/health
```

## Health Check API

### GET /health

Basic health check endpoint for load balancers and monitoring systems.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-25T10:30:00.000Z",
  "uptime": 3600,
  "responseTime": 12,
  "service": "ais-plugin",
  "version": "3.0.0-alpha.1",
  "dependencies": {
    "memory": {
      "status": "healthy",
      "used": "128MB",
      "total": "256MB",
      "percentage": 50
    },
    "redis": "connected",
    "filesystem": "accessible",
    "network": "reachable"
  }
}
```

**Status Codes:**
- `200`: Service healthy
- `503`: Service unhealthy

### GET /ready

Kubernetes readiness probe endpoint.

**Response:**
```json
{
  "ready": true,
  "timestamp": "2026-01-25T10:30:00.000Z",
  "responseTime": 8,
  "violationRate": 0.02,
  "threshold": 0.8
}
```

**Status Codes:**
- `200`: Service ready
- `503`: Service not ready

### GET /live

Kubernetes liveness probe endpoint.

**Response:**
```json
{
  "alive": true,
  "timestamp": "2026-01-25T10:30:00.000Z",
  "pid": 1,
  "memory": {
    "heapUsed": 45.2,
    "heapTotal": 89.1
  }
}
```

## Immunity Status API

### GET /api/v1/immunity/status

Comprehensive immunity system status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-25T10:30:00.000Z",
  "responseTime": 15,
  "immunities": {
    "security": {
      "status": "healthy",
      "violations": 0,
      "threshold": 0.8,
      "lastViolation": null,
      "config": {
        "enabled": true,
        "weight": 1.0,
        "sensitivity": "high"
      }
    },
    "truth": {
      "status": "healthy",
      "violations": 2,
      "threshold": 0.8,
      "lastViolation": "2026-01-25T09:45:00.000Z",
      "config": {
        "enabled": true,
        "weight": 0.9,
        "sensitivity": "medium"
      }
    },
    "performance": {
      "status": "degraded",
      "violations": 5,
      "threshold": 0.8,
      "lastViolation": "2026-01-25T10:25:00.000Z",
      "config": {
        "enabled": true,
        "weight": 0.8,
        "sensitivity": "low"
      }
    },
    "coherence": {
      "status": "healthy",
      "violations": 1,
      "threshold": 0.8,
      "lastViolation": "2026-01-25T08:30:00.000Z"
    },
    "dependencies": {
      "status": "healthy",
      "violations": 0,
      "threshold": 0.8,
      "lastViolation": null
    }
  },
  "violations": {
    "total": 8,
    "rate": 0.02,
    "lastOccurred": "2026-01-25T10:25:00.000Z",
    "breakdown": {
      "security": 0,
      "truth": 2,
      "performance": 5,
      "coherence": 1,
      "dependencies": 0
    }
  },
  "thresholds": {
    "immunity": 0.8,
    "responseTime": 30
  },
  "performance": {
    "totalRequests": 1250,
    "averageResponseTime": 18.5,
    "successRate": 0.98
  }
}
```

### GET /api/v1/immunity/violations

Recent immunity violations with details.

**Query Parameters:**
- `limit` (optional): Number of violations to return (default: 50, max: 500)
- `since` (optional): ISO timestamp to filter violations after
- `immunity` (optional): Filter by specific immunity type

**Example:**
```bash
GET /api/v1/immunity/violations?limit=10&since=2026-01-25T00:00:00Z&immunity=security
```

**Response:**
```json
{
  "violations": [
    {
      "id": "viol_123456789",
      "timestamp": "2026-01-25T10:25:00.000Z",
      "immunity": "performance",
      "severity": "medium",
      "agent": {
        "id": "agent_abc123",
        "type": "coder",
        "context": "feature-implementation"
      },
      "trigger": {
        "type": "response_time",
        "value": 45.2,
        "threshold": 30,
        "description": "Agent response time exceeded performance SLA"
      },
      "action": {
        "type": "throttle",
        "applied": true,
        "details": "Reduced agent priority and allocated additional resources"
      },
      "resolved": false,
      "resolution": null
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 10,
    "offset": 0,
    "hasNext": true
  },
  "summary": {
    "byImmunity": {
      "security": 12,
      "truth": 34,
      "performance": 89,
      "coherence": 15,
      "dependencies": 6
    },
    "bySeverity": {
      "low": 98,
      "medium": 45,
      "high": 12,
      "critical": 1
    }
  }
}
```

### POST /api/v1/immunity/reset

Reset immunity violation counts and states.

**Request Body:**
```json
{
  "immunities": ["performance", "coherence"],
  "resetCounts": true,
  "resetStates": false,
  "reason": "Scheduled maintenance reset"
}
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-01-25T10:30:00.000Z",
  "reset": {
    "immunities": ["performance", "coherence"],
    "countsReset": true,
    "statesReset": false
  },
  "previousCounts": {
    "performance": 5,
    "coherence": 1
  }
}
```

## Metrics API

### GET /metrics

Prometheus-compatible metrics endpoint.

**Response Format:** `text/plain`

**Example Response:**
```
# HELP ais_immunity_violations_total Total number of immunity violations
# TYPE ais_immunity_violations_total counter
ais_immunity_violations_total{immunity="security"} 0
ais_immunity_violations_total{immunity="truth"} 2
ais_immunity_violations_total{immunity="performance"} 5
ais_immunity_violations_total{immunity="coherence"} 1
ais_immunity_violations_total{immunity="dependencies"} 0

# HELP ais_response_time_ms Response time in milliseconds
# TYPE ais_response_time_ms gauge
ais_response_time_ms 18.5

# HELP ais_uptime_seconds Service uptime in seconds
# TYPE ais_uptime_seconds gauge
ais_uptime_seconds 3600

# HELP ais_requests_total Total number of requests
# TYPE ais_requests_total counter
ais_requests_total 1250

# HELP ais_immunity_status Immunity status (1=healthy, 0=unhealthy)
# TYPE ais_immunity_status gauge
ais_immunity_status{immunity="security"} 1
ais_immunity_status{immunity="truth"} 1
ais_immunity_status{immunity="performance"} 0
ais_immunity_status{immunity="coherence"} 1
ais_immunity_status{immunity="dependencies"} 1

# HELP ais_memory_usage_bytes Memory usage in bytes
# TYPE ais_memory_usage_bytes gauge
ais_memory_usage_bytes{type="heap_used"} 47324160
ais_memory_usage_bytes{type="heap_total"} 93454336

# HELP ais_agent_count Number of active agents
# TYPE ais_agent_count gauge
ais_agent_count{status="active"} 12
ais_agent_count{status="idle"} 3
ais_agent_count{status="violation"} 1
```

### GET /api/v1/metrics/summary

Human-readable metrics summary.

**Response:**
```json
{
  "summary": {
    "status": "degraded",
    "uptime": "1h 23m 45s",
    "violationRate": 0.02,
    "responseTime": {
      "current": 18.5,
      "average": 15.2,
      "p95": 25.8,
      "p99": 42.1
    },
    "immunities": {
      "healthy": 4,
      "degraded": 1,
      "unhealthy": 0
    },
    "agents": {
      "total": 16,
      "active": 12,
      "idle": 3,
      "violations": 1
    }
  },
  "trends": {
    "violations": {
      "1h": 8,
      "24h": 156,
      "7d": 892
    },
    "performance": {
      "improving": false,
      "trend": "stable",
      "changePercent": -2.1
    }
  },
  "alerts": [
    {
      "level": "warning",
      "message": "Performance immunity degraded due to high response times",
      "since": "2026-01-25T10:25:00.000Z"
    }
  ]
}
```

## Configuration API

### GET /api/v1/config

Current immunity system configuration.

**Response:**
```json
{
  "version": "3.0.0-alpha.1",
  "timestamp": "2026-01-25T10:30:00.000Z",
  "immunities": {
    "security": {
      "enabled": true,
      "weight": 1.0,
      "threshold": 0.8,
      "sensitivity": "high",
      "config": {
        "maxViolations": 5,
        "cooldownPeriod": 300,
        "escalationLevel": "critical"
      }
    },
    "truth": {
      "enabled": true,
      "weight": 0.9,
      "threshold": 0.75,
      "sensitivity": "medium",
      "config": {
        "factCheckingEnabled": true,
        "sourceValidation": true,
        "consistencyChecks": true
      }
    },
    "performance": {
      "enabled": true,
      "weight": 0.8,
      "threshold": 0.8,
      "sensitivity": "low",
      "config": {
        "responseTimeTarget": 30,
        "memoryLimit": 512,
        "cpuThreshold": 0.8
      }
    },
    "coherence": {
      "enabled": true,
      "weight": 0.7,
      "threshold": 0.8,
      "sensitivity": "medium"
    },
    "dependencies": {
      "enabled": true,
      "weight": 0.6,
      "threshold": 0.8,
      "sensitivity": "high"
    }
  },
  "global": {
    "masterEnabled": true,
    "emergencyShutdown": false,
    "debugMode": false,
    "logLevel": "info",
    "metricsRetention": "7d"
  }
}
```

### PUT /api/v1/config

Update immunity system configuration.

**Request Body:**
```json
{
  "immunities": {
    "performance": {
      "threshold": 0.85,
      "config": {
        "responseTimeTarget": 25
      }
    }
  },
  "global": {
    "logLevel": "debug"
  }
}
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-01-25T10:30:00.000Z",
  "applied": {
    "immunities.performance.threshold": {
      "from": 0.8,
      "to": 0.85
    },
    "immunities.performance.config.responseTimeTarget": {
      "from": 30,
      "to": 25
    },
    "global.logLevel": {
      "from": "info",
      "to": "debug"
    }
  },
  "validation": {
    "errors": [],
    "warnings": [
      "Lower response time target may increase violation rate"
    ]
  }
}
```

### POST /api/v1/config/validate

Validate configuration changes without applying them.

**Request Body:** (Same as PUT /api/v1/config)

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": [
    "Lower response time target may increase violation rate"
  ],
  "impact": {
    "estimatedViolationIncrease": 15,
    "affectedAgents": 8,
    "performanceImpact": "low"
  }
}
```

## WebSocket Events

Real-time event streaming via WebSocket connection.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:8080/api/v1/events');

ws.onopen = function() {
    // Subscribe to specific event types
    ws.send(JSON.stringify({
        action: 'subscribe',
        events: ['violations', 'status_changes', 'alerts']
    }));
};
```

### Event Types

#### Violation Events

```json
{
  "type": "violation",
  "timestamp": "2026-01-25T10:30:00.000Z",
  "data": {
    "id": "viol_123456789",
    "immunity": "performance",
    "severity": "medium",
    "agent": {
      "id": "agent_abc123",
      "type": "coder"
    },
    "trigger": {
      "type": "response_time",
      "value": 45.2,
      "threshold": 30
    }
  }
}
```

#### Status Change Events

```json
{
  "type": "status_change",
  "timestamp": "2026-01-25T10:30:00.000Z",
  "data": {
    "immunity": "performance",
    "previous": "healthy",
    "current": "degraded",
    "reason": "Multiple response time violations"
  }
}
```

#### Alert Events

```json
{
  "type": "alert",
  "timestamp": "2026-01-25T10:30:00.000Z",
  "data": {
    "level": "warning",
    "source": "immunity_monitor",
    "message": "Performance immunity degraded",
    "details": {
      "immunity": "performance",
      "violationCount": 5,
      "threshold": 0.8
    }
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "IMMUNITY_VIOLATION",
    "message": "Performance immunity threshold exceeded",
    "details": {
      "immunity": "performance",
      "threshold": 0.8,
      "current": 0.65
    },
    "timestamp": "2026-01-25T10:30:00.000Z",
    "requestId": "req_123456789"
  }
}
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `IMMUNITY_VIOLATION` | Immunity threshold exceeded | 422 |
| `INVALID_CONFIG` | Configuration validation failed | 400 |
| `UNAUTHORIZED` | Authentication required | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `RATE_LIMITED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable | 503 |

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Health checks**: 60 requests/minute
- **Status endpoints**: 30 requests/minute
- **Configuration**: 10 requests/minute
- **Metrics**: 120 requests/minute

**Rate Limit Headers:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
```

## SDK Integration

### Node.js SDK

```javascript
const { AISClient } = require('@claude-flow/agent-immunity');

const client = new AISClient({
    baseURL: 'http://localhost:8080',
    apiKey: 'your-api-key'
});

// Check immunity status
const status = await client.immunity.getStatus();
console.log('Immunity status:', status);

// Subscribe to violations
client.events.onViolation((violation) => {
    console.log('New violation:', violation);
});

// Configure immunities
await client.config.update({
    immunities: {
        performance: { threshold: 0.85 }
    }
});
```

### Python SDK

```python
from claude_flow.immunity import AISClient

client = AISClient(
    base_url="http://localhost:8080",
    api_key="your-api-key"
)

# Check immunity status
status = client.immunity.get_status()
print(f"Immunity status: {status}")

# Monitor violations
for violation in client.events.watch_violations():
    print(f"New violation: {violation}")
```

### CLI Integration

```bash
# Install CLI
npm install -g @claude-flow/cli

# Configure endpoint
claude config set immunity.endpoint http://localhost:8080
claude config set immunity.apiKey your-api-key

# Check status
claude immunity status

# Monitor violations
claude immunity watch --violations

# Update configuration
claude immunity config update --performance-threshold 0.85
```

For more detailed examples and advanced usage, see the [SDK documentation](https://docs.claude-flow.com/immunity/sdk) and [API reference](https://api.claude-flow.com/immunity).