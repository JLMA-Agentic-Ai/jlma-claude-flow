/**
 * Resource Immunity - Memory/CPU/Network resource limits and monitoring
 *
 * @module @claude-flow/agent-immunity/immunities/resource
 */

import type { Immunity, ImmunityViolation } from '../immunity-service';

/**
 * Resource Immunity
 *
 * Monitors and enforces resource limits to prevent resource exhaustion attacks
 * and ensure system stability. Tracks memory, CPU, network, and disk usage.
 */
export class ResourceImmunity implements Immunity {
  public readonly name = 'resource';
  public readonly weight = 0.85; // High weight - resource exhaustion is critical

  private resourceLimits: ResourceLimits = {
    memory: 100 * 1024 * 1024, // 100MB default
    cpu: 0.8, // 80% CPU usage
    network: 1000, // 1000 requests per minute
    disk: 500 * 1024 * 1024, // 500MB disk usage
    concurrent: 50 // 50 concurrent operations
  };

  private resourceUsage: ResourceUsage = {
    memory: 0,
    cpu: 0,
    network: 0,
    disk: 0,
    concurrent: 0,
    lastUpdate: Date.now()
  };

  private networkRequestHistory: number[] = [];
  private cpuHistory: number[] = [];

  /**
   * Analyze action for resource usage and violations
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      const violations: ImmunityViolation[] = [];

      // Update current resource usage
      await this.updateResourceUsage(actionData);

      // Estimate additional resource requirements for this action
      const estimatedUsage = this.estimateActionResourceUsage(actionData);

      // Check each resource type for violations
      const memoryScore = this.checkMemoryUsage(estimatedUsage.memory, violations);
      const cpuScore = this.checkCpuUsage(estimatedUsage.cpu, violations);
      const networkScore = this.checkNetworkUsage(estimatedUsage.network, violations);
      const diskScore = this.checkDiskUsage(estimatedUsage.disk, violations);
      const concurrencyScore = this.checkConcurrencyLimits(estimatedUsage.concurrent, violations);

      // Check for resource exhaustion patterns
      this.checkResourceExhaustionPatterns(violations);

      // Check for suspicious resource spikes
      this.checkResourceSpikes(violations);

      // Overall score is minimum of all resource scores (worst case)
      const overallScore = Math.min(memoryScore, cpuScore, networkScore, diskScore, concurrencyScore);

      return { score: overallScore, violations };
    } catch (error) {
      console.warn('💾 Resource immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  /**
   * Update current resource usage
   */
  private async updateResourceUsage(actionData: any): Promise<void> {
    try {
      // In a real implementation, this would query system metrics
      // For now, simulate resource monitoring

      // Memory usage (approximate)
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        this.resourceUsage.memory = memUsage.heapUsed;
      }

      // CPU usage (simplified simulation)
      const cpuUsage = this.estimateCpuUsage();
      this.resourceUsage.cpu = cpuUsage;
      this.cpuHistory.push(cpuUsage);
      if (this.cpuHistory.length > 10) {
        this.cpuHistory.shift();
      }

      // Network tracking
      if (actionData.metadata?.networkRequests) {
        this.resourceUsage.network += actionData.metadata.networkRequests;
        this.networkRequestHistory.push(Date.now());
      }

      // Clean old network requests (1 minute window)
      const oneMinuteAgo = Date.now() - 60000;
      this.networkRequestHistory = this.networkRequestHistory.filter(time => time > oneMinuteAgo);
      this.resourceUsage.network = this.networkRequestHistory.length;

      // Concurrent operations
      if (actionData.metadata?.concurrent) {
        this.resourceUsage.concurrent = actionData.metadata.concurrent;
      }

      this.resourceUsage.lastUpdate = Date.now();
    } catch (error) {
      console.warn('Failed to update resource usage:', error);
    }
  }

  /**
   * Estimate resource usage for an action
   */
  private estimateActionResourceUsage(actionData: any): ResourceUsage {
    const estimated: ResourceUsage = {
      memory: 0,
      cpu: 0,
      network: 0,
      disk: 0,
      concurrent: 1, // Each action counts as one concurrent operation
      lastUpdate: Date.now()
    };

    // Estimate based on action type and complexity
    const taskDescription = actionData.task?.description || '';
    const agentType = actionData.agent?.type || '';

    // Memory estimation
    if (taskDescription.includes('large') || taskDescription.includes('bulk')) {
      estimated.memory += 50 * 1024 * 1024; // 50MB for large operations
    }
    if (agentType === 'ml-developer' || agentType === 'data-analyst') {
      estimated.memory += 100 * 1024 * 1024; // 100MB for ML operations
    }
    estimated.memory += taskDescription.length * 100; // Rough estimate based on description length

    // CPU estimation
    if (taskDescription.includes('compile') || taskDescription.includes('build')) {
      estimated.cpu += 0.4; // 40% CPU for compilation
    }
    if (taskDescription.includes('analyze') || taskDescription.includes('process')) {
      estimated.cpu += 0.3; // 30% CPU for analysis
    }
    estimated.cpu += Math.min(0.1, taskDescription.length / 1000); // Base CPU usage

    // Network estimation
    if (taskDescription.includes('fetch') || taskDescription.includes('download')) {
      estimated.network += 5; // 5 requests for network operations
    }
    if (taskDescription.includes('api') || taskDescription.includes('request')) {
      estimated.network += 3; // 3 requests for API operations
    }

    // Disk estimation
    if (taskDescription.includes('write') || taskDescription.includes('create')) {
      estimated.disk += 10 * 1024 * 1024; // 10MB for write operations
    }
    if (taskDescription.includes('log') || taskDescription.includes('cache')) {
      estimated.disk += 5 * 1024 * 1024; // 5MB for logging/caching
    }

    return estimated;
  }

  /**
   * Check memory usage against limits
   */
  private checkMemoryUsage(additionalMemory: number, violations: ImmunityViolation[]): number {
    const projectedMemory = this.resourceUsage.memory + additionalMemory;
    const memoryRatio = projectedMemory / this.resourceLimits.memory;

    if (memoryRatio > 1.0) {
      violations.push({
        type: 'memory_exhaustion',
        severity: 'critical',
        score: 0.0,
        description: `Memory limit exceeded: ${this.formatBytes(projectedMemory)} > ${this.formatBytes(this.resourceLimits.memory)}`,
        details: {
          current: this.resourceUsage.memory,
          additional: additionalMemory,
          projected: projectedMemory,
          limit: this.resourceLimits.memory,
          ratio: memoryRatio
        }
      });
      return 0.0;
    } else if (memoryRatio > 0.9) {
      violations.push({
        type: 'high_memory_usage',
        severity: 'high',
        score: 1.0 - memoryRatio,
        description: `High memory usage: ${(memoryRatio * 100).toFixed(1)}% of limit`,
        details: {
          current: this.resourceUsage.memory,
          projected: projectedMemory,
          ratio: memoryRatio
        }
      });
    }

    return Math.max(0, 1.0 - memoryRatio);
  }

  /**
   * Check CPU usage against limits
   */
  private checkCpuUsage(additionalCpu: number, violations: ImmunityViolation[]): number {
    const projectedCpu = this.resourceUsage.cpu + additionalCpu;
    const cpuRatio = projectedCpu / this.resourceLimits.cpu;

    if (cpuRatio > 1.0) {
      violations.push({
        type: 'cpu_exhaustion',
        severity: 'critical',
        score: 0.0,
        description: `CPU limit exceeded: ${(projectedCpu * 100).toFixed(1)}% > ${(this.resourceLimits.cpu * 100).toFixed(1)}%`,
        details: {
          current: this.resourceUsage.cpu,
          additional: additionalCpu,
          projected: projectedCpu,
          limit: this.resourceLimits.cpu,
          ratio: cpuRatio
        }
      });
      return 0.0;
    } else if (cpuRatio > 0.8) {
      violations.push({
        type: 'high_cpu_usage',
        severity: 'medium',
        score: 1.0 - cpuRatio,
        description: `High CPU usage: ${(cpuRatio * 100).toFixed(1)}% of limit`,
        details: {
          current: this.resourceUsage.cpu,
          projected: projectedCpu,
          ratio: cpuRatio
        }
      });
    }

    return Math.max(0, 1.0 - cpuRatio);
  }

  /**
   * Check network usage against limits
   */
  private checkNetworkUsage(additionalRequests: number, violations: ImmunityViolation[]): number {
    const projectedNetwork = this.resourceUsage.network + additionalRequests;
    const networkRatio = projectedNetwork / this.resourceLimits.network;

    if (networkRatio > 1.0) {
      violations.push({
        type: 'network_rate_limit',
        severity: 'high',
        score: 0.0,
        description: `Network rate limit exceeded: ${projectedNetwork} > ${this.resourceLimits.network} requests/minute`,
        details: {
          current: this.resourceUsage.network,
          additional: additionalRequests,
          projected: projectedNetwork,
          limit: this.resourceLimits.network,
          ratio: networkRatio
        }
      });
      return 0.0;
    }

    return Math.max(0, 1.0 - networkRatio);
  }

  /**
   * Check disk usage against limits
   */
  private checkDiskUsage(additionalDisk: number, violations: ImmunityViolation[]): number {
    const projectedDisk = this.resourceUsage.disk + additionalDisk;
    const diskRatio = projectedDisk / this.resourceLimits.disk;

    if (diskRatio > 1.0) {
      violations.push({
        type: 'disk_exhaustion',
        severity: 'high',
        score: 0.0,
        description: `Disk limit exceeded: ${this.formatBytes(projectedDisk)} > ${this.formatBytes(this.resourceLimits.disk)}`,
        details: {
          current: this.resourceUsage.disk,
          additional: additionalDisk,
          projected: projectedDisk,
          limit: this.resourceLimits.disk,
          ratio: diskRatio
        }
      });
      return 0.0;
    }

    return Math.max(0, 1.0 - diskRatio);
  }

  /**
   * Check concurrency limits
   */
  private checkConcurrencyLimits(additionalConcurrent: number, violations: ImmunityViolation[]): number {
    const projectedConcurrent = this.resourceUsage.concurrent + additionalConcurrent;
    const concurrencyRatio = projectedConcurrent / this.resourceLimits.concurrent;

    if (concurrencyRatio > 1.0) {
      violations.push({
        type: 'concurrency_limit',
        severity: 'medium',
        score: 0.0,
        description: `Concurrency limit exceeded: ${projectedConcurrent} > ${this.resourceLimits.concurrent} operations`,
        details: {
          current: this.resourceUsage.concurrent,
          additional: additionalConcurrent,
          projected: projectedConcurrent,
          limit: this.resourceLimits.concurrent,
          ratio: concurrencyRatio
        }
      });
      return 0.0;
    }

    return Math.max(0, 1.0 - concurrencyRatio);
  }

  /**
   * Check for resource exhaustion attack patterns
   */
  private checkResourceExhaustionPatterns(violations: ImmunityViolation[]): void {
    // Check for rapid network request spikes
    if (this.networkRequestHistory.length > 100) {
      const recentRequests = this.networkRequestHistory.filter(time => time > Date.now() - 10000); // Last 10 seconds
      if (recentRequests.length > 50) {
        violations.push({
          type: 'ddos_pattern',
          severity: 'critical',
          score: 0.0,
          description: 'Potential DDoS attack pattern detected: excessive requests in short time',
          details: {
            recentRequests: recentRequests.length,
            timeWindow: '10 seconds'
          }
        });
      }
    }

    // Check for sustained high CPU usage
    if (this.cpuHistory.length >= 5) {
      const avgCpu = this.cpuHistory.reduce((sum, cpu) => sum + cpu, 0) / this.cpuHistory.length;
      if (avgCpu > 0.9) {
        violations.push({
          type: 'cpu_exhaustion_pattern',
          severity: 'high',
          score: 1.0 - avgCpu,
          description: 'Sustained high CPU usage detected - possible resource exhaustion attack',
          details: {
            averageCpu: avgCpu,
            samples: this.cpuHistory.length
          }
        });
      }
    }
  }

  /**
   * Check for suspicious resource usage spikes
   */
  private checkResourceSpikes(violations: ImmunityViolation[]): void {
    // Check for memory spike
    const memorySpike = this.resourceUsage.memory > this.resourceLimits.memory * 0.7;
    if (memorySpike && this.resourceUsage.lastUpdate > Date.now() - 5000) {
      violations.push({
        type: 'memory_spike',
        severity: 'medium',
        score: 0.5,
        description: 'Sudden memory usage spike detected',
        details: {
          currentMemory: this.resourceUsage.memory,
          threshold: this.resourceLimits.memory * 0.7
        }
      });
    }

    // Check for unusual concurrent operation count
    if (this.resourceUsage.concurrent > this.resourceLimits.concurrent * 0.8) {
      violations.push({
        type: 'concurrency_spike',
        severity: 'medium',
        score: 0.6,
        description: 'High concurrent operation count detected',
        details: {
          currentConcurrent: this.resourceUsage.concurrent,
          limit: this.resourceLimits.concurrent
        }
      });
    }
  }

  /**
   * Estimate current CPU usage (simplified simulation)
   */
  private estimateCpuUsage(): number {
    // In a real implementation, this would use system monitoring APIs
    // For simulation, use a combination of factors
    const baseUsage = 0.1; // 10% base usage
    const randomVariation = Math.random() * 0.3; // Up to 30% random variation
    const timeBasedVariation = Math.sin(Date.now() / 10000) * 0.2; // Sine wave variation

    return Math.max(0, Math.min(1, baseUsage + randomVariation + timeBasedVariation));
  }

  /**
   * Format bytes for human-readable display
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Update resource limits (for configuration)
   */
  public updateLimits(limits: Partial<ResourceLimits>): void {
    this.resourceLimits = { ...this.resourceLimits, ...limits };
    console.log('💾 Resource limits updated:', limits);
  }
}

/**
 * Resource limits configuration
 */
interface ResourceLimits {
  memory: number; // bytes
  cpu: number; // percentage (0-1)
  network: number; // requests per minute
  disk: number; // bytes
  concurrent: number; // concurrent operations
}

/**
 * Current resource usage
 */
interface ResourceUsage {
  memory: number;
  cpu: number;
  network: number;
  disk: number;
  concurrent: number;
  lastUpdate: number;
}