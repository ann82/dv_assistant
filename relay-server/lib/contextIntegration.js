import { enhancedContextManager } from './enhancedContextManager.js';
import { updateConversationContext, getConversationContext } from './intentClassifier.js';
import logger from './logger.js';

/**
 * Context Integration Layer
 * Bridges the enhanced context manager with the existing conversation system
 */
export class ContextIntegration {
  
  /**
   * Enhanced context update that works with both systems
   * @param {string} callSid - Call identifier
   * @param {Object} interaction - Interaction data
   * @param {Object} options - Additional options
   */
  static async updateContext(callSid, interaction, options = {}) {
    try {
      // Update legacy context system (for backward compatibility)
      const { intent, query, response, tavilyResults, matchedResult } = interaction;
      updateConversationContext(callSid, intent, query, response, tavilyResults, matchedResult);
      
      // Update enhanced context system
      const enhancedContext = await enhancedContextManager.updateContext(callSid, interaction, options);
      
      logger.info('Context integration updated:', {
        callSid,
        legacyContext: !!getConversationContext(callSid),
        enhancedContext: !!enhancedContext,
        conversationState: enhancedContext?.conversationState
      });
      
      return enhancedContext;
    } catch (error) {
      logger.error('Error in context integration update:', error);
      // Fallback to legacy system only
      const { intent, query, response, tavilyResults, matchedResult } = interaction;
      updateConversationContext(callSid, intent, query, response, tavilyResults, matchedResult);
      return null;
    }
  }

  /**
   * Enhanced follow-up detection that combines both systems
   * @param {string} callSid - Call identifier
   * @param {string} query - Current query
   * @returns {Object|null} Enhanced follow-up response
   */
  static async detectFollowUp(callSid, query) {
    try {
      // Try enhanced follow-up detection first
      const enhancedFollowUp = await enhancedContextManager.detectEnhancedFollowUp(callSid, query);
      
      if (enhancedFollowUp) {
        logger.info('Enhanced follow-up detected:', {
          callSid,
          type: enhancedFollowUp.type,
          confidence: enhancedFollowUp.confidence,
          followUpType: enhancedFollowUp.followUpType
        });
        
        return {
          type: 'enhanced_follow_up',
          intent: 'follow_up',
          voiceResponse: enhancedFollowUp.suggestedResponse,
          smsResponse: enhancedFollowUp.suggestedResponse,
          context: enhancedFollowUp.context,
          confidence: enhancedFollowUp.confidence
        };
      }
      
      // Fallback to legacy follow-up detection
      const legacyContext = getConversationContext(callSid);
      if (legacyContext?.lastQueryContext) {
        const { handleFollowUp } = await import('./intentClassifier.js');
        const legacyFollowUp = await handleFollowUp(query, legacyContext.lastQueryContext);
        
        if (legacyFollowUp) {
          logger.info('Legacy follow-up detected:', {
            callSid,
            type: legacyFollowUp.type
          });
          
          return legacyFollowUp;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error in enhanced follow-up detection:', error);
      return null;
    }
  }

  /**
   * Get comprehensive context information
   * @param {string} callSid - Call identifier
   * @returns {Object} Combined context information
   */
  static async getComprehensiveContext(callSid) {
    try {
      const legacyContext = getConversationContext(callSid);
      const enhancedContext = await enhancedContextManager.getEnhancedContext(callSid);
      const stats = enhancedContextManager.getContextStats(callSid);
      
      return {
        legacy: legacyContext,
        enhanced: enhancedContext,
        stats,
        hasEnhancedContext: !!enhancedContext,
        hasLegacyContext: !!legacyContext,
        conversationState: enhancedContext?.conversationState || 'unknown',
        semanticContext: enhancedContext?.semanticContext || null
      };
    } catch (error) {
      logger.error('Error getting comprehensive context:', error);
      return {
        legacy: getConversationContext(callSid),
        enhanced: null,
        stats: null,
        hasEnhancedContext: false,
        hasLegacyContext: !!getConversationContext(callSid),
        conversationState: 'unknown',
        semanticContext: null
      };
    }
  }

  /**
   * Generate enhanced conversation summary
   * @param {string} callSid - Call identifier
   * @returns {string} Enhanced conversation summary
   */
  static async generateSummary(callSid) {
    try {
      const summary = await enhancedContextManager.generateConversationSummary(callSid);
      logger.info('Enhanced conversation summary generated:', {
        callSid,
        summaryLength: summary.length
      });
      return summary;
    } catch (error) {
      logger.error('Error generating enhanced summary:', error);
      return 'Thank you for reaching out. Please remember that help is available 24/7.';
    }
  }

  /**
   * Clear all context for a call
   * @param {string} callSid - Call identifier
   */
  static async clearAllContext(callSid) {
    try {
      // Clear legacy context
      const { clearConversationContext } = await import('./intentClassifier.js');
      clearConversationContext(callSid);
      
      // Clear enhanced context
      enhancedContextManager.clearContext(callSid);
      
      logger.info('All context cleared for call:', callSid);
    } catch (error) {
      logger.error('Error clearing context:', error);
    }
  }

  /**
   * Get context insights for debugging
   * @param {string} callSid - Call identifier
   * @returns {Object} Context insights
   */
  static async getContextInsights(callSid) {
    try {
      const comprehensiveContext = await this.getComprehensiveContext(callSid);
      const enhancedContext = comprehensiveContext.enhanced;
      
      if (!enhancedContext) {
        return {
          callSid,
          hasContext: false,
          message: 'No enhanced context available'
        };
      }
      
      const semanticContext = enhancedContext.semanticContext;
      const recentResources = Array.from(enhancedContext.resourceMemory.values())
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 3);
      
      return {
        callSid,
        hasContext: true,
        conversationState: enhancedContext.conversationState,
        historyLength: enhancedContext.history.length,
        primaryNeeds: semanticContext?.primaryNeeds || [],
        keyTopics: semanticContext?.keyTopics || [],
        userSentiment: semanticContext?.userSentiment || 'unknown',
        recentResources: recentResources.map(r => ({
          title: r.title,
          relevanceScore: r.relevanceScore,
          mentionCount: r.mentionCount
        })),
        locationHistory: enhancedContext.locationHistory.slice(-3),
        intentProgression: enhancedContext.intentProgression.slice(-5)
      };
    } catch (error) {
      logger.error('Error getting context insights:', error);
      return {
        callSid,
        hasContext: false,
        error: error.message
      };
    }
  }

  /**
   * Check if enhanced context is available and working
   * @returns {boolean} Enhanced context availability
   */
  static isEnhancedContextAvailable() {
    try {
      return enhancedContextManager && typeof enhancedContextManager.updateContext === 'function';
    } catch (error) {
      logger.error('Error checking enhanced context availability:', error);
      return false;
    }
  }
}

export default ContextIntegration; 