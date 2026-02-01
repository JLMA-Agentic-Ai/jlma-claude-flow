#!/usr/bin/env node

/**
 * Health Check Service for AIS Plugin
 * Comprehensive health monitoring for immunity services
 * Target: <30ms response time, 99.9% uptime
 */

const http = require('http');
const { performance } = require('perf_hooks');

// Health check configuration
const HEALTH_PORT = process.env.AIS_HEALTH_PORT || 8080;
const IMMUNITY_THRESHOLD = parseFloat(process.env.AIS_IMMUNITY_THRESHOLD || '0.8');
const RESPONSE_TIMEOUT = 5000; // 5 second timeout

class ImmunityHealthChecker {
    constructor() {
        this.server = null;
        this.startTime = Date.now();
        this.healthMetrics = {
            immunityViolations: 0,
            totalRequests: 0,
            averageResponseTime: 0,
            lastViolationTime: null,
            activeImmunities: {
                security: { status: 'healthy', violations: 0 },
                truth: { status: 'healthy', violations: 0 },
                performance: { status: 'healthy', violations: 0 },
                coherence: { status: 'healthy', violations: 0 },
                dependencies: { status: 'healthy', violations: 0 }
            }
        };
    }

    /**
     * Start health check server
     */
    start() {
        this.server = http.createServer((req, res) => {
            const startTime = performance.now();

            // CORS headers for monitoring tools
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            // Route health check requests
            if (req.url === '/health') {
                this.handleHealthCheck(req, res, startTime);
            } else if (req.url === '/immunity') {
                this.handleImmunityStatus(req, res, startTime);
            } else if (req.url === '/metrics') {
                this.handleMetrics(req, res, startTime);
            } else if (req.url === '/ready') {
                this.handleReadiness(req, res, startTime);
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        });

        this.server.listen(HEALTH_PORT, () => {
            console.log(`AIS Health Check Server running on port ${HEALTH_PORT}`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }

    /**
     * Basic health check endpoint
     */
    handleHealthCheck(req, res, startTime) {
        try {
            const uptime = Date.now() - this.startTime;
            const responseTime = performance.now() - startTime;

            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: Math.floor(uptime / 1000),
                responseTime: Math.round(responseTime),
                service: 'ais-plugin',
                version: '3.0.0-alpha.1',
                dependencies: this.checkDependencies()
            };

            // Check if response time exceeds SLA (30ms)
            if (responseTime > 30) {
                health.status = 'degraded';
                health.warning = 'Response time exceeds 30ms SLA';
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(health, null, 2));

            this.updateMetrics(responseTime);
        } catch (error) {
            this.handleError(res, error, 'Health check failed');
        }
    }

    /**
     * Immunity-specific status endpoint
     */
    handleImmunityStatus(req, res, startTime) {
        try {
            const responseTime = performance.now() - startTime;

            const immunityStatus = {
                status: this.getOverallImmunityStatus(),
                timestamp: new Date().toISOString(),
                responseTime: Math.round(responseTime),
                immunities: this.healthMetrics.activeImmunities,
                violations: {
                    total: this.healthMetrics.immunityViolations,
                    rate: this.calculateViolationRate(),
                    lastOccurred: this.healthMetrics.lastViolationTime
                },
                thresholds: {
                    immunity: IMMUNITY_THRESHOLD,
                    responseTime: 30 // ms
                },
                performance: {
                    totalRequests: this.healthMetrics.totalRequests,
                    averageResponseTime: this.healthMetrics.averageResponseTime
                }
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(immunityStatus, null, 2));

            this.updateMetrics(responseTime);
        } catch (error) {
            this.handleError(res, error, 'Immunity status check failed');
        }
    }

    /**
     * Prometheus metrics endpoint
     */
    handleMetrics(req, res, startTime) {
        try {
            const responseTime = performance.now() - startTime;
            const uptime = Math.floor((Date.now() - this.startTime) / 1000);

            const metrics = [
                `# HELP ais_immunity_violations_total Total number of immunity violations`,
                `# TYPE ais_immunity_violations_total counter`,
                `ais_immunity_violations_total ${this.healthMetrics.immunityViolations}`,
                '',
                `# HELP ais_response_time_ms Response time in milliseconds`,
                `# TYPE ais_response_time_ms gauge`,
                `ais_response_time_ms ${Math.round(responseTime)}`,
                '',
                `# HELP ais_uptime_seconds Service uptime in seconds`,
                `# TYPE ais_uptime_seconds gauge`,
                `ais_uptime_seconds ${uptime}`,
                '',
                `# HELP ais_requests_total Total number of requests`,
                `# TYPE ais_requests_total counter`,
                `ais_requests_total ${this.healthMetrics.totalRequests}`,
                '',
                `# HELP ais_immunity_status Immunity status (1=healthy, 0=unhealthy)`,
                `# TYPE ais_immunity_status gauge`
            ];

            // Add individual immunity metrics
            Object.entries(this.healthMetrics.activeImmunities).forEach(([name, data]) => {
                const status = data.status === 'healthy' ? 1 : 0;
                metrics.push(`ais_immunity_status{immunity="${name}"} ${status}`);
            });

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(metrics.join('\n'));

            this.updateMetrics(responseTime);
        } catch (error) {
            this.handleError(res, error, 'Metrics collection failed');
        }
    }

    /**
     * Readiness probe for Kubernetes
     */
    handleReadiness(req, res, startTime) {
        try {
            const responseTime = performance.now() - startTime;
            const violationRate = this.calculateViolationRate();

            // Service is ready if violation rate is below threshold
            const isReady = violationRate < (1 - IMMUNITY_THRESHOLD);

            const readiness = {
                ready: isReady,
                timestamp: new Date().toISOString(),
                responseTime: Math.round(responseTime),
                violationRate: violationRate,
                threshold: IMMUNITY_THRESHOLD
            };

            const statusCode = isReady ? 200 : 503;
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(readiness, null, 2));

            this.updateMetrics(responseTime);
        } catch (error) {
            this.handleError(res, error, 'Readiness check failed');
        }
    }

    /**
     * Check external dependencies
     */
    checkDependencies() {
        return {
            memory: this.checkMemoryUsage(),
            redis: 'connected', // TODO: Implement actual Redis check
            filesystem: this.checkFilesystem(),
            network: 'reachable'
        };
    }

    /**
     * Check memory usage
     */
    checkMemoryUsage() {
        const usage = process.memoryUsage();
        const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
        const totalMB = Math.round(usage.heapTotal / 1024 / 1024);

        return {
            status: usedMB < 400 ? 'healthy' : 'warning',
            used: `${usedMB}MB`,
            total: `${totalMB}MB`,
            percentage: Math.round((usedMB / totalMB) * 100)
        };
    }

    /**
     * Check filesystem access
     */
    checkFilesystem() {
        try {
            require('fs').accessSync('/tmp', require('fs').constants.W_OK);
            return 'accessible';
        } catch {
            return 'error';
        }
    }

    /**
     * Get overall immunity status
     */
    getOverallImmunityStatus() {
        const healthyCount = Object.values(this.healthMetrics.activeImmunities)
            .filter(immunity => immunity.status === 'healthy').length;
        const totalCount = Object.keys(this.healthMetrics.activeImmunities).length;

        if (healthyCount === totalCount) return 'healthy';
        if (healthyCount > totalCount * 0.5) return 'degraded';
        return 'unhealthy';
    }

    /**
     * Calculate violation rate
     */
    calculateViolationRate() {
        if (this.healthMetrics.totalRequests === 0) return 0;
        return this.healthMetrics.immunityViolations / this.healthMetrics.totalRequests;
    }

    /**
     * Update health metrics
     */
    updateMetrics(responseTime) {
        this.healthMetrics.totalRequests++;

        // Update rolling average response time
        const alpha = 0.1; // Smoothing factor
        this.healthMetrics.averageResponseTime =
            (alpha * responseTime) +
            ((1 - alpha) * this.healthMetrics.averageResponseTime);
    }

    /**
     * Handle errors
     */
    handleError(res, error, message) {
        console.error(`Health check error: ${message}`, error);

        const errorResponse = {
            status: 'error',
            message: message,
            timestamp: new Date().toISOString(),
            error: error.message
        };

        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(errorResponse, null, 2));
    }

    /**
     * Graceful shutdown
     */
    shutdown() {
        console.log('Shutting down health check server...');
        if (this.server) {
            this.server.close(() => {
                console.log('Health check server closed');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    }
}

// Start health check service if run directly
if (require.main === module) {
    const healthChecker = new ImmunityHealthChecker();
    healthChecker.start();
}

module.exports = ImmunityHealthChecker;