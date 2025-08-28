/**
 * @fileoverview Execution history service for tracking template executions and analytics
 * @lastmodified 2025-01-08T20:45:00Z
 *
 * Features: Execution tracking, analytics, performance metrics, error tracking
 * Main APIs: recordExecution(), getExecutionHistory(), getAnalytics(), getPerformanceMetrics()
 * Constraints: Proper status tracking, duration calculation, error logging
 * Patterns: Service layer pattern, analytics aggregation, performance tracking
 */

import {
  Execution,
  ExecutionStatus,
  Prisma,
} from '../generated/prisma';
import { getPrismaClient } from '../db/prisma-client';

const prisma = getPrismaClient();

export interface CreateExecutionRequest {
  userId: string;
  templateId: string;
  templateName: string;
  templatePath?: string;
  parameters: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UpdateExecutionRequest {
  result?: Record<string, any>;
  status: ExecutionStatus;
  duration?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ExecutionFilters {
  userId?: string;
  templateId?: string;
  status?: ExecutionStatus;
  dateFrom?: Date;
  dateTo?: Date;
  hasError?: boolean;
}

export interface ExecutionAnalytics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  successRate: number;
  executionsByStatus: Record<ExecutionStatus, number>;
  executionsByTemplate: Array<{
    templateId: string;
    templateName: string;
    count: number;
    successRate: number;
    avgDuration: number;
  }>;
  executionsByUser: Array<{
    userId: string;
    username?: string;
    count: number;
    successRate: number;
  }>;
  executionTrends: Array<{
    date: string;
    count: number;
    successRate: number;
  }>;
}

export interface PerformanceMetrics {
  templateId: string;
  templateName: string;
  totalExecutions: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p50Duration: number;
  p90Duration: number;
  p95Duration: number;
  errorRate: number;
  lastExecutedAt: Date;
}

/**
 * Execution History Service class for tracking and analyzing template executions
 */
export class ExecutionHistoryService {
  /**
   * Start recording a new execution
   */
  async startExecution(
    executionData: CreateExecutionRequest
  ): Promise<Execution> {
    try {
      const execution = await prisma.execution.create({
        data: {
          ...executionData,
          status: 'PENDING',
          createdAt: new Date(),
        },
      });

      return execution;
    } catch (error) {
      console.error('Error starting execution:', error);
      throw error;
    }
  }

  /**
   * Update execution with results
   */
  async updateExecution(
    id: string,
    updateData: UpdateExecutionRequest
  ): Promise<Execution> {
    try {
      const execution = await prisma.execution.update({
        where: { id },
        data: updateData,
      });

      return execution;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Execution not found');
        }
      }
      throw error;
    }
  }

  /**
   * Complete execution successfully
   */
  async completeExecution(
    id: string,
    result: Record<string, any>,
    duration?: number
  ): Promise<Execution> {
    return await this.updateExecution(id, {
      result,
      status: 'COMPLETED',
      duration,
    });
  }

  /**
   * Mark execution as failed
   */
  async failExecution(
    id: string,
    error: string,
    duration?: number
  ): Promise<Execution> {
    return await this.updateExecution(id, {
      status: 'FAILED',
      error,
      duration,
    });
  }

  /**
   * Cancel execution
   */
  async cancelExecution(id: string): Promise<Execution> {
    return await this.updateExecution(id, {
      status: 'CANCELLED',
    });
  }

  /**
   * Get execution by ID
   */
  async getExecutionById(id: string): Promise<Execution | null> {
    return await prisma.execution.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get paginated execution history with filters
   */
  async getExecutionHistory(
    filters: ExecutionFilters = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<{
    executions: Execution[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const { page = 1, limit = 50 } = pagination;
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ExecutionWhereInput = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.templateId) {
      where.templateId = filters.templateId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    if (filters.hasError !== undefined) {
      if (filters.hasError) {
        where.error = { not: null };
      } else {
        where.error = null;
      }
    }

    // Execute queries in parallel
    const [executions, totalCount] = await Promise.all([
      prisma.execution.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.execution.count({ where }),
    ]);

    return {
      executions,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  }

  /**
   * Get comprehensive execution analytics
   */
  async getAnalytics(
    filters: Pick<ExecutionFilters, 'dateFrom' | 'dateTo' | 'userId'> = {},
    includeTrends = false
  ): Promise<ExecutionAnalytics> {
    const where: Prisma.ExecutionWhereInput = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    // Basic metrics
    const [
      totalCount,
      successfulCount,
      failedCount,
      avgDurationResult,
      executionsByStatus,
      executionsByTemplate,
      executionsByUser,
    ] = await Promise.all([
      // Total executions
      prisma.execution.count({ where }),

      // Successful executions
      prisma.execution.count({
        where: { ...where, status: 'COMPLETED' },
      }),

      // Failed executions
      prisma.execution.count({
        where: { ...where, status: 'FAILED' },
      }),

      // Average duration
      prisma.execution.aggregate({
        where: { ...where, duration: { not: null } },
        _avg: { duration: true },
      }),

      // Executions by status
      prisma.execution.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),

      // Executions by template
      prisma.execution.groupBy({
        by: ['templateId', 'templateName'],
        where,
        _count: true,
        _avg: { duration: true },
      }),

      // Executions by user
      prisma.execution.groupBy({
        by: ['userId'],
        where,
        _count: true,
      }),
    ]);

    // Transform status data
    const statusMap: Record<ExecutionStatus, number> = {
      PENDING: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0,
      TIMEOUT: 0,
    };

    executionsByStatus.forEach(item => {
      statusMap[item.status] = item._count;
    });

    // Calculate template success rates
    const templateStats = await Promise.all(
      executionsByTemplate.map(async template => {
        const successCount = await prisma.execution.count({
          where: {
            ...where,
            templateId: template.templateId,
            status: 'COMPLETED',
          },
        });

        return {
          templateId: template.templateId,
          templateName: template.templateName,
          count: template._count,
          successRate:
            template._count > 0 ? (successCount / template._count) * 100 : 0,
          avgDuration: template._avg.duration || 0,
        };
      })
    );

    // Calculate user success rates
    const userStats = await Promise.all(
      executionsByUser.map(async user => {
        const [successCount, userData] = await Promise.all([
          prisma.execution.count({
            where: {
              ...where,
              userId: user.userId,
              status: 'COMPLETED',
            },
          }),
          prisma.user.findUnique({
            where: { id: user.userId },
            select: { username: true },
          }),
        ]);

        return {
          userId: user.userId,
          username: userData?.username,
          count: user._count,
          successRate: user._count > 0 ? (successCount / user._count) * 100 : 0,
        };
      })
    );

    // Calculate execution trends if requested
    let trends: Array<{ date: string; count: number; successRate: number }> =
      [];
    if (includeTrends) {
      // Get daily execution counts for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const trendData = await prisma.execution.groupBy({
        by: ['createdAt'],
        where: {
          ...where,
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: true,
      });

      // Group by date and calculate success rates
      const dateMap = new Map<string, { total: number; successful: number }>();

      for (const item of trendData) {
        const date = item.createdAt.toISOString().split('T')[0];
        if (!dateMap.has(date)) {
          dateMap.set(date, { total: 0, successful: 0 });
        }
        const entry = dateMap.get(date)!;
        entry.total += item._count;
      }

      // Get successful executions for each date
      const successfulTrendData = await prisma.execution.groupBy({
        by: ['createdAt'],
        where: {
          ...where,
          createdAt: { gte: thirtyDaysAgo },
          status: 'COMPLETED',
        },
        _count: true,
      });

      for (const item of successfulTrendData) {
        const date = item.createdAt.toISOString().split('T')[0];
        if (dateMap.has(date)) {
          dateMap.get(date)!.successful += item._count;
        }
      }

      trends = Array.from(dateMap.entries())
        .map(([date, data]) => ({
          date,
          count: data.total,
          successRate:
            data.total > 0 ? (data.successful / data.total) * 100 : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    return {
      totalExecutions: totalCount,
      successfulExecutions: successfulCount,
      failedExecutions: failedCount,
      averageDuration: avgDurationResult._avg.duration || 0,
      successRate: totalCount > 0 ? (successfulCount / totalCount) * 100 : 0,
      executionsByStatus: statusMap,
      executionsByTemplate: templateStats,
      executionsByUser: userStats,
      executionTrends: trends,
    };
  }

  /**
   * Get performance metrics for templates
   */
  async getPerformanceMetrics(
    templateIds?: string[]
  ): Promise<PerformanceMetrics[]> {
    const where: Prisma.ExecutionWhereInput = {
      duration: { not: null },
    };

    if (templateIds && templateIds.length > 0) {
      where.templateId = { in: templateIds };
    }

    // Get templates with execution data
    const templates = await prisma.execution.groupBy({
      by: ['templateId', 'templateName'],
      where,
      _count: true,
      _avg: { duration: true },
      _min: { duration: true },
      _max: { duration: true },
    });

    const performanceMetrics: PerformanceMetrics[] = [];

    for (const template of templates) {
      // Get duration percentiles
      const durations = await prisma.execution.findMany({
        where: {
          templateId: template.templateId,
          duration: { not: null },
        },
        select: { duration: true },
        orderBy: { duration: 'asc' },
      });

      const sortedDurations = durations
        .map(e => e.duration!)
        .sort((a, b) => a - b);

      const getPercentile = (percentile: number): number => {
        if (sortedDurations.length === 0) return 0;
        const index =
          Math.ceil((percentile / 100) * sortedDurations.length) - 1;
        return sortedDurations[Math.max(0, index)];
      };

      // Calculate error rate
      const [totalCount, errorCount, lastExecution] = await Promise.all([
        prisma.execution.count({
          where: { templateId: template.templateId },
        }),
        prisma.execution.count({
          where: {
            templateId: template.templateId,
            status: 'FAILED',
          },
        }),
        prisma.execution.findFirst({
          where: { templateId: template.templateId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

      performanceMetrics.push({
        templateId: template.templateId,
        templateName: template.templateName,
        totalExecutions: template._count,
        avgDuration: template._avg.duration || 0,
        minDuration: template._min.duration || 0,
        maxDuration: template._max.duration || 0,
        p50Duration: getPercentile(50),
        p90Duration: getPercentile(90),
        p95Duration: getPercentile(95),
        errorRate: totalCount > 0 ? (errorCount / totalCount) * 100 : 0,
        lastExecutedAt: lastExecution?.createdAt || new Date(),
      });
    }

    return performanceMetrics.sort(
      (a, b) => b.totalExecutions - a.totalExecutions
    );
  }

  /**
   * Get recent execution errors for debugging
   */
  async getRecentErrors(limit = 20): Promise<
    Array<{
      id: string;
      templateId: string;
      templateName: string;
      error: string;
      createdAt: Date;
      userId: string;
      username?: string;
    }>
  > {
    const executions = await prisma.execution.findMany({
      where: {
        status: 'FAILED',
        error: { not: null },
      },
      include: {
        user: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return executions.map(execution => ({
      id: execution.id,
      templateId: execution.templateId,
      templateName: execution.templateName,
      error: execution.error!,
      createdAt: execution.createdAt,
      userId: execution.userId,
      username: execution.user.username,
    }));
  }

  /**
   * Delete old execution records (cleanup)
   */
  async cleanupOldExecutions(olderThanDays = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.execution.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }
}

// Export singleton instance
export const executionHistoryService = new ExecutionHistoryService();
