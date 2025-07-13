import { config } from './config.js';
import logger from './logger.js';
import { OpenAIIntegration } from '../integrations/openaiIntegration.js';
import { SearchIntegration } from '../integrations/searchIntegration.js';
import { voiceInstructions } from './conversationConfig.js';
import { gptCache } from './queryCache.js';

const openAIIntegration = new OpenAIIntegration();

/**
 * Simplified Response Handler - AI-First Approach
 * 
 * This implements the simplified architecture outlined in CODE_SIMPLIFICATION_ANALYSIS.md
 * Instead of complex intent classification, query rewriting, and response routing,
 * we let the AI handle everything based on the detailed conversation instructions.
 */
export class SimplifiedResponseHandler {
  
  /**
   * Main response generation method - AI handles everything
   * @param {string} input - User query
   * @param {Object} context - Conversation context
   * @param {string} requestType - 'voice' or 'web'
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  static async getResponse(input, context = {}, requestType = 'web', options = {}) {
    try {
      logger.info('SimplifiedResponseHandler: Processing query', { 
        input, 
        requestType, 
        hasContext: !!context 
      });

      // Check cache first
      const cachedResponse = this.getCachedResponse(input);
      if (cachedResponse) {
        logger.info('SimplifiedResponseHandler: Using cached response');
        return cachedResponse;
      }

      // Let AI handle everything
      const response = await this.generateAIResponse(input, context, requestType, options);
      
      // Cache the response
      this.cacheResponse(input, response);
      
      return response;

    } catch (error) {
      logger.error('SimplifiedResponseHandler: Error generating response', error);
      return this.generateFallbackResponse(input, requestType);
    }
  }

  /**
   * Generate AI response using the detailed conversation instructions
   * @param {string} input - User query
   * @param {Object} context - Conversation context
   * @param {string} requestType - 'voice' or 'web'
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  static async generateAIResponse(input, context, requestType, options) {
    const startTime = Date.now();
    
    // Build conversation context for AI
    const conversationContext = this.buildConversationContext(context);
    
    // Determine which instructions to use
    const instructions = requestType === 'voice' ? voiceInstructions : this.getWebInstructions();
    
    // Create the AI prompt
    const prompt = this.createAIPrompt(input, conversationContext, instructions);
    
    // Generate response using OpenAI
    const aiResponse = await openAIIntegration.createChatCompletion({
      model: config.GPT35_MODEL,
      messages: [
        {
          role: 'system',
          content: instructions
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      maxTokens: 1000,
      temperature: 0.7
    });

    const responseTime = Date.now() - startTime;
    
    logger.info('SimplifiedResponseHandler: AI response generated', {
      responseTime: `${responseTime}ms`,
      model: config.GPT35_MODEL,
      inputLength: input.length,
      responseLength: aiResponse.choices[0].message.content.length
    });

    // Format the response based on request type
    return this.formatResponse(aiResponse.choices[0].message.content, requestType, context);
  }

  /**
   * Build conversation context for AI
   * @param {Object} context - Raw context
   * @returns {string} Formatted conversation context
   */
  static buildConversationContext(context) {
    if (!context || Object.keys(context).length === 0) {
      return 'This is a new conversation.';
    }

    let contextStr = 'Previous conversation context:\n';
    
    if (context.location) {
      contextStr += `- Location: ${context.location}\n`;
    }
    
    if (context.lastQuery) {
      contextStr += `- Last query: "${context.lastQuery}"\n`;
    }
    
    if (context.lastIntent) {
      contextStr += `- Last intent: ${context.lastIntent}\n`;
    }
    
    if (context.results && context.results.length > 0) {
      contextStr += `- Previous results: ${context.results.length} items found\n`;
    }
    
    if (context.needsLocation) {
      contextStr += `- User needs to provide location\n`;
    }

    return contextStr;
  }

  /**
   * Create AI prompt with context
   * @param {string} input - User query
   * @param {string} conversationContext - Conversation context
   * @param {string} instructions - AI instructions
   * @returns {string} Complete prompt
   */
  static createAIPrompt(input, conversationContext, instructions) {
    return `User Query: "${input}"

${conversationContext}

Please respond appropriately based on the conversation instructions. If the user needs specific resources (shelters, legal help, etc.), provide helpful information and guidance. If they're in immediate danger, prioritize safety protocols.`;
  }

  /**
   * Format AI response for different request types
   * @param {string} aiResponse - Raw AI response
   * @param {string} requestType - 'voice' or 'web'
   * @param {Object} context - Conversation context
   * @returns {Object} Formatted response
   */
  static formatResponse(aiResponse, requestType, context) {
    const baseResponse = {
      success: true,
      source: 'ai_simplified',
      timestamp: new Date().toISOString(),
      conversationContext: context
    };

    if (requestType === 'voice') {
      return {
        ...baseResponse,
        voiceResponse: aiResponse,
        smsResponse: this.createSMSResponse(aiResponse),
        summary: this.createSummary(aiResponse)
      };
    } else {
      return {
        ...baseResponse,
        webResponse: aiResponse,
        voiceResponse: aiResponse, // For web interface TTS
        smsResponse: this.createSMSResponse(aiResponse)
      };
    }
  }

  /**
   * Create SMS response from AI response
   * @param {string} aiResponse - AI response
   * @returns {string} SMS-formatted response
   */
  static createSMSResponse(aiResponse) {
    // Simplify for SMS - remove conversational elements
    let smsResponse = aiResponse
      .replace(/^Hello[^.]*\./, '') // Remove greetings
      .replace(/Thank you[^.]*\./, '') // Remove thank yous
      .trim();
    
    // Limit length for SMS
    if (smsResponse.length > 160) {
      smsResponse = smsResponse.substring(0, 157) + '...';
    }
    
    return smsResponse || 'Thank you for reaching out. Please call 1-800-799-7233 for immediate support.';
  }

  /**
   * Create summary from AI response
   * @param {string} aiResponse - AI response
   * @returns {string} Summary
   */
  static createSummary(aiResponse) {
    // Extract key points for summary
    const sentences = aiResponse.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length <= 2) {
      return aiResponse;
    }
    
    return sentences.slice(0, 2).join('. ') + '.';
  }

  /**
   * Get web instructions (simplified version)
   * @returns {string} Web instructions
   */
  static getWebInstructions() {
    return `You are a domestic violence support assistant. Be empathetic, helpful, and prioritize safety. If someone mentions immediate danger, direct them to call 911. Provide clear, actionable guidance and resources.`;
  }

  /**
   * Generate fallback response when AI fails
   * @param {string} input - User query
   * @param {string} requestType - Request type
   * @returns {Object} Fallback response
   */
  static generateFallbackResponse(input, requestType) {
    const fallbackMessage = 'I apologize, but I\'m having trouble processing your request right now. Please call the National Domestic Violence Hotline at 1-800-799-7233 for immediate support.';
    
    return {
      success: false,
      source: 'fallback',
      timestamp: new Date().toISOString(),
      voiceResponse: fallbackMessage,
      smsResponse: fallbackMessage,
      webResponse: fallbackMessage,
      summary: 'System temporarily unavailable. Please call hotline for support.'
    };
  }

  /**
   * Cache management
   */
  static getCachedResponse(input) {
    if (!input) return null;
    const normalizedInput = input.toLowerCase().trim();
    return gptCache.get(normalizedInput);
  }

  static cacheResponse(input, response) {
    if (!input) return;
    const normalizedInput = input.toLowerCase().trim();
    gptCache.set(normalizedInput, response, 3600000); // 1 hour cache
  }

  /**
   * Check if this is an emergency query that needs immediate attention
   * @param {string} input - User query
   * @returns {boolean} True if emergency
   */
  static isEmergencyQuery(input) {
    if (!input) return false;
    
    const emergencyKeywords = [
      'suicide', 'kill', 'weapon', 'gun', 'knife', 'danger', 'emergency',
      'immediate', 'right now', 'help now', 'crisis', 'unsafe'
    ];
    
    const lowerInput = input.toLowerCase();
    return emergencyKeywords.some(keyword => lowerInput.includes(keyword));
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  static getCacheStats() {
    return gptCache.getStats();
  }
} 