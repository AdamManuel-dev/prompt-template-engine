/**
 * @fileoverview Auto-optimization services index
 * @lastmodified 2025-08-27T05:15:00Z
 *
 * Features: Exports all refactored auto-optimization services
 * Main Exports: AutoOptimizeCoordinator, FileWatcherService, JobProcessorService, NotificationService
 * Constraints: Single entry point for auto-optimization functionality
 * Patterns: Module exports, service orchestration
 */

// Core coordinator
export { 
  AutoOptimizeCoordinator, 
  autoOptimizeCoordinator,
  type AutoOptimizeCoordinatorOptions,
  type AutoOptimizeStatus,
} from './auto-optimize-coordinator';

// Specialized services
export {
  FileWatcherService,
  type FileWatcherOptions,
  type FileChangeEvent,
} from './file-watcher.service';

export {
  JobProcessorService,
  type OptimizationJob,
  type JobProcessorOptions,
  type JobProcessorStats,
} from './job-processor.service';

export {
  NotificationService,
  type NotificationOptions,
  type NotificationHistory,
} from './notification.service';

// Unified optimization service
export {
  UnifiedOptimizationService,
  type UnifiedOptimizationConfig,
  type OptimizationJobResult,
} from '../unified-optimization.service';

// Unified types
export * from '../../types/unified-optimization.types';