import { getConversationContext } from './intentClassifier.js';
import logger from './logger.js';

/**
 * Build optimized conversation context with only relevant information
 * @param {string} callSid - The call SID
 * @param {string} currentQuery - The current user query
 * @param {string} detectedLanguage - The detected language code
 * @returns {Object} Optimized conversation context object
 */
export function buildOptimizedContext(callSid, currentQuery = '', detectedLanguage = 'en-US') {
  try {
    const fullContext = callSid ? getConversationContext(callSid) : null;
    
    if (!fullContext) {
      return {
        isNewConversation: true,
        language: detectedLanguage
      };
    }

    // Extract only relevant information from the new minimal structure
    const optimizedContext = {
      isNewConversation: false,
      language: detectedLanguage,
      timestamp: new Date().toISOString()
    };

    // Get the minimal context structure
    const minimalContext = fullContext.lastQueryContext;

    if (minimalContext) {
      // Location information (most important for resource searches)
      if (minimalContext.location) {
        optimizedContext.location = minimalContext.location;
      }

      // Last intent (for follow-up detection)
      if (minimalContext.lastIntent) {
        optimizedContext.lastIntent = minimalContext.lastIntent;
      }

      // Last query (for context continuity) - limit to 80 chars
      if (minimalContext.lastQuery) {
        optimizedContext.lastQuery = minimalContext.lastQuery.substring(0, 80);
      }

      // Location needs status
      if (minimalContext.needsLocation) {
        optimizedContext.needsLocation = true;
      }

      // Recent conversation summary (already built in minimal context)
      if (minimalContext.recentSummary) {
        optimizedContext.recentSummary = minimalContext.recentSummary;
      }

      // Family concerns (pets, children, elders) - extract from results more efficiently
      if (minimalContext.results && minimalContext.results.length > 0) {
        const familyConcerns = [];
        const content = minimalContext.results.map(r => r.content || '').join(' ').toLowerCase();
        
        if (content.includes('pet') || content.includes('dog') || content.includes('cat')) {
          familyConcerns.push('pets');
        }
        if (content.includes('child') || content.includes('kid') || content.includes('family')) {
          familyConcerns.push('children');
        }
        if (content.includes('elder') || content.includes('senior') || content.includes('aging')) {
          familyConcerns.push('elders');
        }
        
        if (familyConcerns.length > 0) {
          optimizedContext.familyConcerns = familyConcerns;
        }
      }

      // Emotional tone indicators - simplified extraction
      if (minimalContext.results && minimalContext.results.length > 0) {
        const emotionalIndicators = [];
        const content = minimalContext.results.map(r => r.content || '').join(' ').toLowerCase();
        
        if (content.includes('emergency') || content.includes('urgent') || content.includes('immediate')) {
          emotionalIndicators.push('urgent');
        }
        if (content.includes('scared') || content.includes('fear') || content.includes('afraid')) {
          emotionalIndicators.push('fearful');
        }
        if (content.includes('confused') || content.includes('unsure') || content.includes('don\'t know')) {
          emotionalIndicators.push('uncertain');
        }
        
        if (emotionalIndicators.length > 0) {
          optimizedContext.emotionalTone = emotionalIndicators;
        }
      }

      // Add result count for context
      if (minimalContext.results) {
        optimizedContext.resultCount = minimalContext.results.length;
      }
    }

    logger.info('Built optimized conversation context:', {
      callSid,
      contextSize: JSON.stringify(optimizedContext).length,
      hasLocation: !!optimizedContext.location,
      hasFamilyConcerns: !!optimizedContext.familyConcerns,
      hasEmotionalTone: !!optimizedContext.emotionalTone,
      resultCount: optimizedContext.resultCount || 0
    });

    return optimizedContext;

  } catch (error) {
    logger.error('Error building optimized conversation context:', error);
    return {
      isNewConversation: true,
      language: detectedLanguage,
      error: 'Context building failed'
    };
  }
}

/**
 * Build dynamic conversation context for voice instructions (legacy method)
 * @param {string} callSid - The call SID
 * @param {string} currentQuery - The current user query
 * @param {string} detectedLanguage - The detected language code
 * @returns {string} Formatted conversation context
 */
export function buildConversationContext(callSid, currentQuery = '', detectedLanguage = 'en-US') {
  try {
    const optimizedContext = buildOptimizedContext(callSid, currentQuery, detectedLanguage);
    
    if (optimizedContext.isNewConversation) {
      return 'No previous conversation context available.';
    }

    const contextParts = [];

    // Recent conversation summary
    if (optimizedContext.recentSummary) {
      contextParts.push(`**Recent Conversation:** ${optimizedContext.recentSummary}`);
    }

    // Location context
    if (optimizedContext.location) {
      contextParts.push(`**Current Location:** ${optimizedContext.location}`);
    }

    // Family concerns
    if (optimizedContext.familyConcerns) {
      contextParts.push(`**Family Concerns:** ${optimizedContext.familyConcerns.join(', ')}`);
    }

    // Language preference
    if (optimizedContext.language && optimizedContext.language !== 'en-US') {
      const languageNames = {
        'es-ES': 'Spanish',
        'fr-FR': 'French',
        'de-DE': 'German'
      };
      const languageName = languageNames[optimizedContext.language] || optimizedContext.language;
      contextParts.push(`**Language Preference:** ${languageName}`);
    }

    // Emotional tone indicators
    if (optimizedContext.emotionalTone) {
      contextParts.push(`**Emotional Tone:** ${optimizedContext.emotionalTone.join(', ')}`);
    }

    // Current needs assessment
    if (optimizedContext.lastIntent) {
      const intent = optimizedContext.lastIntent.replace('_', ' ');
      contextParts.push(`**Current Need:** ${intent}`);
    }

    // Resource focus
    if (optimizedContext.focusedResource) {
      contextParts.push(`**Focused Resource:** ${optimizedContext.focusedResource}`);
    }

    // Location needs
    if (optimizedContext.needsLocation) {
      contextParts.push(`**Location Status:** Needs location information`);
    }

    // Build the final context string
    const contextString = contextParts.join('\n\n');
    
    return contextString || 'No specific context available.';

  } catch (error) {
    logger.error('Error building conversation context:', error);
    return 'Error building conversation context.';
  }
}

/**
 * Inject conversation context into voice instructions template
 * @param {string} voiceInstructions - The voice instructions template
 * @param {string} callSid - The call SID
 * @param {string} currentQuery - The current user query
 * @param {string} detectedLanguage - The detected language code
 * @returns {string} Voice instructions with injected context
 */
export function injectConversationContext(voiceInstructions, callSid, currentQuery = '', detectedLanguage = 'en-US') {
  try {
    const context = buildConversationContext(callSid, currentQuery, detectedLanguage);
    
    // Replace the template placeholder with actual context
    const updatedInstructions = voiceInstructions.replace('{{conversation_context}}', context);
    
    logger.info('Injected conversation context into voice instructions:', {
      callSid,
      contextLength: context.length,
      instructionsLength: updatedInstructions.length
    });

    return updatedInstructions;

  } catch (error) {
    logger.error('Error injecting conversation context:', error);
    // Return original instructions if injection fails
    return voiceInstructions.replace('{{conversation_context}}', 'No conversation context available.');
  }
}

/**
 * Get enhanced voice instructions with dynamic context
 * @param {string} callSid - The call SID
 * @param {string} currentQuery - The current user query
 * @param {string} detectedLanguage - The detected language code
 * @param {string} baseInstructions - Base voice instructions template
 * @returns {string} Enhanced voice instructions with context
 */
export async function getEnhancedVoiceInstructions(callSid, currentQuery = '', detectedLanguage = 'en-US', baseInstructions = null) {
  try {
    // Import base instructions if not provided
    if (!baseInstructions) {
      const { voiceInstructions } = await import('./conversationConfig.js');
      baseInstructions = voiceInstructions;
    }

    return injectConversationContext(baseInstructions, callSid, currentQuery, detectedLanguage);

  } catch (error) {
    logger.error('Error getting enhanced voice instructions:', error);
    // Return base instructions if enhancement fails
    return baseInstructions || 'Error loading voice instructions.';
  }
} 