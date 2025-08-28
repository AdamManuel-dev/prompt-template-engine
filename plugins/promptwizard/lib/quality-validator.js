/**
 * @fileoverview Quality Validator for PromptWizard Plugin
 * @lastmodified 2025-08-26T10:30:00Z
 *
 * Features: Template quality analysis, scoring, and validation
 * Main APIs: analyzeTemplate, calculateQualityScore, validateStructure
 * Constraints: Focuses on AI prompt optimization metrics
 * Patterns: Analyzer pattern, scoring algorithms, validation rules
 */

class QualityValidator {
  constructor(config = {}) {
    this.config = {
      qualityThreshold: 75,
      ...config
    };

    // Quality scoring weights
    this.weights = {
      clarity: 0.25,          // How clear and specific the prompt is
      structure: 0.20,        // Well-structured with proper formatting
      completeness: 0.20,     // Contains all necessary information
      efficiency: 0.15,       // Token efficiency and conciseness
      specificity: 0.10,      // Specific instructions and context
      examples: 0.10          // Includes helpful examples
    };

    // Quality metrics thresholds
    this.thresholds = {
      minLength: 10,
      maxLength: 8000,
      minWords: 5,
      maxWords: 2000,
      idealSentenceLength: 20,
      maxSentenceLength: 50
    };
  }

  /**
   * Analyze template for quality metrics
   * @param {string} template - Template content to analyze
   * @returns {Promise<Object>} Analysis results with quality score
   */
  async analyzeTemplate(template) {
    if (!template || typeof template !== 'string') {
      return {
        qualityScore: 0,
        metrics: {},
        issues: ['Invalid template content'],
        suggestions: ['Provide valid template content']
      };
    }

    const metrics = await this.calculateMetrics(template);
    const qualityScore = this.calculateQualityScore(metrics);
    const issues = this.identifyIssues(metrics);
    const suggestions = this.generateSuggestions(metrics, issues);

    return {
      qualityScore: Math.round(qualityScore * 100) / 100,
      metrics,
      issues,
      suggestions,
      analysis: {
        strengths: this.identifyStrengths(metrics),
        weaknesses: this.identifyWeaknesses(metrics),
        recommendations: this.generateRecommendations(metrics)
      }
    };
  }

  /**
   * Calculate comprehensive quality metrics
   * @param {string} template - Template content
   * @returns {Promise<Object>} Calculated metrics
   * @private
   */
  async calculateMetrics(template) {
    const text = this.extractTextContent(template);
    
    return {
      // Basic metrics
      length: template.length,
      wordCount: this.countWords(text),
      sentenceCount: this.countSentences(text),
      paragraphCount: this.countParagraphs(text),
      
      // Clarity metrics
      clarity: {
        averageSentenceLength: this.calculateAverageSentenceLength(text),
        readabilityScore: this.calculateReadabilityScore(text),
        complexityScore: this.calculateComplexityScore(text),
        ambiguityScore: this.calculateAmbiguityScore(text)
      },
      
      // Structure metrics
      structure: {
        hasIntroduction: this.hasIntroduction(template),
        hasConclusion: this.hasConclusion(template),
        usesFormatting: this.usesFormatting(template),
        hasHeaders: this.hasHeaders(template),
        hasLists: this.hasLists(template),
        hasVariables: this.hasVariables(template)
      },
      
      // Completeness metrics
      completeness: {
        hasContext: this.hasContext(template),
        hasInstructions: this.hasInstructions(template),
        hasConstraints: this.hasConstraints(template),
        hasExamples: this.hasExamples(template),
        specificityScore: this.calculateSpecificityScore(text)
      },
      
      // Efficiency metrics
      efficiency: {
        tokenEstimate: this.estimateTokens(text),
        redundancyScore: this.calculateRedundancyScore(text),
        concisenesScore: this.calculateConcisenessScore(text),
        densityScore: this.calculateInformationDensity(text)
      },
      
      // AI-specific metrics
      aiOptimization: {
        hasRoleDefinition: this.hasRoleDefinition(template),
        hasOutputFormat: this.hasOutputFormat(template),
        hasConstraints: this.hasConstraints(template),
        usesChainOfThought: this.usesChainOfThought(template),
        hasValidationCriteria: this.hasValidationCriteria(template)
      }
    };
  }

  /**
   * Calculate overall quality score based on metrics
   * @param {Object} metrics - Calculated metrics
   * @returns {number} Quality score (0-100)
   * @private
   */
  calculateQualityScore(metrics) {
    const scores = {
      clarity: this.scoreClarityMetrics(metrics.clarity),
      structure: this.scoreStructureMetrics(metrics.structure),
      completeness: this.scoreCompletenessMetrics(metrics.completeness),
      efficiency: this.scoreEfficiencyMetrics(metrics.efficiency),
      specificity: metrics.completeness.specificityScore,
      examples: this.scoreExampleMetrics(metrics.completeness)
    };

    // Calculate weighted average
    let totalScore = 0;
    let totalWeight = 0;

    for (const [category, weight] of Object.entries(this.weights)) {
      if (scores[category] !== undefined) {
        totalScore += scores[category] * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
  }

  /**
   * Extract text content from template (remove variables, formatting)
   * @param {string} template - Template content
   * @returns {string} Plain text content
   * @private
   */
  extractTextContent(template) {
    return template
      .replace(/\{\{[^}]+\}\}/g, '') // Remove template variables
      .replace(/\{[^}]+\}/g, '')     // Remove single brace variables
      .replace(/\[[^\]]+\]/g, '')    // Remove square bracket content
      .replace(/#[^\n]*/g, '')       // Remove headers
      .replace(/[*_`]/g, '')         // Remove markdown formatting
      .replace(/\s+/g, ' ')          // Normalize whitespace
      .trim();
  }

  /**
   * Count words in text
   * @param {string} text - Text to analyze
   * @returns {number} Word count
   * @private
   */
  countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Count sentences in text
   * @param {string} text - Text to analyze
   * @returns {number} Sentence count
   * @private
   */
  countSentences(text) {
    return text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length;
  }

  /**
   * Count paragraphs in text
   * @param {string} text - Text to analyze
   * @returns {number} Paragraph count
   * @private
   */
  countParagraphs(text) {
    return text.split(/\n\s*\n/).filter(para => para.trim().length > 0).length;
  }

  /**
   * Calculate average sentence length
   * @param {string} text - Text to analyze
   * @returns {number} Average sentence length
   * @private
   */
  calculateAverageSentenceLength(text) {
    const words = this.countWords(text);
    const sentences = this.countSentences(text);
    return sentences > 0 ? words / sentences : 0;
  }

  /**
   * Calculate readability score (simplified Flesch-Kincaid)
   * @param {string} text - Text to analyze
   * @returns {number} Readability score (0-100)
   * @private
   */
  calculateReadabilityScore(text) {
    const words = this.countWords(text);
    const sentences = this.countSentences(text);
    const syllables = this.estimateSyllables(text);
    
    if (sentences === 0 || words === 0) return 0;
    
    const score = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Estimate syllables in text
   * @param {string} text - Text to analyze
   * @returns {number} Estimated syllable count
   * @private
   */
  estimateSyllables(text) {
    const words = text.toLowerCase().split(/\s+/);
    let syllables = 0;
    
    for (const word of words) {
      if (word.length <= 3) {
        syllables += 1;
      } else {
        const vowelGroups = word.match(/[aeiouy]+/g);
        syllables += vowelGroups ? vowelGroups.length : 1;
      }
    }
    
    return syllables;
  }

  /**
   * Calculate complexity score based on sentence structure
   * @param {string} text - Text to analyze
   * @returns {number} Complexity score (0-100)
   * @private
   */
  calculateComplexityScore(text) {
    const avgSentenceLength = this.calculateAverageSentenceLength(text);
    const idealLength = this.thresholds.idealSentenceLength;
    const maxLength = this.thresholds.maxSentenceLength;
    
    if (avgSentenceLength <= idealLength) {
      return 100 - (avgSentenceLength / idealLength) * 20; // Slight penalty for very short
    } else if (avgSentenceLength <= maxLength) {
      return 80 - ((avgSentenceLength - idealLength) / (maxLength - idealLength)) * 30;
    } else {
      return 50 - Math.min(30, (avgSentenceLength - maxLength) / 5 * 10);
    }
  }

  /**
   * Calculate ambiguity score based on vague terms
   * @param {string} text - Text to analyze
   * @returns {number} Ambiguity score (0-100, lower is more ambiguous)
   * @private
   */
  calculateAmbiguityScore(text) {
    const vagueTerms = [
      'some', 'many', 'few', 'several', 'various', 'different',
      'stuff', 'things', 'something', 'anything', 'everything',
      'maybe', 'perhaps', 'probably', 'might', 'could',
      'kind of', 'sort of', 'fairly', 'quite', 'rather'
    ];
    
    const words = text.toLowerCase().split(/\s+/);
    const vagueCount = words.filter(word => 
      vagueTerms.some(term => word.includes(term))
    ).length;
    
    const vagueRatio = words.length > 0 ? vagueCount / words.length : 0;
    return Math.max(0, 100 - (vagueRatio * 500)); // Penalty for vague terms
  }

  /**
   * Check if template has introduction
   * @param {string} template - Template content
   * @returns {boolean} Has introduction
   * @private
   */
  hasIntroduction(template) {
    const introPatterns = [
      /^(you are|your role|act as|imagine|pretend)/i,
      /^(context|background|scenario|situation)/i,
      /^(task|goal|objective|purpose)/i
    ];
    
    return introPatterns.some(pattern => pattern.test(template.trim()));
  }

  /**
   * Check if template has conclusion
   * @param {string} template - Template content
   * @returns {boolean} Has conclusion
   * @private
   */
  hasConclusion(template) {
    const conclusionPatterns = [
      /(provide|give|return|output|respond with)/i,
      /(format|structure|organize)/i,
      /(ensure|make sure|remember)/i
    ];
    
    const lastParagraph = template.trim().split('\n\n').pop() || '';
    return conclusionPatterns.some(pattern => pattern.test(lastParagraph));
  }

  /**
   * Check if template uses formatting
   * @param {string} template - Template content
   * @returns {boolean} Uses formatting
   * @private
   */
  usesFormatting(template) {
    const formattingPatterns = [
      /\*\*[^*]+\*\*/,  // Bold
      /\*[^*]+\*/,      // Italic
      /`[^`]+`/,        // Code
      /\n-\s/,          // Lists
      /\n\d+\.\s/,      // Numbered lists
      /\n#{1,6}\s/      // Headers
    ];
    
    return formattingPatterns.some(pattern => pattern.test(template));
  }

  /**
   * Check if template has headers
   * @param {string} template - Template content
   * @returns {boolean} Has headers
   * @private
   */
  hasHeaders(template) {
    return /\n#{1,6}\s/.test(template) || /\n[A-Z][A-Z\s]+:\s*\n/.test(template);
  }

  /**
   * Check if template has lists
   * @param {string} template - Template content
   * @returns {boolean} Has lists
   * @private
   */
  hasLists(template) {
    return /\n[-*+]\s/.test(template) || /\n\d+\.\s/.test(template);
  }

  /**
   * Check if template has variables
   * @param {string} template - Template content
   * @returns {boolean} Has variables
   * @private
   */
  hasVariables(template) {
    return /\{\{[^}]+\}\}/.test(template) || /\{[^}]+\}/.test(template);
  }

  /**
   * Check if template provides context
   * @param {string} template - Template content
   * @returns {boolean} Has context
   * @private
   */
  hasContext(template) {
    const contextKeywords = [
      'context', 'background', 'scenario', 'situation', 'given',
      'assuming', 'consider', 'in the context of', 'for the purpose of'
    ];
    
    const lowerTemplate = template.toLowerCase();
    return contextKeywords.some(keyword => lowerTemplate.includes(keyword));
  }

  /**
   * Check if template has clear instructions
   * @param {string} template - Template content
   * @returns {boolean} Has instructions
   * @private
   */
  hasInstructions(template) {
    const instructionKeywords = [
      'analyze', 'create', 'generate', 'write', 'explain', 'describe',
      'list', 'compare', 'evaluate', 'summarize', 'review', 'provide'
    ];
    
    const lowerTemplate = template.toLowerCase();
    return instructionKeywords.some(keyword => lowerTemplate.includes(keyword));
  }

  /**
   * Check if template has constraints
   * @param {string} template - Template content
   * @returns {boolean} Has constraints
   * @private
   */
  hasConstraints(template) {
    const constraintKeywords = [
      'must', 'should', 'cannot', 'do not', 'avoid', 'limit',
      'maximum', 'minimum', 'only', 'exactly', 'precisely'
    ];
    
    const lowerTemplate = template.toLowerCase();
    return constraintKeywords.some(keyword => lowerTemplate.includes(keyword));
  }

  /**
   * Check if template has examples
   * @param {string} template - Template content
   * @returns {boolean} Has examples
   * @private
   */
  hasExamples(template) {
    const exampleKeywords = [
      'example', 'for instance', 'such as', 'like', 'including',
      'e.g.', 'i.e.', 'for example', 'sample'
    ];
    
    const lowerTemplate = template.toLowerCase();
    return exampleKeywords.some(keyword => lowerTemplate.includes(keyword));
  }

  /**
   * Calculate specificity score based on concrete terms
   * @param {string} text - Text to analyze
   * @returns {number} Specificity score (0-100)
   * @private
   */
  calculateSpecificityScore(text) {
    const specificTerms = [
      'specific', 'detailed', 'exact', 'precise', 'particular',
      'concrete', 'explicit', 'clear', 'definite', 'certain'
    ];
    
    const words = text.toLowerCase().split(/\s+/);
    const specificCount = words.filter(word => 
      specificTerms.some(term => word.includes(term))
    ).length;
    
    const specificRatio = words.length > 0 ? specificCount / words.length : 0;
    return Math.min(100, specificRatio * 1000); // Bonus for specific terms
  }

  /**
   * Estimate token count (rough approximation)
   * @param {string} text - Text to analyze
   * @returns {number} Estimated token count
   * @private
   */
  estimateTokens(text) {
    // Rough approximation: 1 token ≈ 0.75 words for English
    const words = this.countWords(text);
    return Math.ceil(words / 0.75);
  }

  /**
   * Calculate redundancy score
   * @param {string} text - Text to analyze
   * @returns {number} Redundancy score (0-100, lower is more redundant)
   * @private
   */
  calculateRedundancyScore(text) {
    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    const uniqueWords = new Set(words);
    
    if (words.length === 0) return 100;
    
    const uniqueRatio = uniqueWords.size / words.length;
    return Math.min(100, uniqueRatio * 120); // Bonus for unique words
  }

  /**
   * Calculate conciseness score
   * @param {string} text - Text to analyze
   * @returns {number} Conciseness score (0-100)
   * @private
   */
  calculateConcisenessScore(text) {
    const words = this.countWords(text);
    const sentences = this.countSentences(text);
    
    if (sentences === 0) return 0;
    
    const avgWordsPerSentence = words / sentences;
    const idealWordsPerSentence = 15;
    
    if (avgWordsPerSentence <= idealWordsPerSentence) {
      return 100;
    } else {
      return Math.max(0, 100 - (avgWordsPerSentence - idealWordsPerSentence) * 2);
    }
  }

  /**
   * Calculate information density score
   * @param {string} text - Text to analyze
   * @returns {number} Information density score (0-100)
   * @private
   */
  calculateInformationDensity(text) {
    const words = text.toLowerCase().split(/\s+/);
    const contentWords = words.filter(word => 
      !['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(word)
    );
    
    if (words.length === 0) return 0;
    
    const densityRatio = contentWords.length / words.length;
    return Math.min(100, densityRatio * 150); // Bonus for content words
  }

  /**
   * Check if template has role definition
   * @param {string} template - Template content
   * @returns {boolean} Has role definition
   * @private
   */
  hasRoleDefinition(template) {
    const rolePatterns = [
      /you are (a|an|the)?/i,
      /act as (a|an|the)?/i,
      /your role is/i,
      /as (a|an|the) .+,/i
    ];
    
    return rolePatterns.some(pattern => pattern.test(template));
  }

  /**
   * Check if template specifies output format
   * @param {string} template - Template content
   * @returns {boolean} Has output format
   * @private
   */
  hasOutputFormat(template) {
    const formatKeywords = [
      'format', 'structure', 'json', 'xml', 'csv', 'table',
      'bullet points', 'numbered list', 'paragraph', 'response format'
    ];
    
    const lowerTemplate = template.toLowerCase();
    return formatKeywords.some(keyword => lowerTemplate.includes(keyword));
  }

  /**
   * Check if template uses chain of thought
   * @param {string} template - Template content
   * @returns {boolean} Uses chain of thought
   * @private
   */
  usesChainOfThought(template) {
    const cotPatterns = [
      /step by step/i,
      /think through/i,
      /reasoning/i,
      /first .+, then .+/i,
      /consider .+ then/i
    ];
    
    return cotPatterns.some(pattern => pattern.test(template));
  }

  /**
   * Check if template has validation criteria
   * @param {string} template - Template content
   * @returns {boolean} Has validation criteria
   * @private
   */
  hasValidationCriteria(template) {
    const validationKeywords = [
      'verify', 'check', 'validate', 'ensure', 'confirm',
      'accuracy', 'correctness', 'quality', 'criteria'
    ];
    
    const lowerTemplate = template.toLowerCase();
    return validationKeywords.some(keyword => lowerTemplate.includes(keyword));
  }

  /**
   * Score clarity metrics
   * @param {Object} clarity - Clarity metrics
   * @returns {number} Clarity score (0-100)
   * @private
   */
  scoreClarityMetrics(clarity) {
    const readabilityWeight = 0.4;
    const complexityWeight = 0.3;
    const ambiguityWeight = 0.3;
    
    return (
      clarity.readabilityScore * readabilityWeight +
      clarity.complexityScore * complexityWeight +
      clarity.ambiguityScore * ambiguityWeight
    );
  }

  /**
   * Score structure metrics
   * @param {Object} structure - Structure metrics
   * @returns {number} Structure score (0-100)
   * @private
   */
  scoreStructureMetrics(structure) {
    const components = [
      structure.hasIntroduction,
      structure.hasConclusion,
      structure.usesFormatting,
      structure.hasHeaders,
      structure.hasLists,
      structure.hasVariables
    ];
    
    const trueCount = components.filter(Boolean).length;
    return (trueCount / components.length) * 100;
  }

  /**
   * Score completeness metrics
   * @param {Object} completeness - Completeness metrics
   * @returns {number} Completeness score (0-100)
   * @private
   */
  scoreCompletenessMetrics(completeness) {
    const components = [
      completeness.hasContext,
      completeness.hasInstructions,
      completeness.hasConstraints,
      completeness.hasExamples
    ];
    
    const trueCount = components.filter(Boolean).length;
    const baseScore = (trueCount / components.length) * 80;
    const specificityBonus = completeness.specificityScore * 0.2;
    
    return Math.min(100, baseScore + specificityBonus);
  }

  /**
   * Score efficiency metrics
   * @param {Object} efficiency - Efficiency metrics
   * @returns {number} Efficiency score (0-100)
   * @private
   */
  scoreEfficiencyMetrics(efficiency) {
    const redundancyWeight = 0.3;
    const concisenessWeight = 0.4;
    const densityWeight = 0.3;
    
    return (
      efficiency.redundancyScore * redundancyWeight +
      efficiency.concisenesScore * concisenessWeight +
      efficiency.densityScore * densityWeight
    );
  }

  /**
   * Score example metrics
   * @param {Object} completeness - Completeness metrics
   * @returns {number} Example score (0-100)
   * @private
   */
  scoreExampleMetrics(completeness) {
    return completeness.hasExamples ? 100 : 50;
  }

  /**
   * Identify issues based on metrics
   * @param {Object} metrics - Calculated metrics
   * @returns {Array<string>} List of identified issues
   * @private
   */
  identifyIssues(metrics) {
    const issues = [];
    
    // Length issues
    if (metrics.length < this.thresholds.minLength) {
      issues.push('Template is too short');
    } else if (metrics.length > this.thresholds.maxLength) {
      issues.push('Template is too long');
    }
    
    // Clarity issues
    if (metrics.clarity.readabilityScore < 50) {
      issues.push('Low readability score');
    }
    if (metrics.clarity.complexityScore < 50) {
      issues.push('High complexity sentences');
    }
    if (metrics.clarity.ambiguityScore < 70) {
      issues.push('Contains ambiguous terms');
    }
    
    // Structure issues
    if (!metrics.structure.hasIntroduction) {
      issues.push('Missing clear introduction or role definition');
    }
    if (!metrics.structure.usesFormatting) {
      issues.push('Could benefit from better formatting');
    }
    
    // Completeness issues
    if (!metrics.completeness.hasInstructions) {
      issues.push('Missing clear instructions');
    }
    if (!metrics.completeness.hasContext) {
      issues.push('Lacks sufficient context');
    }
    
    return issues;
  }

  /**
   * Generate suggestions based on metrics and issues
   * @param {Object} metrics - Calculated metrics
   * @param {Array<string>} issues - Identified issues
   * @returns {Array<string>} List of suggestions
   * @private
   */
  generateSuggestions(metrics, issues) {
    const suggestions = [];
    
    if (issues.includes('Template is too short')) {
      suggestions.push('Add more context and specific instructions');
    }
    if (issues.includes('Template is too long')) {
      suggestions.push('Remove redundant information and focus on key points');
    }
    if (issues.includes('Low readability score')) {
      suggestions.push('Use simpler sentences and common vocabulary');
    }
    if (issues.includes('Contains ambiguous terms')) {
      suggestions.push('Replace vague terms with specific instructions');
    }
    if (issues.includes('Missing clear introduction or role definition')) {
      suggestions.push('Start with a clear role definition (e.g., "You are a...")');
    }
    if (issues.includes('Could benefit from better formatting')) {
      suggestions.push('Use headers, bullet points, and formatting to improve structure');
    }
    if (issues.includes('Missing clear instructions')) {
      suggestions.push('Add specific action verbs and clear task descriptions');
    }
    if (issues.includes('Lacks sufficient context')) {
      suggestions.push('Provide relevant background information and constraints');
    }
    
    // Always provide general suggestions
    if (!metrics.completeness.hasExamples) {
      suggestions.push('Consider adding examples to clarify expectations');
    }
    if (!metrics.aiOptimization.hasOutputFormat) {
      suggestions.push('Specify the desired output format');
    }
    
    return suggestions;
  }

  /**
   * Identify template strengths
   * @param {Object} metrics - Calculated metrics
   * @returns {Array<string>} List of strengths
   * @private
   */
  identifyStrengths(metrics) {
    const strengths = [];
    
    if (metrics.structure.hasIntroduction) {
      strengths.push('Clear role definition');
    }
    if (metrics.structure.usesFormatting) {
      strengths.push('Well-formatted structure');
    }
    if (metrics.completeness.hasExamples) {
      strengths.push('Includes helpful examples');
    }
    if (metrics.completeness.hasConstraints) {
      strengths.push('Specifies clear constraints');
    }
    if (metrics.clarity.readabilityScore > 70) {
      strengths.push('High readability');
    }
    if (metrics.efficiency.redundancyScore > 80) {
      strengths.push('Concise and non-redundant');
    }
    
    return strengths;
  }

  /**
   * Identify template weaknesses
   * @param {Object} metrics - Calculated metrics
   * @returns {Array<string>} List of weaknesses
   * @private
   */
  identifyWeaknesses(metrics) {
    const weaknesses = [];
    
    if (!metrics.structure.hasIntroduction) {
      weaknesses.push('Lacks clear role definition');
    }
    if (!metrics.completeness.hasContext) {
      weaknesses.push('Insufficient context');
    }
    if (metrics.clarity.ambiguityScore < 70) {
      weaknesses.push('Contains ambiguous language');
    }
    if (metrics.efficiency.redundancyScore < 60) {
      weaknesses.push('Contains redundant information');
    }
    if (!metrics.completeness.hasExamples) {
      weaknesses.push('Missing examples');
    }
    
    return weaknesses;
  }

  /**
   * Generate specific recommendations
   * @param {Object} metrics - Calculated metrics
   * @returns {Array<string>} List of recommendations
   * @private
   */
  generateRecommendations(metrics) {
    const recommendations = [];
    
    // AI-specific recommendations
    if (!metrics.aiOptimization.hasRoleDefinition) {
      recommendations.push('Add a clear role definition at the beginning');
    }
    if (!metrics.aiOptimization.hasOutputFormat) {
      recommendations.push('Specify the desired output format and structure');
    }
    if (!metrics.aiOptimization.usesChainOfThought) {
      recommendations.push('Consider adding "think step by step" for complex tasks');
    }
    if (!metrics.aiOptimization.hasValidationCriteria) {
      recommendations.push('Include validation criteria or quality checks');
    }
    
    // General optimization recommendations
    if (metrics.efficiency.tokenEstimate > 1000) {
      recommendations.push('Consider breaking into smaller, focused prompts');
    }
    if (metrics.completeness.specificityScore < 50) {
      recommendations.push('Use more specific and concrete language');
    }
    
    return recommendations;
  }
}

module.exports = QualityValidator;