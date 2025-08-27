/**
 * @fileoverview Notification service for auto-optimization
 * @lastmodified 2025-08-27T05:00:00Z
 *
 * Features: Desktop notifications, notification history, platform-specific implementations
 * Main APIs: send(), enable(), disable(), getHistory()
 * Constraints: Single responsibility - only handles notifications
 * Patterns: Strategy pattern for different platforms, event tracking
 */

import * as os from 'os';
import * as child_process from 'child_process';
import { logger } from '../../utils/logger';

export interface NotificationOptions {
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Notification icon (platform-specific) */
  icon?: string;
  /** Notification sound (platform-specific) */
  sound?: boolean;
  /** Auto-dismiss timeout (ms) */
  timeout?: number;
}

export interface NotificationHistory {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  platform: string;
  success: boolean;
  error?: string;
}

/**
 * Notification service focused solely on sending desktop notifications
 *
 * This service handles the notification logic that was previously
 * embedded in AutoOptimizeManager, following single responsibility principle.
 */
export class NotificationService {
  private enabled: boolean = true;

  private history: NotificationHistory[] = [];

  private maxHistorySize: number = 100;

  private platform: string;

  constructor(options: { enabled?: boolean; maxHistorySize?: number } = {}) {
    this.enabled = options.enabled ?? true;
    this.maxHistorySize = options.maxHistorySize ?? 100;
    this.platform = os.platform();
  }

  /**
   * Send a notification
   */
  async send(options: NotificationOptions): Promise<boolean> {
    if (!this.enabled) {
      logger.debug('Notifications disabled, skipping notification', options);
      return false;
    }

    const notificationId = this.generateNotificationId();

    try {
      await this.sendPlatformNotification(options);

      this.addToHistory({
        id: notificationId,
        title: options.title,
        message: options.message,
        timestamp: new Date(),
        platform: this.platform,
        success: true,
      });

      logger.debug('Notification sent successfully', {
        id: notificationId,
        title: options.title,
        platform: this.platform,
      });

      return true;
    } catch (error) {
      const errorMessage = (error as Error).message;

      this.addToHistory({
        id: notificationId,
        title: options.title,
        message: options.message,
        timestamp: new Date(),
        platform: this.platform,
        success: false,
        error: errorMessage,
      });

      logger.error('Failed to send notification', error as Error, {
        id: notificationId,
        title: options.title,
      });

      return false;
    }
  }

  /**
   * Send optimization started notification
   */
  async sendOptimizationStarted(templatePath: string): Promise<boolean> {
    return this.send({
      title: 'Optimization Started',
      message: `Optimizing template: ${this.getTemplateDisplayName(templatePath)}`,
      sound: false,
      timeout: 3000,
    });
  }

  /**
   * Send optimization completed notification
   */
  async sendOptimizationCompleted(
    templatePath: string,
    tokenReduction?: number
  ): Promise<boolean> {
    const reductionText = tokenReduction
      ? ` (${tokenReduction.toFixed(1)}% token reduction)`
      : '';

    return this.send({
      title: 'Optimization Completed',
      message: `Template optimized: ${this.getTemplateDisplayName(templatePath)}${reductionText}`,
      sound: true,
      timeout: 5000,
    });
  }

  /**
   * Send optimization failed notification
   */
  async sendOptimizationFailed(
    templatePath: string,
    error: string
  ): Promise<boolean> {
    return this.send({
      title: 'Optimization Failed',
      message: `Failed to optimize ${this.getTemplateDisplayName(templatePath)}: ${error}`,
      sound: true,
      timeout: 10000,
    });
  }

  /**
   * Send batch optimization completed notification
   */
  async sendBatchCompleted(
    totalFiles: number,
    successCount: number,
    failureCount: number
  ): Promise<boolean> {
    return this.send({
      title: 'Batch Optimization Completed',
      message: `Processed ${totalFiles} templates: ${successCount} successful, ${failureCount} failed`,
      sound: true,
      timeout: 8000,
    });
  }

  /**
   * Send auto-optimization enabled notification
   */
  async sendAutoOptimizationEnabled(): Promise<boolean> {
    return this.send({
      title: 'Auto-Optimization Enabled',
      message: 'Templates will be optimized automatically on save',
      sound: false,
      timeout: 4000,
    });
  }

  /**
   * Send auto-optimization disabled notification
   */
  async sendAutoOptimizationDisabled(): Promise<boolean> {
    return this.send({
      title: 'Auto-Optimization Disabled',
      message: 'Templates will no longer be optimized automatically',
      sound: false,
      timeout: 4000,
    });
  }

  /**
   * Enable notifications
   */
  enable(): void {
    this.enabled = true;
    logger.info('Notifications enabled');
  }

  /**
   * Disable notifications
   */
  disable(): void {
    this.enabled = false;
    logger.info('Notifications disabled');
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get notification history
   */
  getHistory(limit?: number): NotificationHistory[] {
    const history = [...this.history].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Clear notification history
   */
  clearHistory(): void {
    this.history = [];
    logger.info('Notification history cleared');
  }

  /**
   * Get notification statistics
   */
  getStats(): {
    total: number;
    successful: number;
    failed: number;
    platforms: Record<string, number>;
  } {
    const stats = {
      total: this.history.length,
      successful: 0,
      failed: 0,
      platforms: {} as Record<string, number>,
    };

    this.history.forEach(notification => {
      if (notification.success) {
        stats.successful += 1;
      } else {
        stats.failed += 1;
      }

      stats.platforms[notification.platform] =
        (stats.platforms[notification.platform] || 0) + 1;
    });

    return stats;
  }

  // Private methods

  private async sendPlatformNotification(
    options: NotificationOptions
  ): Promise<void> {
    switch (this.platform) {
      case 'darwin':
        await this.sendMacOSNotification(options);
        break;

      case 'linux':
        await this.sendLinuxNotification(options);
        break;

      case 'win32':
        await this.sendWindowsNotification(options);
        break;

      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  private async sendMacOSNotification(
    options: NotificationOptions
  ): Promise<void> {
    const { title, message, sound = false } = options;

    const soundArg = sound ? '' : 'with no sound';
    const script = `display notification "${message}" with title "${title}" ${soundArg}`;

    return new Promise((resolve, reject) => {
      child_process.exec(
        `osascript -e '${script}'`,
        (error, _stdout, _stderr) => {
          if (error) {
            reject(new Error(`macOS notification failed: ${error.message}`));
          } else {
            resolve();
          }
        }
      );
    });
  }

  private async sendLinuxNotification(
    options: NotificationOptions
  ): Promise<void> {
    const { title, message, timeout = 5000 } = options;

    return new Promise((resolve, reject) => {
      child_process.exec(
        `notify-send "${title}" "${message}" --expire-time=${timeout}`,
        (error, _stdout, _stderr) => {
          if (error) {
            reject(new Error(`Linux notification failed: ${error.message}`));
          } else {
            resolve();
          }
        }
      );
    });
  }

  private async sendWindowsNotification(
    options: NotificationOptions
  ): Promise<void> {
    // Windows notifications require more complex setup or third-party tools
    // For now, we'll just log the notification
    logger.info(`Windows Notification: ${options.title} - ${options.message}`);

    // In a real implementation, you might use:
    // - Windows Toast Notification API via PowerShell
    // - node-notifier library
    // - Electron's notification API if running in Electron

    // For demonstration, we'll simulate success
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private addToHistory(notification: NotificationHistory): void {
    this.history.push(notification);

    // Maintain history size limit
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }

  private getTemplateDisplayName(templatePath: string): string {
    const parts = templatePath.split('/');
    return parts[parts.length - 1] || templatePath;
  }
}
