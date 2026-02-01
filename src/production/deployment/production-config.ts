/**
 * Production Configuration
 * Centralized configuration management for production deployment
 */

import { DeploymentConfig } from './production-orchestrator';
import { EvidenceType } from '../validation/evidence-chains';

export interface ProductionEnvironmentConfig {
  name: string;
  region: string;
  domain: string;
  deployment: DeploymentConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
  performance: PerformanceConfig;
  backup: BackupConfig;
}

export interface MonitoringConfig {
  prometheus: {
    enabled: boolean;
    scrapeInterval: string;
    retentionTime: string;
    externalUrl?: string;
  };
  grafana: {
    enabled: boolean;
    adminPassword: string;
    datasources: string[];
  };
  logging: {
    level: string;
    elasticsearch: {
      enabled: boolean;
      nodes: string[];
      indexPrefix: string;
    };
    retention: {
      days: number;
      maxSize: string;
    };
  };
  tracing: {
    enabled: boolean;
    jaeger: {
      endpoint: string;
      samplingRate: number;
    };
  };
  alerting: {
    enabled: boolean;
    channels: AlertChannel[];
    rules: AlertRule[];
  };
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'pagerduty';
  name: string;
  config: Record<string, any>;
}

export interface AlertRule {
  name: string;
  severity: 'warning' | 'critical';
  condition: string;
  duration: string;
  channels: string[];
}

export interface SecurityConfig {
  authentication: {
    jwtSecret: string;
    tokenExpiration: string;
    refreshTokenExpiration: string;
  };
  authorization: {
    rbacEnabled: boolean;
    defaultRole: string;
  };
  networking: {
    corsOrigins: string[];
    rateLimiting: {
      enabled: boolean;
      requestsPerMinute: number;
      burstSize: number;
    };
    tlsConfig: {
      minVersion: string;
      cipherSuites: string[];
    };
  };
  encryption: {
    algorithm: string;
    keyRotationDays: number;
  };
  compliance: {
    auditLogging: boolean;
    dataRetentionDays: number;
    privacyMode: boolean;
  };
}

export interface PerformanceConfig {
  scaling: {
    minReplicas: number;
    maxReplicas: number;
    targetCpuUtilization: number;
    targetMemoryUtilization: number;
  };
  caching: {
    redis: {
      maxMemory: string;
      policy: string;
      ttl: number;
    };
    application: {
      enabled: boolean;
      maxSize: number;
    };
  };
  database: {
    connectionPool: {
      min: number;
      max: number;
      idleTimeout: number;
    };
    queryTimeout: number;
    slowQueryThreshold: number;
  };
  resources: {
    cpu: {
      requests: string;
      limits: string;
    };
    memory: {
      requests: string;
      limits: string;
    };
  };
}

export interface BackupConfig {
  database: {
    enabled: boolean;
    schedule: string;
    retentionDays: number;
    compression: boolean;
    encryption: boolean;
  };
  files: {
    enabled: boolean;
    schedule: string;
    retentionDays: number;
    paths: string[];
  };
  storage: {
    type: 's3' | 'gcs' | 'local';
    bucket?: string;
    region?: string;
    credentials?: Record<string, string>;
  };
}

/**
 * Production environment configurations
 */
export const productionConfigs: Record<string, ProductionEnvironmentConfig> = {
  'prod-us-east-1': {
    name: 'Production US East',
    region: 'us-east-1',
    domain: 'api.aisystem.com',
    deployment: {
      applicationName: 'ais-production',
      version: process.env.VERSION || 'latest',
      environment: 'production',
      releaseCandidate: process.env.RELEASE_CANDIDATE || 'stable',
      deploymentStrategy: 'blue_green',

      evidenceValidation: {
        requiredEvidenceTypes: [
          EvidenceType.FUNCTIONAL_TEST,
          EvidenceType.SECURITY_SCAN,
          EvidenceType.PERFORMANCE_TEST,
          EvidenceType.INTEGRATION_TEST,
          EvidenceType.LOAD_TEST,
          EvidenceType.OPERATIONAL_READINESS,
        ],
        passThreshold: 85,
        criticalEvidenceRequired: true,
        allowPartialValidation: false,
        requireManualAttestation: true,
        timeoutMinutes: 30,
        parallelValidation: true,
      },

      targets: [
        {
          id: 'prod-cluster-1',
          name: 'Production Kubernetes Cluster 1',
          type: 'kubernetes',
          region: 'us-east-1a',
          environment: 'production',
          capacity: 100,
          configuration: {
            namespace: 'ais-production',
            replicas: 6,
            resourceQuota: {
              cpu: '12',
              memory: '24Gi',
            },
          },
          healthEndpoint: 'https://api.aisystem.com/health',
        },
        {
          id: 'prod-cluster-2',
          name: 'Production Kubernetes Cluster 2',
          type: 'kubernetes',
          region: 'us-east-1b',
          environment: 'production',
          capacity: 100,
          configuration: {
            namespace: 'ais-production',
            replicas: 6,
            resourceQuota: {
              cpu: '12',
              memory: '24Gi',
            },
          },
          healthEndpoint: 'https://api2.aisystem.com/health',
        },
      ],

      healthChecks: {
        enabled: true,
        timeoutSeconds: 30,
        healthyThreshold: 3,
        unhealthyThreshold: 3,
      },

      rollback: {
        enabled: true,
        autoRollback: true,
        timeoutMinutes: 15,
        triggerConditions: [
          {
            metric: 'error_rate',
            operator: 'gt',
            threshold: 5,
            duration: 120, // 2 minutes
          },
          {
            metric: 'response_time_p95',
            operator: 'gt',
            threshold: 5000,
            duration: 180, // 3 minutes
          },
          {
            metric: 'health_check_success_rate',
            operator: 'lt',
            threshold: 50,
            duration: 60, // 1 minute
          },
        ],
      },

      monitoring: {
        enabled: true,
        metricsRetentionDays: 30,
        alertingRules: [
          {
            name: 'HighErrorRate',
            condition: 'error_rate > 1',
            severity: 'critical',
            channels: ['pagerduty', 'slack-critical'],
          },
          {
            name: 'HighResponseTime',
            condition: 'response_time_p95 > 1000',
            severity: 'critical',
            channels: ['pagerduty', 'slack-critical'],
          },
          {
            name: 'LowThroughput',
            condition: 'throughput < 500',
            severity: 'high',
            channels: ['slack-alerts'],
          },
        ],
      },

      approvalGates: [
        {
          phase: 'validation',
          required: true,
          approvers: ['tech-lead', 'product-manager'],
          timeout: 60, // 1 hour
          autoApprove: false,
          conditions: ['evidence_chain_passes', 'security_scan_clean'],
        },
        {
          phase: 'deployment',
          required: true,
          approvers: ['engineering-manager', 'ops-lead'],
          timeout: 30, // 30 minutes
          autoApprove: false,
        },
      ],

      timeouts: {
        deploymentMinutes: 60,
        healthCheckMinutes: 15,
        rollbackMinutes: 20,
      },

      notifications: [
        {
          channel: 'slack',
          events: ['deployment_started', 'deployment_completed', 'deployment_failed', 'rollback_initiated'],
          configuration: {
            webhook: process.env.SLACK_WEBHOOK_URL,
            channel: '#deployments',
          },
        },
        {
          channel: 'email',
          events: ['deployment_failed', 'rollback_initiated'],
          configuration: {
            recipients: ['engineering-team@company.com', 'ops-team@company.com'],
          },
        },
      ],
    },

    monitoring: {
      prometheus: {
        enabled: true,
        scrapeInterval: '15s',
        retentionTime: '30d',
        externalUrl: 'https://prometheus.aisystem.com',
      },
      grafana: {
        enabled: true,
        adminPassword: process.env.GRAFANA_PASSWORD || 'changeme',
        datasources: ['prometheus', 'elasticsearch'],
      },
      logging: {
        level: 'info',
        elasticsearch: {
          enabled: true,
          nodes: ['https://es1.aisystem.com:9200', 'https://es2.aisystem.com:9200'],
          indexPrefix: 'ais-prod',
        },
        retention: {
          days: 90,
          maxSize: '100GB',
        },
      },
      tracing: {
        enabled: true,
        jaeger: {
          endpoint: 'https://jaeger.aisystem.com:14268/api/traces',
          samplingRate: 0.1, // 10% sampling in production
        },
      },
      alerting: {
        enabled: true,
        channels: [
          {
            type: 'pagerduty',
            name: 'pagerduty',
            config: {
              serviceKey: process.env.PAGERDUTY_SERVICE_KEY,
            },
          },
          {
            type: 'slack',
            name: 'slack-critical',
            config: {
              webhook: process.env.SLACK_CRITICAL_WEBHOOK,
              channel: '#incidents',
            },
          },
          {
            type: 'slack',
            name: 'slack-alerts',
            config: {
              webhook: process.env.SLACK_ALERTS_WEBHOOK,
              channel: '#alerts',
            },
          },
        ],
        rules: [
          {
            name: 'ServiceDown',
            severity: 'critical',
            condition: 'up == 0',
            duration: '1m',
            channels: ['pagerduty', 'slack-critical'],
          },
          {
            name: 'HighErrorRate',
            severity: 'critical',
            condition: 'rate(http_requests_total{status=~"5.."}[5m]) > 0.01',
            duration: '2m',
            channels: ['pagerduty', 'slack-critical'],
          },
          {
            name: 'HighMemoryUsage',
            severity: 'warning',
            condition: 'memory_usage_percent > 85',
            duration: '5m',
            channels: ['slack-alerts'],
          },
          {
            name: 'EvidenceChainFailure',
            severity: 'critical',
            condition: 'evidence_chain_success_rate < 0.95',
            duration: '1m',
            channels: ['pagerduty', 'slack-critical'],
          },
        ],
      },
    },

    security: {
      authentication: {
        jwtSecret: process.env.JWT_SECRET || 'change-in-production',
        tokenExpiration: '1h',
        refreshTokenExpiration: '7d',
      },
      authorization: {
        rbacEnabled: true,
        defaultRole: 'user',
      },
      networking: {
        corsOrigins: ['https://app.aisystem.com', 'https://admin.aisystem.com'],
        rateLimiting: {
          enabled: true,
          requestsPerMinute: 1000,
          burstSize: 2000,
        },
        tlsConfig: {
          minVersion: '1.2',
          cipherSuites: [
            'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
            'TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305',
            'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
          ],
        },
      },
      encryption: {
        algorithm: 'AES-256-GCM',
        keyRotationDays: 90,
      },
      compliance: {
        auditLogging: true,
        dataRetentionDays: 2555, // 7 years
        privacyMode: true,
      },
    },

    performance: {
      scaling: {
        minReplicas: 3,
        maxReplicas: 20,
        targetCpuUtilization: 70,
        targetMemoryUtilization: 80,
      },
      caching: {
        redis: {
          maxMemory: '1gb',
          policy: 'allkeys-lru',
          ttl: 3600, // 1 hour
        },
        application: {
          enabled: true,
          maxSize: 1000,
        },
      },
      database: {
        connectionPool: {
          min: 5,
          max: 50,
          idleTimeout: 30000,
        },
        queryTimeout: 30000,
        slowQueryThreshold: 1000,
      },
      resources: {
        cpu: {
          requests: '500m',
          limits: '2000m',
        },
        memory: {
          requests: '1Gi',
          limits: '4Gi',
        },
      },
    },

    backup: {
      database: {
        enabled: true,
        schedule: '0 2 * * *', // Daily at 2 AM
        retentionDays: 30,
        compression: true,
        encryption: true,
      },
      files: {
        enabled: true,
        schedule: '0 3 * * *', // Daily at 3 AM
        retentionDays: 30,
        paths: ['/app/artifacts', '/app/logs', '/app/evidence-reports'],
      },
      storage: {
        type: 's3',
        bucket: process.env.BACKUP_S3_BUCKET,
        region: 'us-east-1',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
      },
    },
  },

  'prod-eu-west-1': {
    name: 'Production EU West',
    region: 'eu-west-1',
    domain: 'api-eu.aisystem.com',
    deployment: {
      applicationName: 'ais-production-eu',
      version: process.env.VERSION || 'latest',
      environment: 'production',
      releaseCandidate: process.env.RELEASE_CANDIDATE || 'stable',
      deploymentStrategy: 'rolling',

      evidenceValidation: {
        requiredEvidenceTypes: [
          EvidenceType.FUNCTIONAL_TEST,
          EvidenceType.SECURITY_SCAN,
          EvidenceType.PERFORMANCE_TEST,
          EvidenceType.INTEGRATION_TEST,
          EvidenceType.COMPLIANCE_CHECK,
        ],
        passThreshold: 85,
        criticalEvidenceRequired: true,
        allowPartialValidation: false,
        requireManualAttestation: true,
        timeoutMinutes: 30,
        parallelValidation: true,
      },

      targets: [
        {
          id: 'prod-eu-cluster-1',
          name: 'Production EU Kubernetes Cluster',
          type: 'kubernetes',
          region: 'eu-west-1a',
          environment: 'production',
          capacity: 100,
          configuration: {
            namespace: 'ais-production',
            replicas: 4,
            resourceQuota: {
              cpu: '8',
              memory: '16Gi',
            },
          },
          healthEndpoint: 'https://api-eu.aisystem.com/health',
        },
      ],

      healthChecks: {
        enabled: true,
        timeoutSeconds: 30,
        healthyThreshold: 3,
        unhealthyThreshold: 3,
      },

      rollback: {
        enabled: true,
        autoRollback: true,
        timeoutMinutes: 15,
        triggerConditions: [
          {
            metric: 'error_rate',
            operator: 'gt',
            threshold: 5,
            duration: 120,
          },
        ],
      },

      monitoring: {
        enabled: true,
        metricsRetentionDays: 30,
        alertingRules: [],
      },

      approvalGates: [
        {
          phase: 'validation',
          required: true,
          approvers: ['eu-tech-lead'],
          timeout: 60,
          autoApprove: false,
        },
      ],

      timeouts: {
        deploymentMinutes: 60,
        healthCheckMinutes: 15,
        rollbackMinutes: 20,
      },

      notifications: [],
    },

    monitoring: {
      prometheus: {
        enabled: true,
        scrapeInterval: '15s',
        retentionTime: '30d',
      },
      grafana: {
        enabled: true,
        adminPassword: process.env.GRAFANA_PASSWORD || 'changeme',
        datasources: ['prometheus'],
      },
      logging: {
        level: 'info',
        elasticsearch: {
          enabled: true,
          nodes: ['https://es-eu.aisystem.com:9200'],
          indexPrefix: 'ais-prod-eu',
        },
        retention: {
          days: 90,
          maxSize: '50GB',
        },
      },
      tracing: {
        enabled: true,
        jaeger: {
          endpoint: 'https://jaeger-eu.aisystem.com:14268/api/traces',
          samplingRate: 0.1,
        },
      },
      alerting: {
        enabled: true,
        channels: [],
        rules: [],
      },
    },

    security: {
      authentication: {
        jwtSecret: process.env.JWT_SECRET || 'change-in-production',
        tokenExpiration: '1h',
        refreshTokenExpiration: '7d',
      },
      authorization: {
        rbacEnabled: true,
        defaultRole: 'user',
      },
      networking: {
        corsOrigins: ['https://app-eu.aisystem.com'],
        rateLimiting: {
          enabled: true,
          requestsPerMinute: 500,
          burstSize: 1000,
        },
        tlsConfig: {
          minVersion: '1.2',
          cipherSuites: [
            'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
            'TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305',
          ],
        },
      },
      encryption: {
        algorithm: 'AES-256-GCM',
        keyRotationDays: 90,
      },
      compliance: {
        auditLogging: true,
        dataRetentionDays: 2555,
        privacyMode: true,
      },
    },

    performance: {
      scaling: {
        minReplicas: 2,
        maxReplicas: 10,
        targetCpuUtilization: 70,
        targetMemoryUtilization: 80,
      },
      caching: {
        redis: {
          maxMemory: '512mb',
          policy: 'allkeys-lru',
          ttl: 3600,
        },
        application: {
          enabled: true,
          maxSize: 500,
        },
      },
      database: {
        connectionPool: {
          min: 3,
          max: 20,
          idleTimeout: 30000,
        },
        queryTimeout: 30000,
        slowQueryThreshold: 1000,
      },
      resources: {
        cpu: {
          requests: '500m',
          limits: '1500m',
        },
        memory: {
          requests: '1Gi',
          limits: '3Gi',
        },
      },
    },

    backup: {
      database: {
        enabled: true,
        schedule: '0 2 * * *',
        retentionDays: 30,
        compression: true,
        encryption: true,
      },
      files: {
        enabled: true,
        schedule: '0 3 * * *',
        retentionDays: 30,
        paths: ['/app/artifacts', '/app/logs'],
      },
      storage: {
        type: 's3',
        bucket: process.env.BACKUP_S3_BUCKET_EU,
        region: 'eu-west-1',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID_EU,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY_EU,
        },
      },
    },
  },
};

/**
 * Get production configuration for specified environment
 */
export function getProductionConfig(environment: string): ProductionEnvironmentConfig {
  const config = productionConfigs[environment];
  if (!config) {
    throw new Error(`Production configuration not found for environment: ${environment}`);
  }

  // Validate required environment variables
  validateEnvironmentVariables(config);

  return config;
}

/**
 * Validate that all required environment variables are set
 */
function validateEnvironmentVariables(config: ProductionEnvironmentConfig): void {
  const requiredVars = [
    'JWT_SECRET',
    'DB_PASSWORD',
    'REDIS_PASSWORD',
    'ENCRYPTION_KEY',
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate secrets are not using default values
  if (config.security.authentication.jwtSecret === 'change-in-production') {
    throw new Error('JWT_SECRET must be set to a secure value in production');
  }
}

/**
 * Get default evidence validation configuration
 */
export function getDefaultEvidenceValidationConfig() {
  return {
    requiredEvidenceTypes: [
      EvidenceType.FUNCTIONAL_TEST,
      EvidenceType.SECURITY_SCAN,
      EvidenceType.PERFORMANCE_TEST,
      EvidenceType.INTEGRATION_TEST,
    ],
    passThreshold: 85,
    criticalEvidenceRequired: true,
    allowPartialValidation: false,
    requireManualAttestation: true,
    timeoutMinutes: 30,
    parallelValidation: true,
  };
}

/**
 * Create deployment configuration for environment
 */
export function createDeploymentConfig(
  environment: string,
  version: string,
  overrides: Partial<DeploymentConfig> = {}
): DeploymentConfig {
  const envConfig = getProductionConfig(environment);

  return {
    ...envConfig.deployment,
    version,
    ...overrides,
  };
}

/**
 * Validate production configuration
 */
export function validateProductionConfig(config: ProductionEnvironmentConfig): string[] {
  const errors: string[] = [];

  // Validate deployment targets
  if (!config.deployment.targets || config.deployment.targets.length === 0) {
    errors.push('At least one deployment target is required');
  }

  // Validate evidence validation
  if (config.deployment.evidenceValidation.passThreshold < 50) {
    errors.push('Evidence validation pass threshold must be at least 50%');
  }

  // Validate security settings
  if (!config.security.authentication.jwtSecret) {
    errors.push('JWT secret is required for authentication');
  }

  // Validate monitoring
  if (config.monitoring.prometheus.enabled && !config.monitoring.prometheus.scrapeInterval) {
    errors.push('Prometheus scrape interval is required when Prometheus is enabled');
  }

  // Validate backup configuration
  if (config.backup.database.enabled && !config.backup.database.schedule) {
    errors.push('Backup schedule is required when database backup is enabled');
  }

  return errors;
}

/**
 * Environment-specific configuration accessor
 */
export class ProductionConfigManager {
  private config: ProductionEnvironmentConfig;

  constructor(environment: string) {
    this.config = getProductionConfig(environment);
  }

  get deployment() {
    return this.config.deployment;
  }

  get monitoring() {
    return this.config.monitoring;
  }

  get security() {
    return this.config.security;
  }

  get performance() {
    return this.config.performance;
  }

  get backup() {
    return this.config.backup;
  }

  get environment() {
    return this.config;
  }

  /**
   * Update configuration with overrides
   */
  updateConfig(overrides: Partial<ProductionEnvironmentConfig>): void {
    this.config = { ...this.config, ...overrides };
  }

  /**
   * Validate current configuration
   */
  validate(): string[] {
    return validateProductionConfig(this.config);
  }

  /**
   * Export configuration as JSON
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }
}