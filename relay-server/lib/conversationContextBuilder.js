import { getConversationContext } from './intentClassifier.js';
import logger from './logger.js';

/**
 * Build dynamic conversation context for voice instructions
 * @param {string} callSid - The call SID
 * @param {string} currentQuery - The current user query
 * @param {string} detectedLanguage - The detected language code
 * @returns {string} Formatted conversation context
 */
export function buildConversationContext(callSid, currentQuery = '', detectedLanguage = 'en-US') {
  try {
    const context = callSid ? getConversationContext(callSid) : null;
    
    if (!context) {
      return 'No previous conversation context available.';
    }

    const contextParts = [];

    // Basic conversation info
    if (context.history && context.history.length > 0) {
      const recentInteractions = context.history.slice(-3); // Last 3 interactions
      const interactionSummary = recentInteractions.map((interaction, index) => {
        const intent = interaction.intent?.replace('_', ' ') || 'general';
        const query = interaction.query?.substring(0, 100) || 'no query';
        return `${index + 1}. ${intent}: "${query}"`;
      }).join('\n');
      
      contextParts.push(`**Recent Conversation History:**\n${interactionSummary}`);
    }

    // Location context
    if (context.lastQueryContext?.location) {
      contextParts.push(`**Current Location:** ${context.lastQueryContext.location}`);
    }

    // Family concerns (pets, children, elders)
    const familyConcerns = [];
    if (context.lastQueryContext?.results) {
      const results = context.lastQueryContext.results;
      const content = results.map(r => r.content || '').join(' ').toLowerCase();
      
      if (content.includes('pet') || content.includes('dog') || content.includes('cat')) {
        familyConcerns.push('pets');
      }
      if (content.includes('child') || content.includes('kid') || content.includes('family')) {
        familyConcerns.push('children');
      }
      if (content.includes('elder') || content.includes('senior') || content.includes('aging')) {
        familyConcerns.push('elders');
      }
    }
    
    if (familyConcerns.length > 0) {
      contextParts.push(`**Family Concerns:** ${familyConcerns.join(', ')}`);
    }

    // Language preference
    if (detectedLanguage && detectedLanguage !== 'en-US') {
      const languageNames = {
        'es-ES': 'Spanish',
        'fr-FR': 'French',
        'de-DE': 'German'
      };
      const languageName = languageNames[detectedLanguage] || detectedLanguage;
      contextParts.push(`**Language Preference:** ${languageName}`);
    }

    // Emotional tone indicators
    const emotionalIndicators = [];
    if (context.lastQueryContext?.results) {
      const results = context.lastQueryContext.results;
      const content = results.map(r => r.content || '').join(' ').toLowerCase();
      
      if (content.includes('emergency') || content.includes('urgent') || content.includes('immediate')) {
        emotionalIndicators.push('urgent');
      }
      if (content.includes('scared') || content.includes('fear') || content.includes('afraid')) {
        emotionalIndicators.push('fearful');
      }
      if (content.includes('confused') || content.includes('unsure') || content.includes('don\'t know')) {
        emotionalIndicators.push('uncertain');
      }
    }
    
    if (emotionalIndicators.length > 0) {
      contextParts.push(`**Emotional Tone:** ${emotionalIndicators.join(', ')}`);
    }

    // Current needs assessment
    if (context.lastIntent) {
      const intent = context.lastIntent.replace('_', ' ');
      contextParts.push(`**Current Need:** ${intent}`);
    }

    // Resource focus
    if (context.lastQueryContext?.focusResultTitle) {
      contextParts.push(`**Focused Resource:** ${context.lastQueryContext.focusResultTitle}`);
    }

    // Location needs
    if (context.lastQueryContext?.needsLocation) {
      contextParts.push(`**Location Status:** Needs location information`);
    }

    // Build the final context string
    const contextString = contextParts.join('\n\n');
    
    logger.info('Built conversation context:', {
      callSid,
      contextParts: contextParts.length,
      hasLocation: !!context.lastQueryContext?.location,
      hasFamilyConcerns: familyConcerns.length > 0,
      hasEmotionalTone: emotionalIndicators.length > 0
    });

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