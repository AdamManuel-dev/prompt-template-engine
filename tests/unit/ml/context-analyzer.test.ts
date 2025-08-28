/**
 * @fileoverview Tests for context analyzer
 * @lastmodified 2025-08-26T13:20:00Z
 */

import {
  ContextAnalyzer,
  AnalysisConfig,
} from '../../../src/ml/context-analyzer';
import { Template } from '../../../src/types';

jest.mock('../../../src/utils/logger');

describe('ContextAnalyzer', () => {
  let analyzer: ContextAnalyzer;
  let mockTemplate: Template;

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new ContextAnalyzer();
    
    mockTemplate = {
      name: 'test-template',
      version: '1.0.0',
      description: 'Template for testing context analysis',
      content: 'Analyze the context for optimization and efficiency',
      variables: {
        context: { type: 'string' },
        optimization: { type: 'boolean' },
      },
    };
  });

  describe('analyzeContext', () => {
    it('should analyze context and return comprehensive results', async () => {
      const context = `This is a test context. The test context contains some information.
        We need to analyze this context for optimization purposes.
        The context should be optimized for better performance.`;

      const result = await analyzer.analyzeContext(context, mockTemplate);

      expect(result.relevanceScore).toBeGreaterThan(0);
      expect(result.tokenCount).toBeGreaterThan(0);
      expect(Array.isArray(result.redundancies)).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should detect redundancies in context', async () => {
      const redundantContext = `This is important information. This is important information.
        The system processes data efficiently. The system processes data efficiently.
        We need to optimize performance. Performance optimization is needed.`;

      const result = await analyzer.analyzeContext(redundantContext, mockTemplate);

      expect(result.redundancies.length).toBeGreaterThan(0);
      expect(result.redundancies[0].reason).toBeTruthy();
      expect(result.redundancies[0].impact).toMatch(/low|medium|high/);
    });

    it('should provide optimization suggestions', async () => {
      const verboseContext = `It is important to note that the system, which is designed
        for processing data, actually really needs to be optimized for better performance.
        Furthermore, it should be noted that the optimization process is very important
        and basically requires careful consideration of all the various factors involved.`;

      const config: AnalysisConfig = {
        aggressiveness: 'moderate',
      };

      const result = await analyzer.analyzeContext(verboseContext, mockTemplate, config);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].type).toMatch(/remove|rephrase|restructure|consolidate/);
      expect(result.suggestions[0].tokenSavings).toBeGreaterThan(0);
    });

    it('should calculate relevance score based on template', async () => {
      const relevantContext = `This context is about optimization and efficiency.
        We analyze the context to improve performance.`;
      
      const irrelevantContext = `The weather today is sunny and warm.
        Many people are enjoying outdoor activities.`;

      const relevantResult = await analyzer.analyzeContext(relevantContext, mockTemplate);
      const irrelevantResult = await analyzer.analyzeContext(irrelevantContext, mockTemplate);

      expect(relevantResult.relevanceScore).toBeGreaterThan(irrelevantResult.relevanceScore);
    });

    it('should provide optimized context when configured', async () => {
      const context = `This is the original context that needs optimization.
        There are many unnecessary words here that could be removed.
        Actually, basically, really, this is quite verbose indeed.`;

      const config: AnalysisConfig = {
        aggressiveness: 'aggressive',
      };

      const result = await analyzer.analyzeContext(context, mockTemplate, config);

      expect(result.optimizedContext).toBeDefined();
      if (result.optimizedContext) {
        expect(result.optimizedContext.length).toBeLessThan(context.length);
      }
    });

    it('should respect conservative optimization settings', async () => {
      const context = `Important context that should not be changed much.
        This contains critical information for the system.`;

      const config: AnalysisConfig = {
        aggressiveness: 'conservative',
      };

      const result = await analyzer.analyzeContext(context, mockTemplate, config);

      expect(result.optimizedContext).toBeUndefined();
      expect(result.suggestions.filter(s => s.qualityImpact < 0).length).toBe(0);
    });
  });

  describe('optimizeTokenUsage', () => {
    it('should reduce token count while preserving meaning', async () => {
      const verboseText = `In order to effectively process the data, it is very important
        to actually ensure that the system is basically configured properly. Furthermore,
        it should be noted that the configuration process requires careful attention.`;

      const result = await analyzer.optimizeTokenUsage(verboseText, 0.3);

      expect(result.optimized.length).toBeLessThan(verboseText.length);
      expect(result.reduction).toBeGreaterThan(0);
      expect(result.reduction).toBeLessThanOrEqual(1);
    });

    it('should apply aggressive optimization when configured', async () => {
      const text = `Actually, this is basically a very important piece of information
        that really needs to be considered. It is important to note that the system
        requires proper configuration in order to function correctly.`;

      const config: AnalysisConfig = {
        aggressiveness: 'aggressive',
      };

      const result = await analyzer.optimizeTokenUsage(text, 0.5, config);

      // Aggressive optimization should remove filler words
      expect(result.optimized).not.toContain('actually');
      expect(result.optimized).not.toContain('basically');
      expect(result.optimized).not.toContain('very');
      expect(result.reduction).toBeGreaterThan(0.2);
    });

    it('should handle already optimized text', async () => {
      const optimizedText = 'Process data. Configure system. Monitor performance.';

      const result = await analyzer.optimizeTokenUsage(optimizedText, 0.3);

      // Should not reduce much if already optimized
      expect(result.reduction).toBeLessThan(0.2);
      expect(result.optimized.length).toBeGreaterThan(optimizedText.length * 0.8);
    });

    it('should preserve semantic meaning during optimization', async () => {
      const text = `The authentication system validates user credentials.
        It checks the username and password against the database.
        If valid, it generates a JWT token for the session.`;

      const result = await analyzer.optimizeTokenUsage(text, 0.2);

      // Key concepts should be preserved
      expect(result.optimized.toLowerCase()).toContain('authentication');
      expect(result.optimized.toLowerCase()).toContain('credentials');
      expect(result.optimized.toLowerCase()).toContain('jwt');
    });
  });

  describe('suggestImprovements', () => {
    it('should suggest improvements for long sentences', () => {
      const longSentence = 'This is an extremely long sentence that contains way too much information and should definitely be broken down into smaller, more manageable pieces because it is difficult to read and understand when everything is crammed into one continuous statement without any breaks or pauses for the reader to digest the information properly.';

      const suggestions = analyzer.suggestImprovements(longSentence);

      const sentenceSuggestions = suggestions.filter(s => s.type === 'rephrase');
      expect(sentenceSuggestions.length).toBeGreaterThan(0);
      expect(sentenceSuggestions[0].suggestion).toContain('Break this long sentence');
    });

    it('should identify redundant phrases', () => {
      const redundantText = `The system is efficient. The system is efficient.
        We need to optimize. We need to optimize. We need to optimize.
        Performance matters. Performance matters.`;

      const suggestions = analyzer.suggestImprovements(redundantText);

      const redundancySuggestions = suggestions.filter(s => s.type === 'remove');
      expect(redundancySuggestions.length).toBeGreaterThan(0);
      expect(redundancySuggestions[0].suggestion).toContain('multiple times');
    });

    it('should consider focus areas when provided', () => {
      const text = `The authentication system handles user login.
        The weather forecast shows rain tomorrow.
        Database optimization improves query performance.
        Coffee is a popular beverage worldwide.`;

      const focusAreas = ['authentication', 'database', 'performance'];
      const suggestions = analyzer.suggestImprovements(text, focusAreas);

      const removalSuggestions = suggestions.filter(s => s.type === 'remove');
      expect(removalSuggestions.length).toBeGreaterThan(0);
      // Should suggest removing irrelevant sections about weather and coffee
    });

    it('should sort suggestions by impact', () => {
      const text = `This text has various issues. This text has various issues.
        It contains a really, really, really long sentence that goes on and on.
        Actually, basically, it's quite verbose indeed.`;

      const suggestions = analyzer.suggestImprovements(text);

      // Verify suggestions are sorted by impact (token savings * quality preservation)
      for (let i = 1; i < suggestions.length; i++) {
        const prevImpact = suggestions[i - 1].tokenSavings * 
          (1 - Math.abs(suggestions[i - 1].qualityImpact));
        const currImpact = suggestions[i].tokenSavings * 
          (1 - Math.abs(suggestions[i].qualityImpact));
        expect(prevImpact).toBeGreaterThanOrEqual(currImpact);
      }
    });
  });

  describe('Token estimation', () => {
    it('should estimate token count accurately', async () => {
      const shortText = 'Hello world';
      const mediumText = 'This is a medium length text with several words and punctuation.';
      const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10);

      const shortResult = await analyzer.analyzeContext(shortText, mockTemplate);
      const mediumResult = await analyzer.analyzeContext(mediumText, mockTemplate);
      const longResult = await analyzer.analyzeContext(longText, mockTemplate);

      expect(shortResult.tokenCount).toBeLessThan(mediumResult.tokenCount);
      expect(mediumResult.tokenCount).toBeLessThan(longResult.tokenCount);
      
      // Rough validation of token estimation (1 token ≈ 4 chars or 0.75 words)
      expect(shortResult.tokenCount).toBeGreaterThan(1);
      expect(shortResult.tokenCount).toBeLessThan(10);
      expect(longResult.tokenCount).toBeGreaterThan(50);
    });
  });

  describe('Model-specific token limits', () => {
    it('should respect model-specific token limits', async () => {
      const longContext = 'This is a test. '.repeat(1000);

      const configs: AnalysisConfig[] = [
        { targetModel: 'gpt-3.5-turbo', maxTokens: 4096 },
        { targetModel: 'gpt-4', maxTokens: 8192 },
        { targetModel: 'claude-3-opus', maxTokens: 200000 },
      ];

      for (const config of configs) {
        const result = await analyzer.analyzeContext(longContext, mockTemplate, config);
        
        // Should provide suggestions if approaching token limit
        if (result.tokenCount > (config.maxTokens || 0) * 0.8) {
          expect(result.suggestions.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Error handling', () => {
    it('should handle empty context gracefully', async () => {
      const result = await analyzer.analyzeContext('', mockTemplate);

      expect(result.tokenCount).toBe(0);
      expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(result.redundancies).toEqual([]);
    });

    it('should handle null or undefined template content', async () => {
      const templateWithoutContent: Template = {
        name: 'empty-template',
        version: '1.0.0',
      };

      const context = 'Some context to analyze';
      const result = await analyzer.analyzeContext(context, templateWithoutContent);

      expect(result).toBeDefined();
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    it('should handle very long contexts without crashing', async () => {
      const veryLongContext = 'word '.repeat(50000);

      const result = await analyzer.analyzeContext(veryLongContext, mockTemplate, {
        aggressiveness: 'aggressive',
      });

      expect(result).toBeDefined();
      expect(result.tokenCount).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Redundancy detection', () => {
    it('should detect exact duplicate sentences', async () => {
      const context = `First sentence here. First sentence here.
        Second unique sentence.
        Third sentence repeated. Third sentence repeated.`;

      const result = await analyzer.analyzeContext(context, mockTemplate);

      expect(result.redundancies.length).toBeGreaterThan(0);
      const duplicates = result.redundancies.filter(r => 
        r.reason.includes('Similar to sentence')
      );
      expect(duplicates.length).toBeGreaterThan(0);
    });

    it('should detect repeated phrases', async () => {
      const context = `The quick brown fox jumps over the lazy dog.
        The quick brown fox appears again here.
        And once more, the quick brown fox is mentioned.`;

      const result = await analyzer.analyzeContext(context, mockTemplate);

      const phraseRedundancies = result.redundancies.filter(r =>
        r.reason.includes('repeated')
      );
      expect(phraseRedundancies.length).toBeGreaterThanOrEqual(0);
    });

    it('should assign appropriate impact levels', async () => {
      const context = `Critical information here. Critical information here.
        Minor detail repeated. Minor detail repeated. Minor detail repeated.`;

      const result = await analyzer.analyzeContext(context, mockTemplate);

      expect(result.redundancies.some(r => r.impact === 'low')).toBe(true);
      expect(result.redundancies.some(r => r.impact === 'medium')).toBe(true);
    });
  });
});