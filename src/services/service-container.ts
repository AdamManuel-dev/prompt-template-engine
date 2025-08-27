/**
 * @fileoverview Dependency injection container for service management
 * @lastmodified 2025-08-27T05:20:00Z
 *
 * Features: Service registration, dependency resolution, lifecycle management
 * Main APIs: register(), resolve(), createScope(), dispose()
 * Constraints: Type-safe dependency injection with singleton and transient lifetimes
 * Patterns: Dependency injection container, service locator, factory pattern
 */

import { logger } from '../utils/logger';

/**
 * Service lifetime options
 */
export type ServiceLifetime = 'singleton' | 'transient' | 'scoped';

/**
 * Service factory function
 */
export type ServiceFactory<T> = (container: ServiceContainer) => T;

/**
 * Service registration descriptor
 */
export interface ServiceDescriptor<T = unknown> {
  /** Service factory function */
  factory: ServiceFactory<T>;
  /** Service lifetime */
  lifetime: ServiceLifetime;
  /** Service dependencies (for validation) */
  dependencies?: string[];
  /** Whether service is disposable */
  disposable?: boolean;
}

/**
 * Service registration options
 */
export interface ServiceRegistrationOptions {
  /** Service lifetime (default: singleton) */
  lifetime?: ServiceLifetime;
  /** Service dependencies for validation */
  dependencies?: string[];
  /** Whether service implements dispose() method */
  disposable?: boolean;
}

/**
 * Disposable service interface
 */
export interface DisposableService {
  dispose(): Promise<void> | void;
}

/**
 * Dependency injection container for managing services
 * 
 * This container provides type-safe dependency injection, replacing hard-coded
 * service instantiation throughout the application. It supports:
 * 
 * - Singleton services (created once, reused)
 * - Transient services (created each time)
 * - Scoped services (created once per scope)
 * - Dependency validation
 * - Automatic disposal of disposable services
 * 
 * Benefits:
 * - Loose coupling between services
 * - Easy testing with mock services
 * - Clear dependency graphs
 * - Automatic lifecycle management
 */
export class ServiceContainer {
  private services = new Map<string, ServiceDescriptor>();
  private singletonInstances = new Map<string, unknown>();
  private scopedInstances = new Map<string, unknown>();
  private parentContainer?: ServiceContainer;
  private isDisposed = false;

  constructor(parent?: ServiceContainer) {
    this.parentContainer = parent;
  }

  /**
   * Register a service with the container
   */
  register<T>(
    serviceId: string,
    factory: ServiceFactory<T>,
    options: ServiceRegistrationOptions = {}
  ): ServiceContainer {
    if (this.isDisposed) {
      throw new Error('Cannot register services on disposed container');
    }

    const descriptor: ServiceDescriptor<T> = {
      factory,
      lifetime: options.lifetime || 'singleton',
      dependencies: options.dependencies,
      disposable: options.disposable,
    };

    this.services.set(serviceId, descriptor);
    
    logger.debug('Service registered', {
      serviceId,
      lifetime: descriptor.lifetime,
      dependencies: descriptor.dependencies,
      disposable: descriptor.disposable,
    });

    return this;
  }

  /**
   * Register a singleton service (created once, reused)
   */
  registerSingleton<T>(
    serviceId: string,
    factory: ServiceFactory<T>,
    dependencies?: string[]
  ): ServiceContainer {
    return this.register(serviceId, factory, { 
      lifetime: 'singleton', 
      dependencies,
      disposable: this.isDisposableFactory(factory),
    });
  }

  /**
   * Register a transient service (created each time)
   */
  registerTransient<T>(
    serviceId: string,
    factory: ServiceFactory<T>,
    dependencies?: string[]
  ): ServiceContainer {
    return this.register(serviceId, factory, { 
      lifetime: 'transient', 
      dependencies,
      disposable: this.isDisposableFactory(factory),
    });
  }

  /**
   * Register a scoped service (created once per scope)
   */
  registerScoped<T>(
    serviceId: string,
    factory: ServiceFactory<T>,
    dependencies?: string[]
  ): ServiceContainer {
    return this.register(serviceId, factory, { 
      lifetime: 'scoped', 
      dependencies,
      disposable: this.isDisposableFactory(factory),
    });
  }

  /**
   * Register an existing instance as a singleton
   */
  registerInstance<T>(serviceId: string, instance: T): ServiceContainer {
    if (this.isDisposed) {
      throw new Error('Cannot register services on disposed container');
    }

    // Create a factory that returns the instance
    const factory: ServiceFactory<T> = () => instance;
    
    this.register(serviceId, factory, { 
      lifetime: 'singleton',
      disposable: this.isDisposable(instance),
    });

    // Store the instance immediately
    this.singletonInstances.set(serviceId, instance);

    logger.debug('Service instance registered', { serviceId });

    return this;
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(serviceId: string): T {
    if (this.isDisposed) {
      throw new Error('Cannot resolve services from disposed container');
    }

    // Try to resolve from this container
    const service = this.tryResolve<T>(serviceId);
    if (service !== null) {
      return service;
    }

    // Try parent container if available
    if (this.parentContainer) {
      try {
        return this.parentContainer.resolve<T>(serviceId);
      } catch (parentError) {
        // Continue with our own error
      }
    }

    throw new Error(`Service not found: ${serviceId}`);
  }

  /**
   * Try to resolve a service without throwing errors
   */
  tryResolve<T>(serviceId: string): T | null {
    const descriptor = this.services.get(serviceId);
    if (!descriptor) {
      return null;
    }

    const typedDescriptor = descriptor as ServiceDescriptor<T>;

    switch (typedDescriptor.lifetime) {
      case 'singleton':
        return this.resolveSingleton<T>(serviceId, typedDescriptor);
      
      case 'scoped':
        return this.resolveScoped<T>(serviceId, typedDescriptor);
      
      case 'transient':
        return this.resolveTransient<T>(serviceId, typedDescriptor);
      
      default:
        throw new Error(`Unknown service lifetime: ${typedDescriptor.lifetime}`);
    }
  }

  /**
   * Check if a service is registered
   */
  isRegistered(serviceId: string): boolean {
    if (this.services.has(serviceId)) {
      return true;
    }
    
    if (this.parentContainer) {
      return this.parentContainer.isRegistered(serviceId);
    }
    
    return false;
  }

  /**
   * Create a child scope
   */
  createScope(): ServiceContainer {
    if (this.isDisposed) {
      throw new Error('Cannot create scope from disposed container');
    }

    return new ServiceContainer(this);
  }

  /**
   * Get all registered service IDs
   */
  getServiceIds(): string[] {
    const serviceIds = Array.from(this.services.keys());
    
    if (this.parentContainer) {
      const parentIds = this.parentContainer.getServiceIds();
      return [...new Set([...serviceIds, ...parentIds])];
    }
    
    return serviceIds;
  }

  /**
   * Get service dependency graph
   */
  getDependencyGraph(): Record<string, string[]> {
    const graph: Record<string, string[]> = {};
    
    for (const [serviceId, descriptor] of this.services) {
      graph[serviceId] = descriptor.dependencies || [];
    }
    
    if (this.parentContainer) {
      const parentGraph = this.parentContainer.getDependencyGraph();
      Object.assign(graph, parentGraph);
    }
    
    return graph;
  }

  /**
   * Validate service dependencies
   */
  validateDependencies(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const graph = this.getDependencyGraph();
    const serviceIds = this.getServiceIds();
    
    // Check for missing dependencies
    for (const [serviceId, dependencies] of Object.entries(graph)) {
      for (const dependency of dependencies) {
        if (!serviceIds.includes(dependency)) {
          errors.push(`Service '${serviceId}' depends on unregistered service '${dependency}'`);
        }
      }
    }
    
    // Check for circular dependencies
    const circularErrors = this.detectCircularDependencies(graph);
    errors.push(...circularErrors);
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Dispose the container and all disposable services
   */
  async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;

    logger.info('Disposing service container...');

    // Dispose scoped instances
    await this.disposeInstances(this.scopedInstances);
    this.scopedInstances.clear();

    // Dispose singleton instances
    await this.disposeInstances(this.singletonInstances);
    this.singletonInstances.clear();

    // Clear service registrations
    this.services.clear();

    logger.info('Service container disposed');
  }

  // Private methods

  private resolveSingleton<T>(serviceId: string, descriptor: ServiceDescriptor<T>): T {
    let instance = this.singletonInstances.get(serviceId) as T;
    
    if (!instance) {
      logger.debug('Creating singleton service', { serviceId });
      instance = descriptor.factory(this);
      this.singletonInstances.set(serviceId, instance);
    }
    
    return instance;
  }

  private resolveScoped<T>(serviceId: string, descriptor: ServiceDescriptor<T>): T {
    let instance = this.scopedInstances.get(serviceId) as T;
    
    if (!instance) {
      logger.debug('Creating scoped service', { serviceId });
      instance = descriptor.factory(this);
      this.scopedInstances.set(serviceId, instance);
    }
    
    return instance;
  }

  private resolveTransient<T>(serviceId: string, descriptor: ServiceDescriptor<T>): T {
    logger.debug('Creating transient service', { serviceId });
    return descriptor.factory(this);
  }

  private async disposeInstances(instances: Map<string, unknown>): Promise<void> {
    const disposals: Promise<void>[] = [];

    for (const [serviceId, instance] of instances) {
      if (this.isDisposable(instance)) {
        logger.debug('Disposing service', { serviceId });
        
        try {
          const disposal = instance.dispose();
          if (disposal instanceof Promise) {
            disposals.push(disposal);
          }
        } catch (error) {
          logger.error('Error disposing service', error as Error, { serviceId });
        }
      }
    }

    await Promise.allSettled(disposals);
  }

  private isDisposable(obj: unknown): obj is DisposableService {
    return obj !== null && 
           typeof obj === 'object' && 
           typeof (obj as any).dispose === 'function';
  }

  private isDisposableFactory<T>(_factory: ServiceFactory<T>): boolean {
    // This is a heuristic - we can't determine if the factory creates disposable objects
    // without actually calling it, so we default to false
    return false;
  }

  private detectCircularDependencies(graph: Record<string, string[]>): string[] {
    const errors: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (serviceId: string, path: string[]): void => {
      if (visiting.has(serviceId)) {
        const cycleStart = path.indexOf(serviceId);
        const cycle = path.slice(cycleStart).concat(serviceId);
        errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
        return;
      }

      if (visited.has(serviceId)) {
        return;
      }

      visiting.add(serviceId);
      const dependencies = graph[serviceId] || [];
      
      for (const dependency of dependencies) {
        visit(dependency, [...path, serviceId]);
      }
      
      visiting.delete(serviceId);
      visited.add(serviceId);
    };

    for (const serviceId of Object.keys(graph)) {
      if (!visited.has(serviceId)) {
        visit(serviceId, []);
      }
    }

    return errors;
  }
}

/**
 * Global service container instance
 * 
 * This is the root container for the application. Services should be registered
 * here during application startup.
 */
export const globalContainer = new ServiceContainer();

/**
 * Service registration helpers
 */
export const ServiceRegistry = {
  /**
   * Register commonly used services
   */
  registerCommonServices(_container: ServiceContainer = globalContainer): void {
    // These would typically be registered during application startup
    logger.info('Common services would be registered here during application startup');
  },

  /**
   * Register optimization services
   */
  registerOptimizationServices(container: ServiceContainer = globalContainer): void {
    // Auto-optimization services
    container.registerSingleton(
      'fileWatcher',
      (_c) => {
        const { FileWatcherService } = require('./auto-optimize/file-watcher.service');
        return new FileWatcherService({
          watchPatterns: ['**/*.prompt', '**/*.md', 'templates/**/*'],
          debounceMs: 2000,
        });
      },
      []
    );

    container.registerSingleton(
      'jobProcessor', 
      (_c) => {
        const { JobProcessorService } = require('./auto-optimize/job-processor.service');
        return new JobProcessorService({
          maxConcurrentJobs: 3,
          maxRetryAttempts: 2,
          retryBackoffMs: 5000,
          jobTimeoutMs: 30000,
        });
      },
      []
    );

    container.registerSingleton(
      'notificationService',
      (_c) => {
        const { NotificationService } = require('./auto-optimize/notification.service');
        return new NotificationService({ enabled: true });
      },
      []
    );

    container.registerSingleton(
      'unifiedOptimization',
      (_c) => {
        const { UnifiedOptimizationService } = require('./unified-optimization.service');
        const { getPromptWizardConfig } = require('../config/promptwizard.config');
        
        const config = getPromptWizardConfig();
        return new UnifiedOptimizationService({
          promptWizard: {
            enabled: true,
            serviceUrl: config.connection.serviceUrl,
            timeout: config.connection.timeout,
            retries: config.connection.retries,
          },
          cache: { maxSize: 1000, ttlMs: 86400000, useRedis: false },
          queue: { maxConcurrent: 3, retryAttempts: 2, backoffMs: 5000 },
          defaults: {
            targetModel: config.optimization.defaultModel,
            mutateRefineIterations: config.optimization.mutateRefineIterations,
            fewShotCount: config.optimization.fewShotCount,
            generateReasoning: config.optimization.generateReasoning,
          },
        }, {
          cacheService: c.tryResolve('cacheService') || undefined,
          templateService: c.tryResolve('templateService') || undefined,
        });
      },
      ['cacheService', 'templateService']
    );

    container.registerSingleton(
      'autoOptimizeCoordinator',
      (_c) => {
        const { AutoOptimizeCoordinator } = require('./auto-optimize/auto-optimize-coordinator');
        
        return new AutoOptimizeCoordinator(
          AutoOptimizeCoordinator.getDefaultOptions(),
          {
            fileWatcher: c.resolve('fileWatcher'),
            jobProcessor: c.resolve('jobProcessor'),
            notificationService: c.resolve('notificationService'),
            optimizationService: c.resolve('unifiedOptimization'),
          }
        );
      },
      ['fileWatcher', 'jobProcessor', 'notificationService', 'unifiedOptimization']
    );

    logger.info('Optimization services registered in container');
  },
};