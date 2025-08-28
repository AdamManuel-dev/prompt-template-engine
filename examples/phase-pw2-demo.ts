/**
 * @fileoverview Demo of Phase PW-2 Core Integration - Optimization Pipeline and Feedback Loop
 * @lastmodified 2025-08-26T16:15:00Z
 *
 * Features: Complete example of using the optimization pipeline and feedback loop
 * Main APIs: Demonstrates end-to-end optimization workflow with feedback
 * Constraints: Requires running PromptWizard service and proper configuration
 * Patterns: Usage examples, configuration patterns, error handling
 */

import { createPW2IntegrationSystem } from '../src/core';
import { TemplateService } from '../src/services/template.service';
import { CacheService } from '../src/services/cache.service';
import { Template } from '../src/types';
import { logger } from '../src/utils/logger';

/**
 * Demo template for optimization
 */
const demoTemplate: Template = {
  id: 'demo-template-001',
  name: 'Code Review Assistant',
  version: '1.0.0',
  description: 'Assists with comprehensive code reviews',
  author: 'Demo User',
  category: 'coding',
  language: 'en',
  domain: 'software-development',
  useCase: 'code-review',
  content: `
You are an expert code reviewer. Please review the following code and provide feedback on:
- Code quality and best practices
- Potential bugs or issues
- Performance improvements
- Security considerations
- Documentation quality

Code to review:
{{code_snippet}}

Please provide a structured review with:
1. Overall assessment (Good/Needs Work/Poor)
2. Specific issues found
3. Suggested improvements
4. Security recommendations if applicable

Keep your response concise but thorough.
  `.trim(),
  variables: {
    code_snippet: 'The code snippet to be reviewed',
  },
  tags: ['code-review', 'development', 'quality-assurance'],
};

/**
 * Demo function showing the complete Phase PW-2 workflow
 */
async function demonstratePW2Integration() {
  logger.info('🚀 Starting Phase PW-2 Core Integration Demo');

  try {
    // Initialize services (in a real application, these would come from your DI container)
    const templateService = new TemplateService();
    const cacheService = new CacheService();

    // Create the complete PW-2 integration system
    const pw2System = createPW2IntegrationSystem(templateService, cacheService, {
      pipeline: {
        enablePreprocessing: true,
        enablePostprocessing: true,
        enableValidation: true,
        enableCaching: true,
        progressCallback: (stage, progress) => {
          logger.info(`Pipeline progress: ${stage.name} - ${progress}%`);
        },
      },
      feedback: {
        enableAutoReoptimization: false, // Manual approval for demo
        feedbackThreshold: 5,
        ratingThreshold: 3.0,
        reoptimizationCooldown: 60000, // 1 minute for demo
      },
    });

    // Step 1: Run initial optimization
    logger.info('📝 Step 1: Running initial template optimization');
    const optimizationResult = await pw2System.pipeline.process(
      demoTemplate.id!,
      demoTemplate,
      {
        targetModel: 'gpt-4',
        mutateRefineIterations: 2, // Reduced for demo speed
        fewShotCount: 3,
        generateReasoning: true,
      }
    );

    if (optimizationResult.success) {
      logger.info('✅ Template optimization completed successfully');
      logger.info(`Token reduction: ${optimizationResult.data?.metrics.tokenReduction}`);
      logger.info(`Accuracy improvement: ${optimizationResult.data?.metrics.accuracyImprovement}`);

      // Step 2: Collect user feedback
      logger.info('📊 Step 2: Simulating user feedback collection');
      await pw2System.feedbackLoop.collectFeedback({
        templateId: demoTemplate.id!,
        optimizationId: optimizationResult.data?.requestId,
        rating: 4, // Good rating
        category: 'accuracy',
        comment: 'The optimized template is more concise while maintaining clarity',
      });

      await pw2System.feedbackLoop.collectFeedback({
        templateId: demoTemplate.id!,
        rating: 3, // Average rating
        category: 'clarity',
        comment: 'Could be clearer about security review depth',
      });

      // Step 3: Track performance metrics
      logger.info('📈 Step 3: Tracking performance metrics');
      await pw2System.feedbackLoop.trackPerformance({
        templateId: demoTemplate.id!,
        metricType: 'response_time',
        value: 1200, // milliseconds
        context: { model: 'gpt-4', usage: 'production' },
      });

      await pw2System.feedbackLoop.trackPerformance({
        templateId: demoTemplate.id!,
        metricType: 'user_satisfaction',
        value: 4.2,
        context: { scale: '1-5', responses: 15 },
      });

      // Step 4: Get feedback summary
      logger.info('📋 Step 4: Generating feedback summary');
      const feedbackSummary = pw2System.feedbackLoop.getFeedbackSummary(demoTemplate.id!);
      
      logger.info('Feedback Summary:', {
        totalFeedback: feedbackSummary.totalFeedback,
        averageRating: feedbackSummary.averageRating,
        trend: feedbackSummary.recentTrend,
        recommendReoptimization: feedbackSummary.recommendReoptimization,
      });

      // Step 5: Simulate poor feedback to trigger re-optimization
      logger.info('🔄 Step 5: Simulating poor feedback to test re-optimization');
      
      // Add several poor ratings
      for (let i = 0; i < 3; i++) {
        await pw2System.feedbackLoop.collectFeedback({
          templateId: demoTemplate.id!,
          rating: 2, // Poor rating
          category: 'relevance',
          comment: `Optimization attempt ${i + 1} - still not meeting requirements`,
        });
      }

      // This should trigger a re-optimization recommendation
      const updatedSummary = pw2System.feedbackLoop.getFeedbackSummary(demoTemplate.id!);
      logger.info('Updated feedback summary after poor ratings:', {
        averageRating: updatedSummary.averageRating,
        recommendReoptimization: updatedSummary.recommendReoptimization,
      });

      logger.info('✅ Phase PW-2 Core Integration Demo completed successfully!');
      
      // Cleanup: Clear caches
      pw2System.optimizationService.clearCache();

    } else {
      logger.error('❌ Template optimization failed:', {
        error: optimizationResult.error,
        metrics: optimizationResult.metrics,
      });
    }

  } catch (error) {
    logger.error('❌ Demo failed with error:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Advanced demo showing batch optimization
 */
async function demonstrateBatchOptimization() {
  logger.info('🚀 Starting Batch Optimization Demo');

  try {
    const templateService = new TemplateService();
    const cacheService = new CacheService();
    const pw2System = createPW2IntegrationSystem(templateService, cacheService);

    // Create multiple templates for batch processing
    const templates = [
      { ...demoTemplate, id: 'batch-template-1', name: 'Bug Report Assistant' },
      { ...demoTemplate, id: 'batch-template-2', name: 'Documentation Writer' },
      { ...demoTemplate, id: 'batch-template-3', name: 'Test Case Generator' },
    ];

    logger.info(`📦 Processing ${templates.length} templates in batch`);

    // Use the optimization service directly for batch processing
    const batchResult = await pw2System.optimizationService.batchOptimize({
      templates: templates.map(t => ({ id: t.id!, template: t })),
      config: {
        targetModel: 'gpt-4',
        mutateRefineIterations: 1,
        fewShotCount: 2,
      },
      options: {
        skipCache: false,
        priority: 'normal',
      },
    });

    logger.info('📊 Batch optimization results:', {
      total: batchResult.total,
      successful: batchResult.successful,
      failed: batchResult.failed,
      successRate: `${Math.round((batchResult.successful / batchResult.total) * 100)}%`,
    });

    // Collect feedback for successful optimizations
    for (const result of batchResult.results) {
      await pw2System.feedbackLoop.trackPerformance({
        templateId: result.templateId,
        metricType: 'token_usage',
        value: result.metrics.tokenReduction,
        context: { batchId: batchResult.batchId },
      });
    }

    logger.info('✅ Batch optimization demo completed!');

  } catch (error) {
    logger.error('❌ Batch optimization demo failed:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Run all demos
 */
async function runAllDemos() {
  logger.info('🎯 Running all Phase PW-2 demos');
  
  await demonstratePW2Integration();
  
  logger.info('⏳ Waiting before batch demo...');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  
  await demonstrateBatchOptimization();
  
  logger.info('🎉 All demos completed!');
}

// Run demos if this file is executed directly
if (require.main === module) {
  runAllDemos().catch(console.error);
}

export { demonstratePW2Integration, demonstrateBatchOptimization, runAllDemos };