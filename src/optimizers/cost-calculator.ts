/**
 * @fileoverview Cost calculator for AI platform pricing and optimization
 * @lastmodified 2025-08-26T15:00:00Z
 *
 * Features: Multi-platform cost calculation, pricing optimization, ROI analysis
 * Main APIs: CostCalculator class with platform-specific pricing models
 * Constraints: Current pricing models (subject to change)
 * Patterns: Strategy pattern, pricing models, cost optimization analysis
 */

import { logger } from '../utils/logger';

export interface PricingModel {
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'xai' | 'other';
  inputTokenPrice: number; // per 1K tokens
  outputTokenPrice: number; // per 1K tokens
  contextWindow: number;
  specialFeatures?: {
    multimodal?: boolean;
    functionCalling?: boolean;
    realtime?: boolean;
  };
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  model: string;
  provider: string;
}

export interface CostComparison {
  models: Record<string, CostEstimate>;
  cheapest: string;
  mostExpensive: string;
  savings: {
    absolute: number;
    percentage: number;
  };
  recommendations: string[];
}

export interface ROIAnalysis {
  monthlyCost: number;
  annualCost: number;
  costPerRequest: number;
  breakEvenPoint?: number;
  optimizationSavings: {
    tokenReduction: number;
    monthlySavings: number;
    annualSavings: number;
  };
}

export class CostCalculator {
  private readonly pricingModels: Record<string, PricingModel> = {
    // OpenAI Models
    'gpt-4': {
      name: 'GPT-4',
      provider: 'openai',
      inputTokenPrice: 0.03,
      outputTokenPrice: 0.06,
      contextWindow: 128000,
      specialFeatures: { functionCalling: true },
    },
    'gpt-4-turbo': {
      name: 'GPT-4 Turbo',
      provider: 'openai',
      inputTokenPrice: 0.01,
      outputTokenPrice: 0.03,
      contextWindow: 128000,
      specialFeatures: { multimodal: true, functionCalling: true },
    },
    'gpt-3.5-turbo': {
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      inputTokenPrice: 0.0005,
      outputTokenPrice: 0.0015,
      contextWindow: 16385,
      specialFeatures: { functionCalling: true },
    },
    'gpt-4o': {
      name: 'GPT-4o',
      provider: 'openai',
      inputTokenPrice: 0.0025,
      outputTokenPrice: 0.01,
      contextWindow: 128000,
      specialFeatures: { multimodal: true, functionCalling: true },
    },
    'gpt-4o-mini': {
      name: 'GPT-4o Mini',
      provider: 'openai',
      inputTokenPrice: 0.00015,
      outputTokenPrice: 0.0006,
      contextWindow: 128000,
      specialFeatures: { multimodal: true, functionCalling: true },
    },

    // Anthropic Models
    'claude-3-opus': {
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      inputTokenPrice: 0.015,
      outputTokenPrice: 0.075,
      contextWindow: 200000,
    },
    'claude-3-sonnet': {
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
      contextWindow: 200000,
    },
    'claude-3-haiku': {
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      inputTokenPrice: 0.00025,
      outputTokenPrice: 0.00125,
      contextWindow: 200000,
    },
    'claude-3.5-sonnet': {
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
      contextWindow: 200000,
    },

    // Google Models
    'gemini-1.5-pro': {
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      inputTokenPrice: 0.0025,
      outputTokenPrice: 0.0075,
      contextWindow: 2000000,
      specialFeatures: { multimodal: true },
    },
    'gemini-1.5-flash': {
      name: 'Gemini 1.5 Flash',
      provider: 'google',
      inputTokenPrice: 0.000075,
      outputTokenPrice: 0.0003,
      contextWindow: 1000000,
      specialFeatures: { multimodal: true },
    },
    'gemini-pro': {
      name: 'Gemini Pro',
      provider: 'google',
      inputTokenPrice: 0.0005,
      outputTokenPrice: 0.0015,
      contextWindow: 32000,
    },

    // xAI Models
    'grok-beta': {
      name: 'Grok Beta',
      provider: 'xai',
      inputTokenPrice: 0.01,
      outputTokenPrice: 0.02,
      contextWindow: 128000,
      specialFeatures: { realtime: true },
    },
  };

  constructor() {
    logger.debug('CostCalculator initialized with current pricing models');
  }

  /**
   * Calculate cost for a specific model and token usage
   */
  calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number = 0
  ): CostEstimate {
    const pricingModel = this.pricingModels[model];

    if (!pricingModel) {
      throw new Error(`Pricing model not found for ${model}`);
    }

    const inputCost = (inputTokens / 1000) * pricingModel.inputTokenPrice;
    const outputCost = (outputTokens / 1000) * pricingModel.outputTokenPrice;
    const totalCost = inputCost + outputCost;

    return {
      inputTokens,
      outputTokens,
      inputCost: parseFloat(inputCost.toFixed(6)),
      outputCost: parseFloat(outputCost.toFixed(6)),
      totalCost: parseFloat(totalCost.toFixed(6)),
      currency: 'USD',
      model,
      provider: pricingModel.provider,
    };
  }

  /**
   * Compare costs across multiple models
   */
  compareCosts(
    models: string[],
    inputTokens: number,
    outputTokens: number = 0
  ): CostComparison {
    const estimates: Record<string, CostEstimate> = {};

    for (const model of models) {
      try {
        estimates[model] = this.calculateCost(model, inputTokens, outputTokens);
      } catch (error) {
        logger.warn(`Skipping unknown model: ${model}`);
      }
    }

    const costs = Object.values(estimates).map(e => e.totalCost);
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);

    const cheapest =
      Object.entries(estimates).find(
        ([, est]) => est.totalCost === minCost
      )?.[0] || '';
    const mostExpensive =
      Object.entries(estimates).find(
        ([, est]) => est.totalCost === maxCost
      )?.[0] || '';

    const savings = {
      absolute: maxCost - minCost,
      percentage: maxCost > 0 ? ((maxCost - minCost) / maxCost) * 100 : 0,
    };

    const recommendations = this.generateCostRecommendations(
      estimates,
      inputTokens,
      outputTokens
    );

    return {
      models: estimates,
      cheapest,
      mostExpensive,
      savings,
      recommendations,
    };
  }

  /**
   * Calculate ROI analysis for a given usage pattern
   */
  calculateROI(
    model: string,
    monthlyRequests: number,
    avgInputTokens: number,
    avgOutputTokens: number,
    tokenReductionPercentage: number = 0
  ): ROIAnalysis {
    const baseCost = this.calculateCost(model, avgInputTokens, avgOutputTokens);
    const monthlyCost = baseCost.totalCost * monthlyRequests;
    const annualCost = monthlyCost * 12;
    const costPerRequest = baseCost.totalCost;

    // Calculate optimization savings
    const optimizedInputTokens = Math.round(
      avgInputTokens * (1 - tokenReductionPercentage / 100)
    );
    const optimizedCost = this.calculateCost(
      model,
      optimizedInputTokens,
      avgOutputTokens
    );
    const optimizedMonthlyCost = optimizedCost.totalCost * monthlyRequests;

    const monthlySavings = monthlyCost - optimizedMonthlyCost;
    const annualSavings = monthlySavings * 12;
    const tokenReduction = avgInputTokens - optimizedInputTokens;

    return {
      monthlyCost: parseFloat(monthlyCost.toFixed(2)),
      annualCost: parseFloat(annualCost.toFixed(2)),
      costPerRequest: parseFloat(costPerRequest.toFixed(6)),
      optimizationSavings: {
        tokenReduction,
        monthlySavings: parseFloat(monthlySavings.toFixed(2)),
        annualSavings: parseFloat(annualSavings.toFixed(2)),
      },
    };
  }

  /**
   * Find the most cost-effective model for given requirements
   */
  findOptimalModel(requirements: {
    maxCostPerRequest?: number;
    minContextWindow?: number;
    requiredFeatures?: string[];
    inputTokens: number;
    outputTokens?: number;
  }): {
    recommended: string;
    alternatives: string[];
    reasoning: string[];
  } {
    const {
      maxCostPerRequest,
      minContextWindow,
      requiredFeatures = [],
      inputTokens,
      outputTokens = 0,
    } = requirements;

    const candidates: Array<{
      model: string;
      cost: number;
      contextWindow: number;
      features: string[];
    }> = [];

    for (const [modelName, pricingModel] of Object.entries(
      this.pricingModels
    )) {
      const cost = this.calculateCost(modelName, inputTokens, outputTokens);
      const features = this.getModelFeatures(pricingModel);

      // Check basic requirements
      if (maxCostPerRequest && cost.totalCost > maxCostPerRequest) continue;
      if (minContextWindow && pricingModel.contextWindow < minContextWindow)
        continue;

      // Check required features
      const hasAllFeatures = requiredFeatures.every(feature =>
        features.includes(feature.toLowerCase())
      );
      if (!hasAllFeatures) continue;

      candidates.push({
        model: modelName,
        cost: cost.totalCost,
        contextWindow: pricingModel.contextWindow,
        features,
      });
    }

    // Sort by cost (ascending)
    candidates.sort((a, b) => a.cost - b.cost);

    if (candidates.length === 0) {
      return {
        recommended: '',
        alternatives: [],
        reasoning: ['No models meet the specified requirements'],
      };
    }

    const recommended = candidates[0].model;
    const alternatives = candidates.slice(1, 4).map(c => c.model);

    const reasoning = [
      `${recommended} offers the lowest cost at $${candidates[0].cost.toFixed(6)} per request`,
      `Context window: ${candidates[0].contextWindow.toLocaleString()} tokens`,
      `Features: ${candidates[0].features.join(', ')}`,
    ];

    return {
      recommended,
      alternatives,
      reasoning,
    };
  }

  /**
   * Calculate bulk pricing discounts (if applicable)
   */
  calculateBulkPricing(
    model: string,
    monthlyTokenUsage: number
  ): {
    standardCost: number;
    bulkCost: number;
    savings: number;
    tier: string;
  } {
    const baseCost = this.calculateCost(model, monthlyTokenUsage, 0);
    let discount = 0;
    let tier = 'standard';

    // Simulated bulk pricing tiers
    if (monthlyTokenUsage > 100000000) {
      // 100M tokens
      discount = 0.2; // 20% discount
      tier = 'enterprise';
    } else if (monthlyTokenUsage > 10000000) {
      // 10M tokens
      discount = 0.15; // 15% discount
      tier = 'business';
    } else if (monthlyTokenUsage > 1000000) {
      // 1M tokens
      discount = 0.1; // 10% discount
      tier = 'pro';
    }

    const standardCost = baseCost.totalCost;
    const bulkCost = standardCost * (1 - discount);
    const savings = standardCost - bulkCost;

    return {
      standardCost: parseFloat(standardCost.toFixed(2)),
      bulkCost: parseFloat(bulkCost.toFixed(2)),
      savings: parseFloat(savings.toFixed(2)),
      tier,
    };
  }

  /**
   * Generate cost optimization recommendations
   */
  private generateCostRecommendations(
    estimates: Record<string, CostEstimate>,
    inputTokens: number,
    outputTokens: number
  ): string[] {
    const recommendations: string[] = [];
    const sortedByPrice = Object.entries(estimates).sort(
      (a, b) => a[1].totalCost - b[1].totalCost
    );

    if (sortedByPrice.length > 1) {
      const [cheapest, second] = sortedByPrice;
      const savings = second[1].totalCost - cheapest[1].totalCost;
      const percentage = (savings / second[1].totalCost) * 100;

      recommendations.push(
        `Switch to ${cheapest[0]} to save $${savings.toFixed(6)} (${percentage.toFixed(1)}%) per request`
      );
    }

    // Token-specific recommendations
    if (inputTokens > 10000) {
      recommendations.push(
        'Consider token reduction optimization for large prompts'
      );
    }

    if (outputTokens === 0) {
      recommendations.push(
        'Estimate output tokens for more accurate cost calculations'
      );
    }

    // Model-specific recommendations
    const hasGoogleModel = Object.keys(estimates).some(model =>
      model.startsWith('gemini')
    );
    const hasOpenAIModel = Object.keys(estimates).some(model =>
      model.startsWith('gpt')
    );

    if (hasGoogleModel && hasOpenAIModel) {
      recommendations.push(
        'Google models often provide better value for large context windows'
      );
    }

    return recommendations;
  }

  /**
   * Get features for a pricing model
   */
  private getModelFeatures(pricingModel: PricingModel): string[] {
    const features: string[] = [pricingModel.provider];

    if (pricingModel.specialFeatures?.multimodal) features.push('multimodal');
    if (pricingModel.specialFeatures?.functionCalling)
      features.push('function calling');
    if (pricingModel.specialFeatures?.realtime) features.push('realtime');

    // Context window categories
    if (pricingModel.contextWindow >= 1000000) features.push('large context');
    else if (pricingModel.contextWindow >= 100000)
      features.push('medium context');
    else features.push('standard context');

    return features;
  }

  /**
   * Get all available models with their basic info
   */
  getAvailableModels(): Array<{
    model: string;
    name: string;
    provider: string;
    contextWindow: number;
    features: string[];
  }> {
    return Object.entries(this.pricingModels).map(([model, pricing]) => ({
      model,
      name: pricing.name,
      provider: pricing.provider,
      contextWindow: pricing.contextWindow,
      features: this.getModelFeatures(pricing),
    }));
  }

  /**
   * Update pricing for a model (for future API integration)
   */
  updatePricing(model: string, inputPrice: number, outputPrice: number): void {
    if (this.pricingModels[model]) {
      this.pricingModels[model].inputTokenPrice = inputPrice;
      this.pricingModels[model].outputTokenPrice = outputPrice;
      logger.info(`Updated pricing for ${model}`);
    } else {
      logger.warn(`Model ${model} not found for pricing update`);
    }
  }
}

export default CostCalculator;
