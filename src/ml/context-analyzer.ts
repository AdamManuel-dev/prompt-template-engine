/**
 * @fileoverview Context analyzer for intelligent prompt optimization
 * @lastmodified 2025-08-26T12:30:00Z
 *
 * Features: Context relevance analysis, token optimization, redundancy detection
 * Main APIs: analyzeContext(), optimizeTokenUsage(), suggestImprovements()
 * Constraints: Token limits, model-specific requirements
 * Patterns: Strategy pattern for analysis methods, pipeline processing
 */

import { logger } from '../utils/logger';
import { Template } from '../types';

export interface ContextAnalysisResult {
  relevanceScore: number;
  tokenCount: number;
  redundancies: RedundantSection[];
  suggestions: ContextSuggestion[];
  optimizedContext?: string;
}

export interface RedundantSection {
  startIndex: number;
  endIndex: number;
  content: string;
  reason: string;
  impact: 'low' | 'medium' | 'high';
}

export interface ContextSuggestion {
  type: 'remove' | 'rephrase' | 'restructure' | 'consolidate';
  target: string;
  suggestion: string;
  tokenSavings: number;
  qualityImpact: number;
}

export interface AnalysisConfig {
  maxTokens?: number;
  targetModel?: string;
  aggressiveness?: 'conservative' | 'moderate' | 'aggressive';
  preserveSemantic?: boolean;
  focusAreas?: string[];
}

export class ContextAnalyzer {
  private readonly tokenLimits = {
    'gpt-4': 8192,
    'gpt-3.5-turbo': 4096,
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'gemini-pro': 32768,
  };

  private readonly stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was',
    'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
    'shall', 'to', 'of', 'in', 'for', 'with', 'by', 'from', 'about',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'then', 'once',
  ]);

  /**
   * Analyze context relevance and quality
   */
  async analyzeContext(
    context: string,
    template: Template,
    config: AnalysisConfig = {}
  ): Promise<ContextAnalysisResult> {
    logger.info(`Analyzing context for template: ${template.name}`);

    const tokenCount = this.estimateTokenCount(context);
    const redundancies = this.detectRedundancies(context);
    const relevanceScore = this.calculateRelevanceScore(context, template);
    const suggestions = this.generateSuggestions(
      context,
      redundancies,
      config
    );

    let optimizedContext: string | undefined;
    if (config.aggressiveness !== 'conservative') {
      optimizedContext = await this.optimizeContext(
        context,
        suggestions,
        config
      );
    }

    const result: ContextAnalysisResult = {
      relevanceScore,
      tokenCount,
      redundancies,
      suggestions,
      optimizedContext,
    };

    logger.info(
      `Context analysis complete: ${tokenCount} tokens, ` +
      `relevance: ${relevanceScore.toFixed(2)}, ` +
      `${redundancies.length} redundancies found`
    );

    return result;
  }

  /**
   * Optimize token usage while preserving meaning
   */
  async optimizeTokenUsage(
    content: string,
    targetReduction: number = 0.3,
    config: AnalysisConfig = {}
  ): Promise<{ optimized: string; reduction: number }> {
    logger.info(`Optimizing token usage with target reduction: ${targetReduction * 100}%`);

    let optimized = content;
    const originalTokens = this.estimateTokenCount(content);

    // Apply optimization strategies
    optimized = this.removeRedundantPhrases(optimized);
    optimized = this.simplifyComplexSentences(optimized);
    optimized = this.consolidateRepeatedConcepts(optimized);
    
    if (config.aggressiveness === 'aggressive') {
      optimized = this.aggressiveOptimization(optimized);
    }

    const optimizedTokens = this.estimateTokenCount(optimized);
    const reduction = (originalTokens - optimizedTokens) / originalTokens;

    logger.info(
      `Token optimization complete: ${originalTokens} → ${optimizedTokens} ` +
      `(${(reduction * 100).toFixed(1)}% reduction)`
    );

    return { optimized, reduction };
  }

  /**
   * Suggest context improvements
   */
  suggestImprovements(
    context: string,
    focusAreas: string[] = []
  ): ContextSuggestion[] {
    const suggestions: ContextSuggestion[] = [];

    // Analyze sentence structure
    const sentences = this.splitIntoSentences(context);
    sentences.forEach(sentence => {
      if (sentence.length > 150) {
        suggestions.push({
          type: 'rephrase',
          target: sentence.substring(0, 50) + '...',
          suggestion: 'Break this long sentence into shorter, clearer statements',
          tokenSavings: Math.floor(sentence.length * 0.2),
          qualityImpact: 0.1,
        });
      }
    });

    // Check for redundant information
    const redundantPhrases = this.findRedundantPhrases(context);
    redundantPhrases.forEach(phrase => {
      suggestions.push({
        type: 'remove',
        target: phrase,
        suggestion: 'This phrase appears multiple times and can be consolidated',
        tokenSavings: phrase.split(' ').length * 2,
        qualityImpact: -0.05,
      });
    });

    // Analyze focus areas
    if (focusAreas.length > 0) {
      const irrelevantSections = this.findIrrelevantSections(context, focusAreas);
      irrelevantSections.forEach(section => {
        suggestions.push({
          type: 'remove',
          target: section.substring(0, 30) + '...',
          suggestion: 'This section is not directly relevant to the focus areas',
          tokenSavings: this.estimateTokenCount(section),
          qualityImpact: -0.1,
        });
      });
    }

    // Sort suggestions by potential impact
    suggestions.sort((a, b) => {
      const impactA = a.tokenSavings * (1 - Math.abs(a.qualityImpact));
      const impactB = b.tokenSavings * (1 - Math.abs(b.qualityImpact));
      return impactB - impactA;
    });

    return suggestions;
  }

  // Private helper methods

  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    // More accurate would use actual tokenizer
    const wordCount = text.split(/\s+/).length;
    const charCount = text.length;
    
    // Average between word-based and char-based estimates
    const wordBasedEstimate = wordCount * 1.3;
    const charBasedEstimate = charCount / 4;
    
    return Math.ceil((wordBasedEstimate + charBasedEstimate) / 2);
  }

  private detectRedundancies(context: string): RedundantSection[] {
    const redundancies: RedundantSection[] = [];
    const sentences = this.splitIntoSentences(context);
    const seenConcepts = new Map<string, number>();

    sentences.forEach((sentence, index) => {
      const normalized = this.normalizeSentence(sentence);
      const conceptKey = this.extractConceptKey(normalized);

      if (seenConcepts.has(conceptKey)) {
        const firstIndex = seenConcepts.get(conceptKey)!;
        redundancies.push({
          startIndex: context.indexOf(sentence),
          endIndex: context.indexOf(sentence) + sentence.length,
          content: sentence,
          reason: `Similar to sentence at position ${firstIndex}`,
          impact: 'medium',
        });
      } else {
        seenConcepts.set(conceptKey, index);
      }
    });

    // Detect repeated phrases
    const phrases = this.extractPhrases(context);
    const phraseCounts = new Map<string, number>();
    
    phrases.forEach(phrase => {
      const count = (phraseCounts.get(phrase) || 0) + 1;
      phraseCounts.set(phrase, count);
      
      if (count > 2) {
        redundancies.push({
          startIndex: context.lastIndexOf(phrase),
          endIndex: context.lastIndexOf(phrase) + phrase.length,
          content: phrase,
          reason: `Phrase repeated ${count} times`,
          impact: 'low',
        });
      }
    });

    return redundancies;
  }

  private calculateRelevanceScore(context: string, template: Template): number {
    let score = 1.0;

    // Check if context contains template-specific keywords
    const templateKeywords = this.extractKeywords(template.content || '');
    const contextKeywords = this.extractKeywords(context);
    
    const overlap = this.calculateKeywordOverlap(templateKeywords, contextKeywords);
    score *= overlap;

    // Check context coherence
    const coherence = this.calculateCoherence(context);
    score *= coherence;

    // Check information density
    const density = this.calculateInformationDensity(context);
    score *= density;

    return Math.min(1.0, Math.max(0.0, score));
  }

  private generateSuggestions(
    context: string,
    redundancies: RedundantSection[],
    config: AnalysisConfig
  ): ContextSuggestion[] {
    const suggestions: ContextSuggestion[] = [];

    // Suggest removing high-impact redundancies
    redundancies
      .filter(r => r.impact !== 'low')
      .forEach(redundancy => {
        suggestions.push({
          type: 'remove',
          target: redundancy.content.substring(0, 50) + '...',
          suggestion: redundancy.reason,
          tokenSavings: this.estimateTokenCount(redundancy.content),
          qualityImpact: -0.05,
        });
      });

    // Suggest consolidating similar sections
    const similarSections = this.findSimilarSections(context);
    similarSections.forEach(({ section1, section2 }) => {
      suggestions.push({
        type: 'consolidate',
        target: `${section1.substring(0, 30)}... and ${section2.substring(0, 30)}...`,
        suggestion: 'These sections can be consolidated into one',
        tokenSavings: Math.min(
          this.estimateTokenCount(section1),
          this.estimateTokenCount(section2)
        ),
        qualityImpact: 0.05,
      });
    });

    return suggestions;
  }

  private async optimizeContext(
    context: string,
    suggestions: ContextSuggestion[],
    config: AnalysisConfig
  ): Promise<string> {
    let optimized = context;

    // Apply suggestions based on configuration
    const applicableSuggestions = suggestions.filter(s => {
      if (config.aggressiveness === 'conservative') {
        return s.qualityImpact >= 0;
      } else if (config.aggressiveness === 'moderate') {
        return s.qualityImpact >= -0.1;
      } else {
        return true; // Apply all suggestions in aggressive mode
      }
    });

    // Sort by impact and apply
    applicableSuggestions
      .sort((a, b) => b.tokenSavings - a.tokenSavings)
      .forEach(suggestion => {
        if (suggestion.type === 'remove') {
          optimized = optimized.replace(suggestion.target, '');
        } else if (suggestion.type === 'rephrase') {
          // In real implementation, would use LLM for rephrasing
          optimized = this.simplifyText(optimized);
        }
      });

    return optimized.trim();
  }

  private removeRedundantPhrases(text: string): string {
    const phrases = text.split(/[.!?]+/);
    const uniquePhrases = new Set<string>();
    const result: string[] = [];

    phrases.forEach(phrase => {
      const normalized = this.normalizeSentence(phrase);
      if (!uniquePhrases.has(normalized) && phrase.trim()) {
        uniquePhrases.add(normalized);
        result.push(phrase);
      }
    });

    return result.join('. ').trim();
  }

  private simplifyComplexSentences(text: string): string {
    // Simplified implementation - in production would use NLP
    return text
      .replace(/\s+which\s+/g, ' that ')
      .replace(/\s+however[,\s]+/gi, '. But ')
      .replace(/\s+furthermore[,\s]+/gi, '. Also, ')
      .replace(/\s+nevertheless[,\s]+/gi, '. Still, ')
      .replace(/\s+consequently[,\s]+/gi, '. So ')
      .replace(/\s+therefore[,\s]+/gi, '. Thus ')
      .replace(/\s{2,}/g, ' ');
  }

  private consolidateRepeatedConcepts(text: string): string {
    const sentences = this.splitIntoSentences(text);
    const conceptMap = new Map<string, string[]>();

    sentences.forEach(sentence => {
      const concept = this.extractConceptKey(sentence);
      if (!conceptMap.has(concept)) {
        conceptMap.set(concept, []);
      }
      conceptMap.get(concept)!.push(sentence);
    });

    const consolidated: string[] = [];
    conceptMap.forEach(sentences => {
      if (sentences.length > 1) {
        // Keep the longest, most informative version
        const best = sentences.reduce((a, b) => a.length > b.length ? a : b);
        consolidated.push(best);
      } else {
        consolidated.push(sentences[0]);
      }
    });

    return consolidated.join(' ');
  }

  private aggressiveOptimization(text: string): string {
    // Remove all filler words and phrases
    let optimized = text;
    const fillers = [
      /\b(basically|actually|really|very|just|quite|rather|somewhat)\b/gi,
      /\b(in order to)\b/gi,
      /\b(the fact that)\b/gi,
      /\b(it is important to note that)\b/gi,
      /\b(it should be noted that)\b/gi,
    ];

    fillers.forEach(filler => {
      optimized = optimized.replace(filler, '');
    });

    // Compress whitespace
    optimized = optimized.replace(/\s{2,}/g, ' ');

    return optimized;
  }

  // Utility methods

  private splitIntoSentences(text: string): string[] {
    return text.match(/[^.!?]+[.!?]+/g) || [];
  }

  private normalizeSentence(sentence: string): string {
    return sentence
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => !this.stopWords.has(word))
      .join(' ');
  }

  private extractConceptKey(sentence: string): string {
    const words = this.normalizeSentence(sentence).split(' ');
    // Use first 3 and last 2 non-stop words as concept key
    return [...words.slice(0, 3), ...words.slice(-2)].join('-');
  }

  private extractPhrases(text: string, minLength: number = 3): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const phrases: string[] = [];

    for (let i = 0; i < words.length - minLength + 1; i++) {
      const phrase = words.slice(i, i + minLength).join(' ');
      if (!phrase.split(' ').every(w => this.stopWords.has(w))) {
        phrases.push(phrase);
      }
    }

    return phrases;
  }

  private extractKeywords(text: string): Set<string> {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => !this.stopWords.has(word) && word.length > 3);

    return new Set(words);
  }

  private calculateKeywordOverlap(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 || set2.size === 0) return 0.5;

    let overlap = 0;
    set1.forEach(keyword => {
      if (set2.has(keyword)) overlap++;
    });

    return overlap / Math.min(set1.size, set2.size);
  }

  private calculateCoherence(text: string): number {
    const sentences = this.splitIntoSentences(text);
    if (sentences.length < 2) return 1.0;

    let coherenceScore = 0;
    for (let i = 1; i < sentences.length; i++) {
      const prev = this.extractKeywords(sentences[i - 1]);
      const curr = this.extractKeywords(sentences[i]);
      coherenceScore += this.calculateKeywordOverlap(prev, curr);
    }

    return coherenceScore / (sentences.length - 1);
  }

  private calculateInformationDensity(text: string): number {
    const totalWords = text.split(/\s+/).length;
    const meaningfulWords = text
      .split(/\s+/)
      .filter(word => !this.stopWords.has(word.toLowerCase())).length;

    return meaningfulWords / totalWords;
  }

  private findSimilarSections(
    text: string
  ): Array<{ section1: string; section2: string }> {
    const sections = text.split(/\n\n+/);
    const similar: Array<{ section1: string; section2: string }> = [];

    for (let i = 0; i < sections.length - 1; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        const similarity = this.calculateSimilarity(sections[i], sections[j]);
        if (similarity > 0.7) {
          similar.push({ section1: sections[i], section2: sections[j] });
        }
      }
    }

    return similar;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const keywords1 = this.extractKeywords(text1);
    const keywords2 = this.extractKeywords(text2);
    return this.calculateKeywordOverlap(keywords1, keywords2);
  }

  private findRedundantPhrases(text: string): string[] {
    const phrases = this.extractPhrases(text);
    const phraseCounts = new Map<string, number>();

    phrases.forEach(phrase => {
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    });

    return Array.from(phraseCounts.entries())
      .filter(([, count]) => count > 2)
      .map(([phrase]) => phrase);
  }

  private findIrrelevantSections(text: string, focusAreas: string[]): string[] {
    const sections = text.split(/\n\n+/);
    const focusKeywords = new Set<string>();

    focusAreas.forEach(area => {
      this.extractKeywords(area).forEach(keyword => focusKeywords.add(keyword));
    });

    return sections.filter(section => {
      const sectionKeywords = this.extractKeywords(section);
      const overlap = this.calculateKeywordOverlap(sectionKeywords, focusKeywords);
      return overlap < 0.2;
    });
  }

  private simplifyText(text: string): string {
    // Basic simplification - in production would use more sophisticated NLP
    return text
      .replace(/([.!?])\s*\1+/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }
}