import { config } from './config.js';
import logger from './logger.js';
import { getActiveHandler, getHandlerClassName, getHandlerImportPath, isFeatureEnabled } from './refactoringConfig.js';

// Import all response handlers
import { ResponseGenerator } from './response.js';
import { SimplifiedResponseHandler } from './simplifiedResponseHandler.js';
import { HybridResponseHandler } from './hybridResponseHandler.js';

/**
 * Unified Response Handler
 * 
 * This handler dynamically routes requests to the appropriate response handler
 * based on the current refactoring configuration. It provides a single interface
 * for all response generation while allowing easy switching between approaches.
 */
export class UnifiedResponseHandler {
  
  /**
   * Main response generation method
   * @param {string} input - User query
   * @param {Object} context - Conversation context
   * @param {string} requestType - 'voice' or 'web'
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  static async getResponse(input, context = {}, requestType = 'web', options = {}) {
    const startTime = Date.now();
    const activeHandler = getActiveHandler();
    
    try {
      logger.info('UnifiedResponseHandler: Processing query', { 
        input, 
        requestType, 
        activeHandler,
        hasContext: !!context 
      });

      // Route to appropriate handler based on configuration
      let response;
      
      switch (activeHandler) {
        case 'simplified':
          response = await SimplifiedResponseHandler.getResponse(input, context, requestType, options);
          break;
          
        case 'hybrid':
          response = await HybridResponseHandler.getResponse(input, context, requestType, options);
          break;
          
        case 'legacy':
        default:
          response = await this.handleLegacyResponse(input, context, requestType, options);
          break;
      }

      const responseTime = Date.now() - startTime;
      
      // Add unified metadata
      response = {
        ...response,
        unifiedMetadata: {
          activeHandler,
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          refactoringPhase: this.getRefactoringPhase(),
          featureFlags: this.getActiveFeatureFlags()
        }
      };

      logger.info('UnifiedResponseHandler: Response generated', {
        activeHandler,
        responseTime: `${responseTime}ms`,
        success: response.success,
        source: response.source
      });

      return response;

    } catch (error) {
      logger.error('UnifiedResponseHandler: Error generating response', error);
      return this.generateFallbackResponse(input, requestType, activeHandler);
    }
  }

  /**
   * Handle legacy response using the original complex system
   * @param {string} input - User query
   * @param {Object} context - Conversation context
   * @param {string} requestType - Request type
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  static async handleLegacyResponse(input, context, requestType, options) {
    logger.info('UnifiedResponseHandler: Using legacy response handler');
    
    // Use the original ResponseGenerator with all its complexity
    return await ResponseGenerator.getResponse(
      input, 
      context, 
      requestType, 
      options.maxResults || 3, 
      options.voice, 
      options.callSid, 
      options.detectedLanguage
    );
  }

  /**
   * Get current refactoring phase
   * @returns {string} Current phase
   */
  static getRefactoringPhase() {
    const activeHandler = getActiveHandler();
    
    if (activeHandler === 'simplified' && !isFeatureEnabled('SIMPLIFIED_INTENT_CLASSIFICATION')) {
      return 'PHASE_1_PROOF_OF_CONCEPT';
    } else if (activeHandler === 'hybrid') {
      return 'PHASE_2_GRADUAL_MIGRATION';
    } else if (activeHandler === 'simplified' && isFeatureEnabled('SIMPLIFIED_INTENT_CLASSIFICATION')) {
      return 'PHASE_3_FULL_SIMPLIFICATION';
    }
    
    return 'LEGACY_SYSTEM';
  }

  /**
   * Get active feature flags
   * @returns {Object} Active feature flags
   */
  static getActiveFeatureFlags() {
    return {
      SIMPLIFIED_INTENT_CLASSIFICATION: isFeatureEnabled('SIMPLIFIED_INTENT_CLASSIFICATION'),
      SIMPLIFIED_QUERY_REWRITING: isFeatureEnabled('SIMPLIFIED_QUERY_REWRITING'),
      SIMPLIFIED_RESPONSE_ROUTING: isFeatureEnabled('SIMPLIFIED_RESPONSE_ROUTING'),
      SIMPLIFIED_CONVERSATION_CONTEXT: isFeatureEnabled('SIMPLIFIED_CONVERSATION_CONTEXT'),
      EMERGENCY_DETECTION: isFeatureEnabled('EMERGENCY_DETECTION'),
      CACHING_ENABLED: isFeatureEnabled('CACHING_ENABLED'),
      FALLBACK_ENABLED: isFeatureEnabled('FALLBACK_ENABLED')
    };
  }

  /**
   * Generate fallback response when everything fails
   * @param {string} input - User query
   * @param {string} requestType - Request type
   * @param {string} activeHandler - Active handler that failed
   * @returns {Object} Fallback response
   */
  static generateFallbackResponse(input, requestType, activeHandler) {
    const fallbackMessage = 'I apologize, but I\'m having trouble processing your request right now. Please call the National Domestic Violence Hotline at 1-800-799-7233 for immediate support.';
    
    return {
      success: false,
      source: 'unified_fallback',
      timestamp: new Date().toISOString(),
      voiceResponse: fallbackMessage,
      smsResponse: fallbackMessage,
      webResponse: fallbackMessage,
      summary: 'System temporarily unavailable. Please call hotline for support.',
      unifiedMetadata: {
        activeHandler,
        responseTime: '0ms',
        timestamp: new Date().toISOString(),
        refactoringPhase: 'FALLBACK',
        featureFlags: this.getActiveFeatureFlags(),
        error: 'All response handlers failed'
      }
    };
  }

  /**
   * Get handler statistics
   * @returns {Object} Handler statistics
   */
  static getHandlerStats() {
    const activeHandler = getActiveHandler();
    
    return {
      activeHandler,
      handlerClassName: getHandlerClassName(),
      handlerImportPath: getHandlerImportPath(),
      refactoringPhase: this.getRefactoringPhase(),
      featureFlags: this.getActiveFeatureFlags(),
      availableHandlers: ['legacy', 'simplified', 'hybrid']
    };
  }

  /**
   * Get cache statistics from all handlers
   * @returns {Object} Combined cache statistics
   */
  static getCacheStats() {
    const stats = {
      legacy: null,
      simplified: null,
      hybrid: null
    };

    try {
      // Get cache stats from each handler
      if (ResponseGenerator.getCacheStats) {
        stats.legacy = ResponseGenerator.getCacheStats();
      }
      
      if (SimplifiedResponseHandler.getCacheStats) {
        stats.simplified = SimplifiedResponseHandler.getCacheStats();
      }
      
      if (HybridResponseHandler.getCacheStats) {
        stats.hybrid = HybridResponseHandler.getCacheStats();
      }
    } catch (error) {
      logger.error('UnifiedResponseHandler: Error getting cache stats', error);
    }

    return stats;
  }

  /**
   * Test all handlers with the same input
   * @param {string} input - Test input
   * @param {Object} context - Test context
   * @param {string} requestType - Request type
   * @returns {Promise<Object>} Comparison results
   */
  static async testAllHandlers(input, context = {}, requestType = 'web') {
    const results = {
      input,
      context,
      requestType,
      timestamp: new Date().toISOString(),
      handlers: {}
    };

    // Test legacy handler
    try {
      const startTime = Date.now();
      const legacyResponse = await this.handleLegacyResponse(input, context, requestType, {});
      const legacyTime = Date.now() - startTime;
      
      results.handlers.legacy = {
        success: true,
        responseTime: legacyTime,
        response: legacyResponse,
        source: legacyResponse.source || 'legacy'
      };
    } catch (error) {
      results.handlers.legacy = {
        success: false,
        error: error.message,
        responseTime: 0
      };
    }

    // Test simplified handler
    try {
      const startTime = Date.now();
      const simplifiedResponse = await SimplifiedResponseHandler.getResponse(input, context, requestType, {});
      const simplifiedTime = Date.now() - startTime;
      
      results.handlers.simplified = {
        success: true,
        responseTime: simplifiedTime,
        response: simplifiedResponse,
        source: simplifiedResponse.source || 'simplified'
      };
    } catch (error) {
      results.handlers.simplified = {
        success: false,
        error: error.message,
        responseTime: 0
      };
    }

    // Test hybrid handler
    try {
      const startTime = Date.now();
      const hybridResponse = await HybridResponseHandler.getResponse(input, context, requestType, {});
      const hybridTime = Date.now() - startTime;
      
      results.handlers.hybrid = {
        success: true,
        responseTime: hybridTime,
        response: hybridResponse,
        source: hybridResponse.source || 'hybrid'
      };
    } catch (error) {
      results.handlers.hybrid = {
        success: false,
        error: error.message,
        responseTime: 0
      };
    }

    return results;
  }

  /**
   * Compare response quality between handlers
   * @param {Object} testResults - Results from testAllHandlers
   * @returns {Object} Quality comparison
   */
  static compareResponseQuality(testResults) {
    const comparison = {
      timestamp: new Date().toISOString(),
      input: testResults.input,
      metrics: {}
    };

    // Compare response times
    const responseTimes = {};
    Object.keys(testResults.handlers).forEach(handler => {
      if (testResults.handlers[handler].success) {
        responseTimes[handler] = testResults.handlers[handler].responseTime;
      }
    });

    comparison.metrics.responseTime = responseTimes;

    // Compare response lengths
    const responseLengths = {};
    Object.keys(testResults.handlers).forEach(handler => {
      if (testResults.handlers[handler].success) {
        const response = testResults.handlers[handler].response;
        responseLengths[handler] = {
          voice: response.voiceResponse?.length || 0,
          web: response.webResponse?.length || 0,
          sms: response.smsResponse?.length || 0
        };
      }
    });

    comparison.metrics.responseLength = responseLengths;

    // Compare success rates
    const successRates = {};
    Object.keys(testResults.handlers).forEach(handler => {
      successRates[handler] = testResults.handlers[handler].success;
    });

    comparison.metrics.successRate = successRates;

    // Determine fastest handler
    const validTimes = Object.entries(responseTimes).filter(([_, time]) => time > 0);
    if (validTimes.length > 0) {
      const fastest = validTimes.reduce((a, b) => a[1] < b[1] ? a : b);
      comparison.metrics.fastestHandler = fastest[0];
    }

    return comparison;
  }

  /**
   * Get performance recommendations based on test results
   * @param {Object} testResults - Test results
   * @returns {Object} Recommendations
   */
  static getPerformanceRecommendations(testResults) {
    const recommendations = {
      timestamp: new Date().toISOString(),
      recommendations: []
    };

    // Check response times
    Object.entries(testResults.handlers).forEach(([handler, result]) => {
      if (result.success && result.responseTime > 5000) {
        recommendations.recommendations.push({
          type: 'performance',
          handler,
          issue: 'Slow response time',
          value: `${result.responseTime}ms`,
          suggestion: 'Consider optimizing or using a different handler'
        });
      }
    });

    // Check success rates
    const failedHandlers = Object.entries(testResults.handlers)
      .filter(([_, result]) => !result.success)
      .map(([handler, _]) => handler);

    if (failedHandlers.length > 0) {
      recommendations.recommendations.push({
        type: 'reliability',
        handlers: failedHandlers,
        issue: 'Handler failures',
        suggestion: 'Investigate and fix handler issues'
      });
    }

    // Recommend best handler
    const successfulHandlers = Object.entries(testResults.handlers)
      .filter(([_, result]) => result.success)
      .sort((a, b) => a[1].responseTime - b[1].responseTime);

    if (successfulHandlers.length > 0) {
      recommendations.recommendations.push({
        type: 'optimization',
        handler: successfulHandlers[0][0],
        issue: 'Best performing handler',
        value: `${successfulHandlers[0][1].responseTime}ms`,
        suggestion: 'Consider using this handler for better performance'
      });
    }

    return recommendations;
  }
} 