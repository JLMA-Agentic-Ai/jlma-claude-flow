# AIS Plugin Performance Tuning Guide

## Table of Contents

1. [Overview](#overview)
2. [Performance Targets](#performance-targets)
3. [System Configuration](#system-configuration)
4. [Memory Optimization](#memory-optimization)
5. [CPU Optimization](#cpu-optimization)
6. [Network Performance](#network-performance)
7. [Database Tuning](#database-tuning)
8. [Monitoring and Profiling](#monitoring-and-profiling)
9. [Load Testing](#load-testing)
10. [Troubleshooting](#troubleshooting)

## Overview

The AIS Plugin is designed for high-performance operation with sub-30ms response times and 99.9% uptime. This guide provides comprehensive tuning strategies for optimal performance in production environments.

### Architecture Performance Characteristics

| Component | Performance Target | Optimization Strategy |
|-----------|-------------------|----------------------|
| Immunity Detection | <5ms processing | In-memory pattern matching |
| Health Checks | <10ms response | Cached status aggregation |
| Metrics Collection | <15ms collection | Batch processing |
| Configuration Updates | <20ms apply | Hot-reload mechanisms |
| API Endpoints | <30ms response | Connection pooling + caching |

## Performance Targets

### Service Level Objectives (SLOs)

| Metric | Target | Measurement | Alert Threshold |
|--------|--------|-------------|----------------|
| Response Time (p95) | <30ms | Per-request timing | >40ms |
| Response Time (p99) | <50ms | Per-request timing | >75ms |
| Uptime | 99.9% | Health check success | <99.5% |
| Immunity Processing | <5ms | Processing latency | >10ms |
| Memory Usage | <512MB | RSS memory | >768MB |
| CPU Usage | <50% | Average utilization | >70% |
| Violation Rate | <5% | Successful immunity checks | >10% |

### Capacity Planning

```yaml
# Resource requirements by deployment size
small_deployment:
  agents: 1-10
  cpu: 0.5 cores
  memory: 256MB
  network: 100Mbps

medium_deployment:
  agents: 10-50
  cpu: 1.0 cores
  memory: 512MB
  network: 500Mbps

large_deployment:
  agents: 50-200
  cpu: 2.0 cores
  memory: 1GB
  network: 1Gbps

enterprise_deployment:
  agents: 200+
  cpu: 4.0 cores
  memory: 2GB
  network: 10Gbps
```

## System Configuration

### Operating System Tuning

**Linux Kernel Parameters:**
```bash
# /etc/sysctl.conf optimizations
# Network performance
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 12582912 16777216
net.ipv4.tcp_wmem = 4096 12582912 16777216
net.core.netdev_max_backlog = 5000

# File descriptor limits
fs.file-max = 2097152
fs.nr_open = 2097152

# Memory management
vm.swappiness = 1
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# Apply changes
sudo sysctl -p
```

**Process Limits:**
```bash
# /etc/security/limits.conf
ais-user soft nofile 65536
ais-user hard nofile 65536
ais-user soft nproc 32768
ais-user hard nproc 32768
```

### Container Optimization

**Docker Configuration:**
```dockerfile
# Optimized Dockerfile settings
FROM node:20-alpine

# Use jemalloc for better memory management
RUN apk add --no-cache libc6-compat jemalloc
ENV LD_PRELOAD=/usr/lib/libjemalloc.so.2

# Optimize Node.js settings
ENV NODE_OPTIONS="--max-old-space-size=512 --gc-global --trace-gc"
ENV UV_THREADPOOL_SIZE=32

# Enable V8 optimizations
ENV V8_FLAGS="--max-old-space-size=512 --optimize-for-size"
```

**Kubernetes Resource Configuration:**
```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: ais-core
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 1000m
        memory: 512Mi
    env:
    - name: NODE_OPTIONS
      value: "--max-old-space-size=512 --gc-global"
    - name: UV_THREADPOOL_SIZE
      value: "32"
```

## Memory Optimization

### Node.js Memory Management

**Garbage Collection Tuning:**
```bash
# Production environment variables
export NODE_OPTIONS="
  --max-old-space-size=512
  --gc-global
  --trace-gc-verbose
  --expose-gc
"

# Monitor GC performance
node --trace-gc app.js 2>&1 | grep "gc"
```

**Memory Leak Detection:**
```javascript
// Memory monitoring in application
const v8 = require('v8');

class MemoryMonitor {
    constructor() {
        this.startTime = Date.now();
        this.startMemory = process.memoryUsage();

        // Monitor every 30 seconds
        setInterval(() => this.checkMemory(), 30000);
    }

    checkMemory() {
        const usage = process.memoryUsage();
        const heapTotal = Math.round(usage.heapTotal / 1024 / 1024);
        const heapUsed = Math.round(usage.heapUsed / 1024 / 1024);
        const external = Math.round(usage.external / 1024 / 1024);

        // Alert if memory usage is growing
        if (heapUsed > 400) {
            console.warn(`High memory usage: ${heapUsed}MB`);

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
        }

        // Log V8 heap statistics
        const heapStats = v8.getHeapStatistics();
        console.log({
            heapUsed: `${heapUsed}MB`,
            heapTotal: `${heapTotal}MB`,
            external: `${external}MB`,
            mallocedMemory: Math.round(heapStats.malloced_memory / 1024 / 1024),
            peakMallocedMemory: Math.round(heapStats.peak_malloced_memory / 1024 / 1024)
        });
    }
}

// Initialize memory monitoring
const memoryMonitor = new MemoryMonitor();
```

### Caching Strategy

**Redis Configuration:**
```bash
# redis.conf optimizations
maxmemory 200mb
maxmemory-policy allkeys-lru
maxmemory-samples 10

# Persistence settings for performance
save 900 1
save 300 10
save 60 10000

# Network optimizations
timeout 300
tcp-keepalive 300
tcp-backlog 511

# Memory usage optimizations
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
list-compress-depth 0
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
```

**Application-Level Caching:**
```javascript
// LRU cache for immunity status
const LRU = require('lru-cache');

class ImmunityCache {
    constructor() {
        this.cache = new LRU({
            max: 1000,
            maxAge: 30000, // 30 seconds
            updateAgeOnGet: true
        });

        this.hitRate = 0;
        this.totalRequests = 0;
    }

    get(key) {
        this.totalRequests++;
        const value = this.cache.get(key);

        if (value !== undefined) {
            this.hitRate = ((this.hitRate * (this.totalRequests - 1)) + 1) / this.totalRequests;
        }

        return value;
    }

    set(key, value) {
        return this.cache.set(key, value);
    }

    getHitRate() {
        return this.hitRate;
    }
}
```

## CPU Optimization

### Event Loop Optimization

**Monitor Event Loop Lag:**
```javascript
const { performance } = require('perf_hooks');

class EventLoopMonitor {
    constructor() {
        this.samples = [];
        this.startMonitoring();
    }

    startMonitoring() {
        const start = performance.now();

        setImmediate(() => {
            const lag = performance.now() - start;
            this.samples.push(lag);

            // Keep only last 100 samples
            if (this.samples.length > 100) {
                this.samples.shift();
            }

            // Alert on high lag
            if (lag > 10) {
                console.warn(`Event loop lag: ${lag.toFixed(2)}ms`);
            }

            // Schedule next check
            setTimeout(() => this.startMonitoring(), 1000);
        });
    }

    getAverageLag() {
        if (this.samples.length === 0) return 0;
        return this.samples.reduce((sum, lag) => sum + lag, 0) / this.samples.length;
    }
}
```

**CPU-Intensive Task Optimization:**
```javascript
// Use worker threads for CPU-intensive immunity checks
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

class ImmunityProcessor {
    constructor() {
        this.workers = [];
        this.taskQueue = [];
        this.workerCount = require('os').cpus().length;

        // Initialize worker pool
        for (let i = 0; i < this.workerCount; i++) {
            this.createWorker();
        }
    }

    createWorker() {
        const worker = new Worker(__filename, {
            workerData: { isWorker: true }
        });

        worker.on('message', (result) => {
            // Handle worker response
            this.handleWorkerResponse(result);
        });

        this.workers.push(worker);
    }

    async processImmunity(agentData) {
        return new Promise((resolve, reject) => {
            const task = {
                id: Date.now() + Math.random(),
                data: agentData,
                resolve,
                reject
            };

            this.taskQueue.push(task);
            this.assignTask();
        });
    }

    assignTask() {
        const availableWorker = this.workers.find(w => !w.busy);
        const task = this.taskQueue.shift();

        if (availableWorker && task) {
            availableWorker.busy = true;
            availableWorker.currentTask = task;
            availableWorker.postMessage(task);
        }
    }
}

// Worker thread code
if (!isMainThread && workerData.isWorker) {
    parentPort.on('message', (task) => {
        // Perform CPU-intensive immunity processing
        const result = performImmunityCheck(task.data);
        parentPort.postMessage({ taskId: task.id, result });
    });
}
```

### Process Prioritization

**Nice Values and CPU Affinity:**
```bash
# Set process priority
nice -n -10 node app.js

# Set CPU affinity for multi-core systems
taskset -c 0,1 node app.js

# Monitor CPU usage
top -p $(pgrep -f "node.*app.js")
```

## Network Performance

### HTTP/2 and Connection Optimization

**Express.js HTTP/2 Setup:**
```javascript
const http2 = require('http2');
const express = require('express');
const spdy = require('spdy');

class OptimizedServer {
    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Enable compression
        this.app.use(require('compression')({
            threshold: 1024,
            level: 6,
            memLevel: 8
        }));

        // Connection keep-alive
        this.app.use((req, res, next) => {
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Keep-Alive', 'timeout=5, max=1000');
            next();
        });

        // ETag support
        this.app.set('etag', 'strong');
    }

    startServer() {
        const options = {
            // HTTP/2 server options
            spdy: {
                protocols: ['h2', 'http/1.1'],
                plain: false,
                connection: {
                    windowSize: 1024 * 1024,
                    autoSpdy31: false
                }
            }
        };

        const server = spdy.createServer(options, this.app);

        server.listen(8080, () => {
            console.log('HTTP/2 server listening on port 8080');
        });

        return server;
    }
}
```

### Connection Pooling

**HTTP Client Optimization:**
```javascript
const http = require('http');
const https = require('https');

// Configure HTTP agent with connection pooling
const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 5000
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 5000
});

// Use with requests
const axios = require('axios');
const client = axios.create({
    httpAgent,
    httpsAgent,
    timeout: 5000
});
```

## Database Tuning

### Redis Performance Optimization

**Connection Pool Configuration:**
```javascript
const Redis = require('ioredis');

class OptimizedRedisClient {
    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,

            // Connection pool settings
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            enableReadyCheck: true,

            // Performance settings
            lazyConnect: true,
            keepAlive: 30000,
            commandTimeout: 5000,

            // Connection pool
            family: 4,
            maxMemoryPolicy: 'allkeys-lru',

            // Pipeline support
            enableOfflineQueue: false
        });

        this.setupPipeline();
    }

    setupPipeline() {
        // Batch operations for better performance
        this.pipeline = this.redis.pipeline();
        this.pipelineQueue = [];

        // Flush pipeline every 100ms or 50 commands
        setInterval(() => this.flushPipeline(), 100);
    }

    async batchSet(keyValues) {
        const pipeline = this.redis.pipeline();

        for (const [key, value] of keyValues) {
            pipeline.set(key, JSON.stringify(value), 'EX', 300);
        }

        return await pipeline.exec();
    }

    async flushPipeline() {
        if (this.pipelineQueue.length === 0) return;

        const pipeline = this.redis.pipeline();
        const callbacks = [];

        for (const item of this.pipelineQueue) {
            pipeline[item.command](...item.args);
            callbacks.push(item.callback);
        }

        try {
            const results = await pipeline.exec();
            results.forEach((result, index) => {
                if (callbacks[index]) {
                    callbacks[index](result[0], result[1]);
                }
            });
        } catch (error) {
            callbacks.forEach(cb => cb && cb(error));
        }

        this.pipelineQueue = [];
    }
}
```

### Memory Database Optimization

**SQLite Performance Configuration:**
```javascript
const Database = require('better-sqlite3');

class OptimizedDatabase {
    constructor(path) {
        this.db = new Database(path, {
            memory: false,
            readonly: false,
            fileMustExist: false,
            timeout: 5000,
            verbose: process.env.NODE_ENV === 'development' ? console.log : null
        });

        this.configurePragmas();
        this.prepareStatements();
    }

    configurePragmas() {
        // Performance optimizations
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('cache_size = 10000');
        this.db.pragma('temp_store = MEMORY');
        this.db.pragma('mmap_size = 268435456'); // 256MB
    }

    prepareStatements() {
        // Pre-prepare frequently used statements
        this.statements = {
            insertViolation: this.db.prepare(`
                INSERT INTO violations (timestamp, immunity, agent_id, details)
                VALUES (?, ?, ?, ?)
            `),

            getViolationCount: this.db.prepare(`
                SELECT COUNT(*) as count
                FROM violations
                WHERE timestamp > ?
                AND immunity = ?
            `),

            updateImmunityStatus: this.db.prepare(`
                UPDATE immunity_status
                SET status = ?, last_violation = ?, violation_count = ?
                WHERE immunity = ?
            `)
        };
    }

    insertViolationBatch(violations) {
        const transaction = this.db.transaction((violations) => {
            for (const violation of violations) {
                this.statements.insertViolation.run(
                    violation.timestamp,
                    violation.immunity,
                    violation.agentId,
                    JSON.stringify(violation.details)
                );
            }
        });

        return transaction(violations);
    }
}
```

## Monitoring and Profiling

### Application Performance Monitoring (APM)

**Custom Performance Monitoring:**
```javascript
const { PerformanceObserver, performance } = require('perf_hooks');

class PerformanceTracker {
    constructor() {
        this.metrics = new Map();
        this.setupObservers();
    }

    setupObservers() {
        // HTTP request timing
        const httpObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                this.recordMetric('http_requests', {
                    duration: entry.duration,
                    method: entry.detail?.method,
                    statusCode: entry.detail?.statusCode
                });
            }
        });
        httpObserver.observe({ entryTypes: ['measure'] });

        // GC timing
        const gcObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                this.recordMetric('gc_events', {
                    duration: entry.duration,
                    kind: entry.detail?.kind
                });
            }
        });
        gcObserver.observe({ entryTypes: ['gc'] });
    }

    async measureAsync(name, fn) {
        const start = performance.now();
        try {
            const result = await fn();
            const duration = performance.now() - start;
            this.recordMetric(name, { duration, success: true });
            return result;
        } catch (error) {
            const duration = performance.now() - start;
            this.recordMetric(name, { duration, success: false, error: error.message });
            throw error;
        }
    }

    recordMetric(name, data) {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }

        const metric = {
            timestamp: Date.now(),
            ...data
        };

        this.metrics.get(name).push(metric);

        // Keep only last 1000 entries per metric
        const entries = this.metrics.get(name);
        if (entries.length > 1000) {
            entries.shift();
        }
    }

    getMetrics() {
        const summary = {};

        for (const [name, entries] of this.metrics) {
            const durations = entries.map(e => e.duration).filter(d => d !== undefined);

            if (durations.length > 0) {
                summary[name] = {
                    count: entries.length,
                    avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
                    min: Math.min(...durations),
                    max: Math.max(...durations),
                    p95: this.percentile(durations, 95),
                    p99: this.percentile(durations, 99)
                };
            }
        }

        return summary;
    }

    percentile(arr, p) {
        const sorted = arr.slice().sort((a, b) => a - b);
        const index = (p / 100) * (sorted.length - 1);

        if (Math.floor(index) === index) {
            return sorted[index];
        }

        const lower = sorted[Math.floor(index)];
        const upper = sorted[Math.ceil(index)];
        const weight = index % 1;

        return lower * (1 - weight) + upper * weight;
    }
}

// Initialize performance tracker
const performanceTracker = new PerformanceTracker();
```

### CPU Profiling

**V8 CPU Profiler Integration:**
```javascript
const v8Profiler = require('v8-profiler-next');

class CPUProfiler {
    constructor() {
        this.isProfilerEnabled = process.env.ENABLE_PROFILER === 'true';
        this.profileDuration = 30000; // 30 seconds
        this.profileInterval = 300000; // 5 minutes

        if (this.isProfilerEnabled) {
            this.startPeriodicProfiling();
        }
    }

    startPeriodicProfiling() {
        setInterval(() => {
            this.profileCPU();
        }, this.profileInterval);
    }

    async profileCPU() {
        console.log('Starting CPU profile...');

        // Start profiling
        const title = `cpu-profile-${Date.now()}`;
        v8Profiler.startProfiling(title, true);

        // Profile for specified duration
        await new Promise(resolve => setTimeout(resolve, this.profileDuration));

        // Stop and save profile
        const profile = v8Profiler.stopProfiling(title);

        // Save to file
        const fs = require('fs');
        const path = require('path');
        const profilePath = path.join('/tmp', `${title}.cpuprofile`);

        profile.export((error, result) => {
            if (error) {
                console.error('Failed to export CPU profile:', error);
                return;
            }

            fs.writeFileSync(profilePath, result);
            console.log(`CPU profile saved to ${profilePath}`);

            // Clean up
            profile.delete();
        });
    }
}
```

## Load Testing

### Artillery.js Load Testing Configuration

**Load Test Configuration:**
```yaml
# artillery-config.yml
config:
  target: 'http://localhost:8080'
  phases:
    # Warm-up phase
    - duration: 60
      arrivalRate: 1
      name: "Warm-up"

    # Ramp-up phase
    - duration: 120
      arrivalRate: 1
      rampTo: 50
      name: "Ramp-up"

    # Load phase
    - duration: 300
      arrivalRate: 50
      name: "Load"

    # Spike phase
    - duration: 60
      arrivalRate: 100
      name: "Spike"

    # Cool-down phase
    - duration: 60
      arrivalRate: 10
      name: "Cool-down"

  processor: "./load-test-functions.js"

scenarios:
  - name: "Health check"
    weight: 40
    flow:
      - get:
          url: "/health"
          expect:
            - statusCode: 200
            - contentType: "application/json"
            - hasProperty: "status"

  - name: "Immunity status"
    weight: 30
    flow:
      - get:
          url: "/api/v1/immunity/status"
          expect:
            - statusCode: 200
            - hasProperty: "immunities"

  - name: "Metrics collection"
    weight: 20
    flow:
      - get:
          url: "/metrics"
          expect:
            - statusCode: 200
            - contentType: "text/plain"

  - name: "Configuration check"
    weight: 10
    flow:
      - get:
          url: "/api/v1/config"
          expect:
            - statusCode: 200
            - hasProperty: "immunities"
```

**Load Test Functions:**
```javascript
// load-test-functions.js
module.exports = {
    setAgentId: function(requestParams, context, ee, next) {
        context.vars.agentId = `agent_${Math.floor(Math.random() * 1000)}`;
        return next();
    },

    checkResponseTime: function(requestParams, response, context, ee, next) {
        if (response.timings.response > 30) {
            console.warn(`Slow response: ${response.timings.response}ms`);
        }
        return next();
    },

    logViolation: function(requestParams, response, context, ee, next) {
        if (response.body && response.body.includes('violation')) {
            console.log('Immunity violation detected in response');
        }
        return next();
    }
};
```

### Continuous Performance Testing

**Performance CI/CD Integration:**
```bash
#!/bin/bash
# performance-test.sh

set -e

echo "Starting performance test suite..."

# Start AIS service
docker-compose up -d ais-core
sleep 30

# Wait for service to be ready
while ! curl -f http://localhost:8080/health; do
    echo "Waiting for service..."
    sleep 5
done

# Run load tests
artillery run artillery-config.yml --output performance-results.json

# Generate report
artillery report performance-results.json --output performance-report.html

# Check performance criteria
node check-performance.js performance-results.json

# Cleanup
docker-compose down

echo "Performance testing completed"
```

**Performance Criteria Validation:**
```javascript
// check-performance.js
const fs = require('fs');

function validatePerformance(resultsFile) {
    const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    const summary = results.aggregate;

    const criteria = {
        responseTime: {
            p95: 30,
            p99: 50
        },
        errorRate: 0.01,
        throughput: 100
    };

    let passed = true;

    // Check response times
    if (summary.latency.p95 > criteria.responseTime.p95) {
        console.error(`P95 response time ${summary.latency.p95}ms exceeds threshold ${criteria.responseTime.p95}ms`);
        passed = false;
    }

    if (summary.latency.p99 > criteria.responseTime.p99) {
        console.error(`P99 response time ${summary.latency.p99}ms exceeds threshold ${criteria.responseTime.p99}ms`);
        passed = false;
    }

    // Check error rate
    const errorRate = summary.errors ? (Object.values(summary.errors).reduce((a, b) => a + b, 0) / summary.requestsCompleted) : 0;
    if (errorRate > criteria.errorRate) {
        console.error(`Error rate ${errorRate} exceeds threshold ${criteria.errorRate}`);
        passed = false;
    }

    // Check throughput
    const throughput = summary.requestsCompleted / (summary.phases[0].duration / 1000);
    if (throughput < criteria.throughput) {
        console.error(`Throughput ${throughput} req/s below threshold ${criteria.throughput} req/s`);
        passed = false;
    }

    if (passed) {
        console.log('All performance criteria passed');
        process.exit(0);
    } else {
        console.log('Performance criteria failed');
        process.exit(1);
    }
}

validatePerformance(process.argv[2]);
```

## Troubleshooting

### Performance Issue Diagnosis

**Memory Leak Detection:**
```bash
# Generate heap snapshot
kill -USR2 $(pgrep node)

# Analyze with clinic.js
npm install -g clinic
clinic doctor -- node app.js
clinic bubbleprof -- node app.js
clinic flame -- node app.js
```

**CPU Bottleneck Analysis:**
```bash
# CPU profiling
node --prof app.js
node --prof-process isolate-*.log > processed.txt

# Flame graph generation
npm install -g 0x
0x app.js
```

**Network Performance Issues:**
```bash
# Monitor network connections
netstat -tuln | grep 8080
ss -tuln | grep 8080

# Check connection pool status
curl http://localhost:8080/debug/connections

# Monitor bandwidth usage
iftop -i eth0
```

### Common Performance Issues

| Issue | Symptoms | Diagnosis | Solution |
|-------|----------|-----------|----------|
| Memory Leak | Increasing RSS, GC pauses | Heap snapshots | Fix object references, use WeakMap |
| CPU Bottleneck | High CPU usage, slow responses | CPU profiling | Optimize algorithms, use workers |
| Event Loop Blocking | High lag, unresponsive | Event loop monitoring | Move to async, use streams |
| Database Slow | Slow queries, timeouts | Query profiling | Add indexes, connection pooling |
| Network Issues | Connection errors, timeouts | Network monitoring | Tune timeouts, use keep-alive |

For additional performance optimization guidance, consult the [Claude Flow Performance Best Practices](https://docs.claude-flow.com/performance) documentation.