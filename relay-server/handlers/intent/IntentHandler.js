import { BaseHandler } from '../base/BaseHandler.js';
import { getLanguageConfig, DEFAULT_LANGUAGE } from '../../lib/languageConfig.js';

/**
 * IntentHandler - Handles intent classification operations
 * Extends BaseHandler for common functionality and focuses on intent-specific operations
 */
export class IntentHandler extends BaseHandler {
  constructor(services = {}, dependencies = {}) {
    super(services, 'IntentHandler');
    this._deps = dependencies;
  }

  /**
   * Get required services for this handler
   * @returns {Array} Array of required service names
   */
  getRequiredServices() {
    return ['search', 'context'];
  }

  /**
   * Validate request structure
   * @param {Object} request - Request to validate
   */
  async validateRequest(request) {
    if (!request) {
      throw new Error('Request is required');
    }
    
    if (!request.text && !request.query) {
      throw new Error('Request must contain either text or query');
    }
  }

  /**
   * Classify intent from text
   * @param {Object} request - Request containing text to classify
   * @returns {Promise<Object>} Intent classification result
   */
  async classifyIntent(request) {
    return this.processRequest(request, 'intent classification', async (req) => {
      const { text, contextId, languageCode = DEFAULT_LANGUAGE } = req;

      // Get context if provided
      let context = null;
      if (contextId) {
        const contextResult = await this.services.context.getConversationContext(contextId);
        context = contextResult;
      }

      // Perform intent classification
      const intent = await this.detectIntent(text, context, languageCode);
      
      // Calculate confidence
      const confidence = this.calculateIntentConfidence(text, intent, context);
      
      // Update context with intent
      if (contextId) {
        await this.services.context.updateConversationContext(contextId, {
          lastIntent: intent,
          lastIntentConfidence: confidence,
          timestamp: Date.now()
        });
      }

      return {
        text,
        intent,
        confidence,
        context: context ? {
          location: context.location,
          familyConcerns: context.familyConcerns,
          lastIntent: context.lastIntent
        } : null,
        languageCode,
        timestamp: Date.now()
      };
    });
  }

  /**
   * Detect intent from text
   * @param {string} text - Text to analyze
   * @param {Object} context - Conversation context
   * @param {string} languageCode - Language code
   * @returns {Promise<string>} Detected intent
   */
  async detectIntent(text, context = null, languageCode = DEFAULT_LANGUAGE) {
    if (!text) return 'unknown';

    const textLower = text.toLowerCase();
    const langConfig = getLanguageConfig(languageCode);

    // Emergency detection (highest priority)
    if (this.isEmergencyIntent(textLower, langConfig)) {
      return 'emergency';
    }

    // Shelter search
    if (this.isShelterIntent(textLower, langConfig)) {
      return 'find_shelter';
    }

    // Legal help
    if (this.isLegalIntent(textLower, langConfig)) {
      return 'legal_help';
    }

    // Counseling
    if (this.isCounselingIntent(textLower, langConfig)) {
      return 'counseling';
    }

    // Safety planning
    if (this.isSafetyPlanningIntent(textLower, langConfig)) {
      return 'safety_planning';
    }

    // General help
    if (this.isGeneralHelpIntent(textLower, langConfig)) {
      return 'general_help';
    }

    // Follow-up detection
    if (this.isFollowUpIntent(textLower, context)) {
      return 'follow_up';
    }

    // Off-topic detection
    if (this.isOffTopicIntent(textLower, langConfig)) {
      return 'off_topic';
    }

    return 'unknown';
  }

  /**
   * Check if text indicates emergency intent
   * @param {string} text - Text to check
   * @param {Object} langConfig - Language configuration
   * @returns {boolean} Whether text indicates emergency
   */
  isEmergencyIntent(text, langConfig) {
    const emergencyKeywords = [
      'emergency', '911', 'help now', 'danger', 'immediate', 'urgent',
      'call police', 'police', 'ambulance', 'fire', 'hurt', 'injured',
      'attack', 'violence', 'abuse', 'threat', 'scared', 'fear'
    ];

    // Add language-specific emergency keywords
    if (langConfig.emergencyKeywords) {
      emergencyKeywords.push(...langConfig.emergencyKeywords);
    }

    return emergencyKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if text indicates shelter search intent
   * @param {string} text - Text to check
   * @param {Object} langConfig - Language configuration
   * @returns {boolean} Whether text indicates shelter search
   */
  isShelterIntent(text, langConfig) {
    const shelterKeywords = [
      'shelter', 'safe place', 'refuge', 'housing', 'place to stay',
      'homeless', 'nowhere to go', 'need place', 'stay safe',
      'domestic violence shelter', 'women shelter', 'family shelter'
    ];

    // Add language-specific shelter keywords
    if (langConfig.shelterKeywords) {
      shelterKeywords.push(...langConfig.shelterKeywords);
    }

    return shelterKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if text indicates legal help intent
   * @param {string} text - Text to check
   * @param {Object} langConfig - Language configuration
   * @returns {boolean} Whether text indicates legal help
   */
  isLegalIntent(text, langConfig) {
    const legalKeywords = [
      'legal', 'lawyer', 'attorney', 'court', 'law', 'restraining order',
      'divorce', 'custody', 'visitation', 'child support', 'alimony',
      'legal aid', 'legal help', 'rights', 'legal advice'
    ];

    // Add language-specific legal keywords
    if (langConfig.legalKeywords) {
      legalKeywords.push(...langConfig.legalKeywords);
    }

    return legalKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if text indicates counseling intent
   * @param {string} text - Text to check
   * @param {Object} langConfig - Language configuration
   * @returns {boolean} Whether text indicates counseling
   */
  isCounselingIntent(text, langConfig) {
    const counselingKeywords = [
      'counseling', 'therapy', 'therapist', 'counselor', 'psychologist',
      'mental health', 'support group', 'talk to someone', 'help me',
      'depression', 'anxiety', 'stress', 'trauma', 'PTSD'
    ];

    // Add language-specific counseling keywords
    if (langConfig.counselingKeywords) {
      counselingKeywords.push(...langConfig.counselingKeywords);
    }

    return counselingKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if text indicates safety planning intent
   * @param {string} text - Text to check
   * @param {Object} langConfig - Language configuration
   * @returns {boolean} Whether text indicates safety planning
   */
  isSafetyPlanningIntent(text, langConfig) {
    const safetyKeywords = [
      'safety plan', 'safety planning', 'escape plan', 'leave safely',
      'how to leave', 'when to leave', 'safe exit', 'emergency plan',
      'protect myself', 'protect children', 'stay safe'
    ];

    // Add language-specific safety keywords
    if (langConfig.safetyKeywords) {
      safetyKeywords.push(...langConfig.safetyKeywords);
    }

    return safetyKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if text indicates general help intent
   * @param {string} text - Text to check
   * @param {Object} langConfig - Language configuration
   * @returns {boolean} Whether text indicates general help
   */
  isGeneralHelpIntent(text, langConfig) {
    const helpKeywords = [
      'help', 'need help', 'assistance', 'support', 'resources',
      'information', 'what can I do', 'options', 'services'
    ];

    // Add language-specific help keywords
    if (langConfig.helpKeywords) {
      helpKeywords.push(...langConfig.helpKeywords);
    }

    return helpKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if text indicates follow-up intent
   * @param {string} text - Text to check
   * @param {Object} context - Conversation context
   * @returns {boolean} Whether text indicates follow-up
   */
  isFollowUpIntent(text, context) {
    if (!context || !context.lastIntent) {
      return false;
    }

    const followUpIndicators = [
      'what about', 'how about', 'also', 'too', 'as well',
      'in addition', 'more', 'other', 'different', 'else',
      'what else', 'anything else', 'more options'
    ];

    const hasFollowUpIndicator = followUpIndicators.some(indicator => 
      text.includes(indicator)
    );

    // Check if this is a short response that might be a follow-up
    const isShortResponse = text.split(' ').length <= 5;

    return hasFollowUpIndicator || (isShortResponse && context.lastIntent !== 'unknown');
  }

  /**
   * Check if text indicates off-topic intent
   * @param {string} text - Text to check
   * @param {Object} langConfig - Language configuration
   * @returns {boolean} Whether text indicates off-topic
   */
  isOffTopicIntent(text, langConfig) {
    const offTopicKeywords = [
      'weather', 'sports', 'politics', 'entertainment', 'shopping',
      'food', 'travel', 'technology', 'business', 'finance',
      'joke', 'funny', 'story', 'personal', 'unrelated'
    ];

    // Add language-specific off-topic keywords
    if (langConfig.offTopicKeywords) {
      offTopicKeywords.push(...langConfig.offTopicKeywords);
    }

    return offTopicKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Calculate confidence score for intent classification
   * @param {string} text - Text that was classified
   * @param {string} intent - Detected intent
   * @param {Object} context - Conversation context
   * @returns {number} Confidence score (0-1)
   */
  calculateIntentConfidence(text, intent, context) {
    if (!text || text.length < 3) return 0;

    let confidence = 0.5; // Base confidence

    // Word count factor
    const wordCount = text.split(' ').length;
    if (wordCount >= 5) confidence += 0.2;
    else if (wordCount >= 3) confidence += 0.1;

    // Intent specificity factor
    const specificIntents = ['emergency', 'find_shelter', 'legal_help'];
    if (specificIntents.includes(intent)) confidence += 0.2;

    // Context consistency factor
    if (context && context.lastIntent === intent) confidence += 0.1;

    // Language clarity factor
    const clearKeywords = ['help', 'need', 'want', 'looking for', 'find'];
    if (clearKeywords.some(keyword => text.includes(keyword))) confidence += 0.1;

    // Ambiguity penalty
    const ambiguousWords = ['maybe', 'might', 'could', 'possibly', 'think'];
    if (ambiguousWords.some(word => text.includes(word))) confidence -= 0.1;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Batch classify multiple intents
   * @param {Object} request - Request containing array of texts to classify
   * @returns {Promise<Object>} Batch classification results
   */
  async batchClassifyIntent(request) {
    return this.processRequest(request, 'batch intent classification', async (req) => {
      const { texts, contextId, languageCode = DEFAULT_LANGUAGE } = req;

      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('Texts must be a non-empty array');
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < texts.length; i++) {
        try {
          const result = await this.classifyIntent({
            text: texts[i],
            contextId,
            languageCode
          });
          results.push(result);
        } catch (error) {
          errors.push({
            index: i,
            error: error.message,
            text: texts[i]
          });
        }
      }

      return {
        results,
        errors,
        totalProcessed: results.length,
        totalErrors: errors.length,
        successRate: results.length / texts.length,
        intentDistribution: this.calculateIntentDistribution(results)
      };
    });
  }

  /**
   * Calculate distribution of intents in results
   * @param {Array} results - Array of classification results
   * @returns {Object} Intent distribution
   */
  calculateIntentDistribution(results) {
    const distribution = {};
    
    results.forEach(result => {
      const intent = result.intent;
      distribution[intent] = (distribution[intent] || 0) + 1;
    });

    return distribution;
  }

  /**
   * Get intent classification statistics
   * @returns {Object} Classification statistics
   */
  getClassificationStats() {
    return {
      handlerName: this.handlerName,
      totalClassifications: this.classificationCount || 0,
      averageConfidence: this.averageConfidence || 0,
      errorRate: this.errorRate || 0,
      lastClassified: this.lastClassified || null,
      intentDistribution: this.intentDistribution || {},
      languageDistribution: this.languageDistribution || {}
    };
  }

  /**
   * Validate intent classification
   * @param {Object} request - Request containing validation data
   * @returns {Promise<Object>} Validation results
   */
  async validateIntentClassification(request) {
    return this.processRequest(request, 'intent validation', async (req) => {
      const { text, expectedIntent, contextId, languageCode = DEFAULT_LANGUAGE } = req;

      // Perform classification
      const classification = await this.classifyIntent({
        text,
        contextId,
        languageCode
      });

      // Compare with expected intent
      const isCorrect = classification.intent === expectedIntent;
      const confidence = classification.confidence;

      return {
        text,
        expectedIntent,
        actualIntent: classification.intent,
        isCorrect,
        confidence,
        context: classification.context,
        languageCode,
        timestamp: Date.now()
      };
    });
  }

  /**
   * Get intent suggestions for ambiguous text
   * @param {Object} request - Request containing ambiguous text
   * @returns {Promise<Object>} Intent suggestions
   */
  async getIntentSuggestions(request) {
    return this.processRequest(request, 'intent suggestions', async (req) => {
      const { text, contextId, languageCode = DEFAULT_LANGUAGE } = req;

      // Get context if provided
      let context = null;
      if (contextId) {
        const contextResult = await this.services.context.getConversationContext(contextId);
        context = contextResult;
      }

      // Generate multiple intent possibilities
      const suggestions = [];
      const textLower = text.toLowerCase();

      // Check each intent type
      const intentTypes = [
        'emergency', 'find_shelter', 'legal_help', 'counseling',
        'safety_planning', 'general_help', 'follow_up', 'off_topic'
      ];

      for (const intentType of intentTypes) {
        const confidence = this.calculateIntentConfidence(text, intentType, context);
        if (confidence > 0.3) { // Only include suggestions with reasonable confidence
          suggestions.push({
            intent: intentType,
            confidence,
            reasoning: this.getIntentReasoning(textLower, intentType, languageCode)
          });
        }
      }

      // Sort by confidence
      suggestions.sort((a, b) => b.confidence - a.confidence);

      return {
        text,
        suggestions,
        context: context ? {
          location: context.location,
          familyConcerns: context.familyConcerns,
          lastIntent: context.lastIntent
        } : null,
        languageCode,
        timestamp: Date.now()
      };
    });
  }

  /**
   * Get reasoning for intent classification
   * @param {string} text - Text that was classified
   * @param {string} intent - Intent type
   * @param {string} languageCode - Language code
   * @returns {string} Reasoning for the classification
   */
  getIntentReasoning(text, intent, languageCode) {
    const langConfig = getLanguageConfig(languageCode);
    
    switch (intent) {
      case 'emergency':
        return 'Contains emergency-related keywords or urgent language';
      case 'find_shelter':
        return 'Mentions shelter, housing, or safe place needs';
      case 'legal_help':
        return 'References legal matters, lawyers, or court proceedings';
      case 'counseling':
        return 'Asks for counseling, therapy, or mental health support';
      case 'safety_planning':
        return 'Discusses safety planning or escape strategies';
      case 'general_help':
        return 'Requests general assistance or resources';
      case 'follow_up':
        return 'Appears to be a follow-up to previous conversation';
      case 'off_topic':
        return 'Content appears unrelated to domestic violence support';
      default:
        return 'Intent unclear or ambiguous';
    }
  }
} 