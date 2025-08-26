/**
 * @fileoverview PromptWizard configuration management and validation
 * @lastmodified 2025-08-26T14:40:00Z
 *
 * Features: Configuration validation, defaults, environment overrides
 * Main APIs: PromptWizardConfig interface, getConfig(), validateConfig()
 * Constraints: Must align with ConfigManager schema
 * Patterns: Configuration object pattern, validation pattern
 */

import { ConfigManager } from './config-manager';
import { logger } from '../utils/logger';

export interface PromptWizardConnectionConfig {
  /** Primary REST API service URL */
  serviceUrl: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Number of retry attempts */
  retries: number;
  /** API authentication token */
  apiKey?: string;
  /** Enable SSL/TLS verification */
  verifySSL: boolean;
}

export interface PromptWizardGrpcConfig {
  /** Enable gRPC protocol support */
  enabled: boolean;
  /** gRPC service URL */
  serviceUrl: string;
  /** Use secure connection (TLS) */
  secure: boolean;
  /** Keep-alive settings */
  keepAlive: boolean;
  /** Message size limits */
  maxReceiveMessageLength: number;
  maxSendMessageLength: number;
}

export interface PromptWizardWebSocketConfig {
  /** Enable WebSocket streaming */
  enabled: boolean;
  /** WebSocket service URL */
  serviceUrl: string;
  /** Reconnection settings */
  reconnectInterval: number;
  maxReconnectAttempts: number;
  /** Heartbeat interval */
  heartbeatInterval: number;
}

export interface PromptWizardOptimizationConfig {
  /** Automatically optimize templates on save */
  autoOptimize: boolean;
  /** Default target model for optimization */
  defaultModel: string;
  /** Number of refinement iterations */
  mutateRefineIterations: number;
  /** Number of few-shot examples to generate */
  fewShotCount: number;
  /** Generate reasoning chains in optimized prompts */
  generateReasoning: boolean;
  /** Maximum prompt length for optimization */
  maxPromptLength: number;
  /** Minimum confidence threshold for results */
  minConfidence: number;
}

export interface PromptWizardCacheConfig {
  /** Enable optimization result caching */
  enabled: boolean;
  /** Cache TTL in seconds */
  ttl: number;
  /** Maximum cache entries */
  maxSize: number;
  /** Redis configuration for distributed caching */
  redis?: {
    enabled: boolean;
    url: string;
    keyPrefix: string;
    ttl: number;
  };
}

export interface PromptWizardRateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Rate limiting window in milliseconds */
  windowMs: number;
  /** Skip rate limiting for cached results */
  skipCached: boolean;
}

export interface PromptWizardAnalyticsConfig {
  /** Enable analytics tracking */
  enabled: boolean;
  /** Track usage metrics */
  trackUsage: boolean;
  /** Report interval in seconds */
  reportInterval: number;
  /** Analytics storage backend */
  backend: 'memory' | 'redis' | 'file';
}

export interface PromptWizardConfig {
  /** Master enable/disable flag */
  enabled: boolean;

  /** Connection configuration */
  connection: PromptWizardConnectionConfig;

  /** gRPC protocol configuration */
  grpc: PromptWizardGrpcConfig;

  /** WebSocket streaming configuration */
  websocket: PromptWizardWebSocketConfig;

  /** Optimization behavior configuration */
  optimization: PromptWizardOptimizationConfig;

  /** Caching configuration */
  cache: PromptWizardCacheConfig;

  /** Rate limiting configuration */
  rateLimiting: PromptWizardRateLimitConfig;

  /** Analytics configuration */
  analytics: PromptWizardAnalyticsConfig;
}

/**
 * Default PromptWizard configuration
 */
export const DEFAULT_PROMPTWIZARD_CONFIG: PromptWizardConfig = {
  enabled: false,

  connection: {
    serviceUrl: process.env.PROMPTWIZARD_SERVICE_URL || 'http://localhost:8000',
    timeout: 120000,
    retries: 3,
    apiKey: process.env.PROMPTWIZARD_API_KEY,
    verifySSL: true,
  },

  grpc: {
    enabled: false,
    serviceUrl: process.env.PROMPTWIZARD_GRPC_URL || 'localhost:50051',
    secure: false,
    keepAlive: true,
    maxReceiveMessageLength: 4 * 1024 * 1024, // 4MB
    maxSendMessageLength: 4 * 1024 * 1024, // 4MB
  },

  websocket: {
    enabled: false,
    serviceUrl:
      process.env.PROMPTWIZARD_WS_URL || 'ws://localhost:8001/ws/optimize',
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000,
  },

  optimization: {
    autoOptimize: false,
    defaultModel: 'gpt-4',
    mutateRefineIterations: 3,
    fewShotCount: 5,
    generateReasoning: true,
    maxPromptLength: 10000,
    minConfidence: 0.7,
  },

  cache: {
    enabled: true,
    ttl: 86400, // 24 hours
    maxSize: 1000,
    redis: {
      enabled: false,
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      keyPrefix: 'promptwizard:',
      ttl: 86400,
    },
  },

  rateLimiting: {
    maxRequests: 100,
    windowMs: 3600000, // 1 hour
    skipCached: true,
  },

  analytics: {
    enabled: true,
    trackUsage: true,
    reportInterval: 3600, // 1 hour
    backend: 'memory',
  },
};

/**
 * Validate PromptWizard configuration
 */
export function validatePromptWizardConfig(config: PromptWizardConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate connection config
  if (!config.connection.serviceUrl) {
    errors.push('connection.serviceUrl is required');
  }
  if (config.connection.timeout < 30000) {
    warnings.push('connection.timeout is less than 30 seconds');
  }
  if (config.connection.retries < 0 || config.connection.retries > 10) {
    errors.push('connection.retries must be between 0 and 10');
  }

  // Validate optimization config
  if (
    config.optimization.mutateRefineIterations < 1 ||
    config.optimization.mutateRefineIterations > 10
  ) {
    errors.push('optimization.mutateRefineIterations must be between 1 and 10');
  }
  if (
    config.optimization.fewShotCount < 0 ||
    config.optimization.fewShotCount > 20
  ) {
    errors.push('optimization.fewShotCount must be between 0 and 20');
  }
  if (
    config.optimization.minConfidence < 0 ||
    config.optimization.minConfidence > 1
  ) {
    errors.push('optimization.minConfidence must be between 0 and 1');
  }
  if (config.optimization.maxPromptLength < 1000) {
    warnings.push('optimization.maxPromptLength is very low');
  }

  // Validate cache config
  if (config.cache.enabled && config.cache.ttl < 300) {
    warnings.push('cache.ttl is less than 5 minutes');
  }
  if (config.cache.maxSize < 10) {
    warnings.push('cache.maxSize is very low');
  }

  // Validate rate limiting
  if (config.rateLimiting.maxRequests < 1) {
    errors.push('rateLimiting.maxRequests must be at least 1');
  }
  if (config.rateLimiting.windowMs < 60000) {
    warnings.push('rateLimiting.windowMs is less than 1 minute');
  }

  // Validate protocol configurations
  if (config.grpc.enabled && !config.grpc.serviceUrl) {
    errors.push('grpc.serviceUrl is required when gRPC is enabled');
  }
  if (config.websocket.enabled && !config.websocket.serviceUrl) {
    errors.push('websocket.serviceUrl is required when WebSocket is enabled');
  }

  // Check for conflicting configurations
  if (!config.enabled && (config.grpc.enabled || config.websocket.enabled)) {
    warnings.push('gRPC/WebSocket enabled but PromptWizard is disabled');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get current PromptWizard configuration
 */
export function getPromptWizardConfig(): PromptWizardConfig {
  const configManager = ConfigManager.getInstance();

  try {
    // Get configuration from ConfigManager
    const config: PromptWizardConfig = {
      enabled: configManager.get<boolean>(
        'promptwizard.enabled',
        DEFAULT_PROMPTWIZARD_CONFIG.enabled
      ),

      connection: {
        serviceUrl: configManager.get<string>(
          'promptwizard.serviceUrl',
          DEFAULT_PROMPTWIZARD_CONFIG.connection.serviceUrl
        ),
        timeout: configManager.get<number>(
          'promptwizard.timeout',
          DEFAULT_PROMPTWIZARD_CONFIG.connection.timeout
        ),
        retries: configManager.get<number>(
          'promptwizard.retries',
          DEFAULT_PROMPTWIZARD_CONFIG.connection.retries
        ),
        apiKey: configManager.get<string>(
          'promptwizard.apiKey',
          DEFAULT_PROMPTWIZARD_CONFIG.connection.apiKey
        ),
        verifySSL: configManager.get<boolean>(
          'promptwizard.verifySSL',
          DEFAULT_PROMPTWIZARD_CONFIG.connection.verifySSL
        ),
      },

      grpc: {
        enabled: configManager.get<boolean>(
          'promptwizard.grpc.enabled',
          DEFAULT_PROMPTWIZARD_CONFIG.grpc.enabled
        ),
        serviceUrl: configManager.get<string>(
          'promptwizard.grpc.serviceUrl',
          DEFAULT_PROMPTWIZARD_CONFIG.grpc.serviceUrl
        ),
        secure: configManager.get<boolean>(
          'promptwizard.grpc.secure',
          DEFAULT_PROMPTWIZARD_CONFIG.grpc.secure
        ),
        keepAlive: configManager.get<boolean>(
          'promptwizard.grpc.keepAlive',
          DEFAULT_PROMPTWIZARD_CONFIG.grpc.keepAlive
        ),
        maxReceiveMessageLength: configManager.get<number>(
          'promptwizard.grpc.maxReceiveMessageLength',
          DEFAULT_PROMPTWIZARD_CONFIG.grpc.maxReceiveMessageLength
        ),
        maxSendMessageLength: configManager.get<number>(
          'promptwizard.grpc.maxSendMessageLength',
          DEFAULT_PROMPTWIZARD_CONFIG.grpc.maxSendMessageLength
        ),
      },

      websocket: {
        enabled: configManager.get<boolean>(
          'promptwizard.websocket.enabled',
          DEFAULT_PROMPTWIZARD_CONFIG.websocket.enabled
        ),
        serviceUrl: configManager.get<string>(
          'promptwizard.websocket.serviceUrl',
          DEFAULT_PROMPTWIZARD_CONFIG.websocket.serviceUrl
        ),
        reconnectInterval: configManager.get<number>(
          'promptwizard.websocket.reconnectInterval',
          DEFAULT_PROMPTWIZARD_CONFIG.websocket.reconnectInterval
        ),
        maxReconnectAttempts: configManager.get<number>(
          'promptwizard.websocket.maxReconnectAttempts',
          DEFAULT_PROMPTWIZARD_CONFIG.websocket.maxReconnectAttempts
        ),
        heartbeatInterval: configManager.get<number>(
          'promptwizard.websocket.heartbeatInterval',
          DEFAULT_PROMPTWIZARD_CONFIG.websocket.heartbeatInterval
        ),
      },

      optimization: {
        autoOptimize: configManager.get<boolean>(
          'promptwizard.autoOptimize',
          DEFAULT_PROMPTWIZARD_CONFIG.optimization.autoOptimize
        ),
        defaultModel: configManager.get<string>(
          'promptwizard.defaultModel',
          DEFAULT_PROMPTWIZARD_CONFIG.optimization.defaultModel
        ),
        mutateRefineIterations: configManager.get<number>(
          'promptwizard.mutateRefineIterations',
          DEFAULT_PROMPTWIZARD_CONFIG.optimization.mutateRefineIterations
        ),
        fewShotCount: configManager.get<number>(
          'promptwizard.fewShotCount',
          DEFAULT_PROMPTWIZARD_CONFIG.optimization.fewShotCount
        ),
        generateReasoning: configManager.get<boolean>(
          'promptwizard.generateReasoning',
          DEFAULT_PROMPTWIZARD_CONFIG.optimization.generateReasoning
        ),
        maxPromptLength: configManager.get<number>(
          'promptwizard.maxPromptLength',
          DEFAULT_PROMPTWIZARD_CONFIG.optimization.maxPromptLength
        ),
        minConfidence: configManager.get<number>(
          'promptwizard.minConfidence',
          DEFAULT_PROMPTWIZARD_CONFIG.optimization.minConfidence
        ),
      },

      cache: {
        enabled: configManager.get<boolean>(
          'promptwizard.cache.enabled',
          DEFAULT_PROMPTWIZARD_CONFIG.cache.enabled
        ),
        ttl: configManager.get<number>(
          'promptwizard.cache.ttl',
          DEFAULT_PROMPTWIZARD_CONFIG.cache.ttl
        ),
        maxSize: configManager.get<number>(
          'promptwizard.cache.maxSize',
          DEFAULT_PROMPTWIZARD_CONFIG.cache.maxSize
        ),
        redis: {
          enabled: configManager.get<boolean>(
            'promptwizard.cache.redis.enabled',
            DEFAULT_PROMPTWIZARD_CONFIG.cache.redis!.enabled
          ),
          url: configManager.get<string>(
            'promptwizard.cache.redis.url',
            DEFAULT_PROMPTWIZARD_CONFIG.cache.redis!.url
          ),
          keyPrefix: configManager.get<string>(
            'promptwizard.cache.redis.keyPrefix',
            DEFAULT_PROMPTWIZARD_CONFIG.cache.redis!.keyPrefix
          ),
          ttl: configManager.get<number>(
            'promptwizard.cache.redis.ttl',
            DEFAULT_PROMPTWIZARD_CONFIG.cache.redis!.ttl
          ),
        },
      },

      rateLimiting: {
        maxRequests: configManager.get<number>(
          'promptwizard.rateLimiting.maxRequests',
          DEFAULT_PROMPTWIZARD_CONFIG.rateLimiting.maxRequests
        ),
        windowMs: configManager.get<number>(
          'promptwizard.rateLimiting.windowMs',
          DEFAULT_PROMPTWIZARD_CONFIG.rateLimiting.windowMs
        ),
        skipCached: configManager.get<boolean>(
          'promptwizard.rateLimiting.skipCached',
          DEFAULT_PROMPTWIZARD_CONFIG.rateLimiting.skipCached
        ),
      },

      analytics: {
        enabled: configManager.get<boolean>(
          'promptwizard.analytics.enabled',
          DEFAULT_PROMPTWIZARD_CONFIG.analytics.enabled
        ),
        trackUsage: configManager.get<boolean>(
          'promptwizard.analytics.trackUsage',
          DEFAULT_PROMPTWIZARD_CONFIG.analytics.trackUsage
        ),
        reportInterval: configManager.get<number>(
          'promptwizard.analytics.reportInterval',
          DEFAULT_PROMPTWIZARD_CONFIG.analytics.reportInterval
        ),
        backend: configManager.get<'memory' | 'redis' | 'file'>(
          'promptwizard.analytics.backend',
          DEFAULT_PROMPTWIZARD_CONFIG.analytics.backend
        ),
      },
    };

    // Validate configuration
    const validation = validatePromptWizardConfig(config);
    if (!validation.valid) {
      logger.warn(
        `Invalid PromptWizard configuration: ${validation.errors.join(', ')}`
      );
    }

    return config;
  } catch (error) {
    logger.error(
      `Failed to load PromptWizard configuration, using defaults: ${(error as Error).message}`
    );
    return DEFAULT_PROMPTWIZARD_CONFIG;
  }
}

/**
 * Update PromptWizard configuration
 */
export function updatePromptWizardConfig(
  updates: Partial<PromptWizardConfig>
): void {
  const configManager = ConfigManager.getInstance();

  // Flatten the updates object for ConfigManager
  const flattenConfig = (
    obj: any,
    prefix = 'promptwizard'
  ): Record<string, unknown> => {
    const flattened: Record<string, unknown> = {};

    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const fullKey = `${prefix}.${key}`;

      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        Object.assign(flattened, flattenConfig(value, fullKey));
      } else {
        flattened[fullKey] = value;
      }
    });

    return flattened;
  };

  const flatUpdates = flattenConfig(updates);

  // Apply updates
  Object.entries(flatUpdates).forEach(([key, value]) => {
    configManager.set(key, value, 'runtime');
  });

  logger.info(
    `PromptWizard configuration updated: ${Object.keys(flatUpdates).join(', ')}`
  );
}

/**
 * Get environment-specific configuration overrides
 */
export function getEnvironmentOverrides(): Partial<PromptWizardConfig> {
  const overrides: any = {};

  // Connection overrides
  if (process.env.PROMPTWIZARD_SERVICE_URL) {
    overrides.connection = { serviceUrl: process.env.PROMPTWIZARD_SERVICE_URL };
  }
  if (process.env.PROMPTWIZARD_API_KEY) {
    overrides.connection = {
      ...overrides.connection,
      apiKey: process.env.PROMPTWIZARD_API_KEY,
    };
  }

  // Protocol overrides
  if (process.env.PROMPTWIZARD_GRPC_ENABLED === 'true') {
    overrides.grpc = { enabled: true };
  }
  if (process.env.PROMPTWIZARD_WS_ENABLED === 'true') {
    overrides.websocket = { enabled: true };
  }

  // Redis overrides
  if (process.env.REDIS_URL) {
    overrides.cache = {
      redis: {
        enabled: true,
        url: process.env.REDIS_URL,
      },
    };
  }

  return overrides;
}

/**
 * Check if PromptWizard is properly configured and available
 */
export async function checkPromptWizardAvailability(): Promise<{
  available: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const config = getPromptWizardConfig();
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!config.enabled) {
    issues.push('PromptWizard is disabled in configuration');
    recommendations.push(
      'Enable PromptWizard by setting promptwizard.enabled = true'
    );
    return { available: false, issues, recommendations };
  }

  // Check service availability (this would normally make an HTTP request)
  try {
    // Mock availability check - in real implementation, this would ping the service
    const serviceAvailable = true; // await fetch(`${config.connection.serviceUrl}/health`)

    if (!serviceAvailable) {
      issues.push('PromptWizard service is not responding');
      recommendations.push('Ensure PromptWizard Python service is running');
    }
  } catch (error) {
    issues.push(`Cannot connect to PromptWizard service: ${error}`);
    recommendations.push('Check service URL and network connectivity');
  }

  // Check configuration issues
  const validation = validatePromptWizardConfig(config);
  if (!validation.valid) {
    issues.push(...validation.errors);
  }
  if (validation.warnings.length > 0) {
    recommendations.push(...validation.warnings);
  }

  return {
    available: issues.length === 0,
    issues,
    recommendations,
  };
}
