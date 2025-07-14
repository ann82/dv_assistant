import { config } from './config.js';
import logger from './logger.js';
import { OpenAIIntegration } from '../integrations/openaiIntegration.js';
import { SearchIntegration } from '../integrations/searchIntegration.js';
import { voiceInstructions } from './conversationConfig.js';
import { gptCache } from './queryCache.js';

/**
 * Hybrid Response Handler - AI-First with Tavily Fallback
 * 
 * This implements the hybrid approach outlined in CODE_SIMPLIFICATION_ANALYSIS.md
 * - Uses AI for most queries (conversation, guidance, follow-ups)
 * - Uses Tavily for factual shelter searches
 * - Provides 50% code reduction while maintaining cost optimization
 */
export class HybridResponseHandler {
  
  /**
   * Main response generation method
   * @param {string} input - User query
   * @param {Object} context - Conversation context
   * @param {string} requestType - 'voice' or 'web'
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  static async getResponse(input, context = {}, requestType = 'web', options = {}) {
    try {
      logger.info('HybridResponseHandler: Processing query', { 
        input, 
        requestType, 
        hasContext: !!context 
      });

      // Check cache first
      const cachedResponse = this.getCachedResponse(input);
      if (cachedResponse) {
        logger.info('HybridResponseHandler: Using cached response');
        return cachedResponse;
      }

      // Determine if this is a factual shelter search
      if (this.isShelterSearch(input)) {
        logger.info('HybridResponseHandler: Using Tavily for shelter search');
        return await this.handleShelterSearch(input, context, requestType, options);
      }
      
      // Use AI for everything else
      logger.info('HybridResponseHandler: Using AI for conversational query');
      return await this.handleAIResponse(input, context, requestType, options);

    } catch (error) {
      logger.error('HybridResponseHandler: Error generating response', error);
      return this.generateFallbackResponse(input, requestType);
    }
  }

  /**
   * Check if query is a shelter search that should use Tavily
   * @param {string} input - User query
   * @returns {boolean} True if shelter search
   */
  static isShelterSearch(input) {
    if (!input) return false;
    
    const lowerInput = input.toLowerCase();
    
    // Shelter-specific keywords
    const shelterKeywords = [
      'shelter', 'safe house', 'emergency housing', 'crisis center',
      'domestic violence shelter', 'abuse shelter', 'refuge',
      'place to stay', 'safe place', 'emergency shelter'
    ];
    
    // Location indicators
    const locationIndicators = [
      'near me', 'in', 'at', 'around', 'close to', 'nearby',
      'find', 'search for', 'looking for', 'need'
    ];
    
    // Check if query contains shelter keywords AND location indicators
    const hasShelterKeyword = shelterKeywords.some(keyword => lowerInput.includes(keyword));
    const hasLocationIndicator = locationIndicators.some(indicator => lowerInput.includes(indicator));
    
    return hasShelterKeyword && hasLocationIndicator;
  }

  /**
   * Handle shelter search using Tavily
   * @param {string} input - User query
   * @param {Object} context - Conversation context
   * @param {string} requestType - Request type
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  static async handleShelterSearch(input, context, requestType, options) {
    const startTime = Date.now();
    
    try {
      // Extract location from query or context
      const location = this.extractLocation(input, context);
      
      // Build search query
      const searchQuery = this.buildShelterSearchQuery(input, location);
      
      // Search using Tavily
      const searchResult = await SearchIntegration.search(searchQuery);
      logger.info('HybridResponseHandler: DEBUG Tavily searchResult', { searchResult });
      
      const responseTime = Date.now() - startTime;
      
      logger.info('HybridResponseHandler: Tavily search completed', {
        query: searchQuery,
        resultsCount: searchResult?.results?.length || 0,
        responseTime: `${responseTime}ms`
      });

      // Format response
      const response = this.formatShelterResponse(searchResult, input, context, requestType);
      
      // Cache the response
      this.cacheResponse(input, response);
      
      return response;

    } catch (error) {
      logger.error('HybridResponseHandler: Tavily search failed', error);
      // Fallback to AI response
      return this.generateFallbackResponse(input, requestType);
    }
  }

  /**
   * Handle AI response for conversational queries
   * @param {string} input - User query
   * @param {Object} context - Conversation context
   * @param {string} requestType - Request type
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response object
   */
  static async handleAIResponse(input, context, requestType, options) {
    const startTime = Date.now();
    
    try {
      // Build conversation context for AI
      const conversationContext = this.buildConversationContext(context);
      
      // Determine which instructions to use
      const instructions = requestType === 'voice' ? voiceInstructions : this.getWebInstructions();
      
      // Create the AI prompt
      const prompt = this.createAIPrompt(input, conversationContext, instructions);
      
      // Generate response using OpenAI
      const openAIIntegration = new OpenAIIntegration();
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
      logger.info('HybridResponseHandler: DEBUG aiResponse', { aiResponse });

      const responseTime = Date.now() - startTime;
      
      logger.info('HybridResponseHandler: AI response generated', {
        responseTime: `${responseTime}ms`,
        model: config.GPT35_MODEL,
        inputLength: input.length,
        responseLength: aiResponse.choices[0].message.content.length
      });

      // Format the response
      const response = this.formatAIResponse(aiResponse.choices[0].message.content, requestType, context);
      
      // Cache the response
      this.cacheResponse(input, response);
      
      return response;
      
    } catch (error) {
      logger.error('HybridResponseHandler: AI response failed', error);
      
      // For AI path, always return success: true even on error
      // This ensures non-shelter queries don't fall back to failure responses
      const fallbackMessage = 'I understand your question. Please call the National Domestic Violence Hotline at 1-800-799-7233 for immediate support and guidance.';
      
      const fallbackResponse = {
        success: true,
        source: 'ai_hybrid_fallback',
        timestamp: new Date().toISOString(),
        conversationContext: context
      };

      if (requestType === 'voice') {
        return {
          ...fallbackResponse,
          voiceResponse: fallbackMessage,
          smsResponse: fallbackMessage,
          summary: 'AI temporarily unavailable. Please call hotline for support.'
        };
      } else {
        return {
          ...fallbackResponse,
          webResponse: fallbackMessage,
          voiceResponse: fallbackMessage,
          smsResponse: fallbackMessage
        };
      }
    }
  }

  /**
   * Extract location from query or context
   * @param {string} input - User query
   * @param {Object} context - Conversation context
   * @returns {string|null} Location
   */
  static extractLocation(input, context) {
    // First check context
    if (context && context.location) {
      return context.location;
    }
    
    // Then extract from query using simple patterns
    const locationPatterns = [
      /(?:in|at|near|around|close to)\s+([^,.?]+(?:,\s*[^,.?]+)?)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:TX|CA|NY|FL|IL|PA|OH|GA|NC|MI|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|CO|OR|MN|WI|SC|AL|LA|KY|CT|IA|MS|AR|UT|NV|NM|KS|NE|ID|HI|NH|ME|RI|MT|DE|SD|ND|AK|VT|WY|WV|OK|DC))/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  /**
   * Build shelter search query for Tavily
   * @param {string} input - User query
   * @param {string} location - Location
   * @returns {string} Search query
   */
  static buildShelterSearchQuery(input, location) {
    let query = 'domestic violence shelter';
    
    if (location) {
      query += ` ${location}`;
    }
    
    // Add simplified terms for better performance
    query += ' help resources contact';
    
    // Add site restrictions (simplified)
    query += ' site:org OR site:gov';
    
    return query;
  }

  /**
   * Format shelter search response
   * @param {Object} searchResult - Tavily search result
   * @param {string} input - Original query
   * @param {Object} context - Conversation context
   * @param {string} requestType - Request type
   * @returns {Object} Formatted response
   */
  static formatShelterResponse(searchResult, input, context, requestType) {
    const results = searchResult?.results || [];
    const location = this.extractLocation(input, context);
    
    // Filter relevant results
    const relevantResults = results.filter(result => 
      result.score >= 0.2 && 
      this.isRelevantShelter(result)
    ).slice(0, 3);
    
    // Create response
    const baseResponse = {
      success: true,
      source: 'tavily_hybrid',
      timestamp: new Date().toISOString(),
      conversationContext: context,
      results: relevantResults
    };

    if (requestType === 'voice') {
      return {
        ...baseResponse,
        voiceResponse: this.createVoiceResponse(relevantResults, location),
        smsResponse: this.createSMSResponse(relevantResults, location),
        summary: this.createSummary(relevantResults, location)
      };
    } else {
      return {
        ...baseResponse,
        webResponse: this.createWebResponse(relevantResults, location),
        voiceResponse: this.createVoiceResponse(relevantResults, location),
        smsResponse: this.createSMSResponse(relevantResults, location)
      };
    }
  }

  /**
   * Format AI response
   * @param {string} aiResponse - AI response
   * @param {string} requestType - Request type
   * @param {Object} context - Conversation context
   * @returns {Object} Formatted response
   */
  static formatAIResponse(aiResponse, requestType, context) {
    const baseResponse = {
      success: true,
      source: 'ai_hybrid',
      timestamp: new Date().toISOString(),
      conversationContext: context
    };

    if (requestType === 'voice') {
      return {
        ...baseResponse,
        voiceResponse: aiResponse,
        smsResponse: this.createSMSResponseFromAI(aiResponse),
        summary: this.createSummaryFromAI(aiResponse)
      };
    } else {
      return {
        ...baseResponse,
        webResponse: aiResponse,
        voiceResponse: aiResponse,
        smsResponse: this.createSMSResponseFromAI(aiResponse)
      };
    }
  }

  /**
   * Check if result is a relevant shelter
   * @param {Object} result - Tavily result
   * @returns {boolean} True if relevant
   */
  static isRelevantShelter(result) {
    if (!result || !result.title || !result.content) {
      return false;
    }
    const title = result.title.toLowerCase();
    const content = result.content.toLowerCase();
    const shelterKeywords = ['shelter', 'safe house', 'crisis center', 'domestic violence'];
    const hasShelterKeyword = shelterKeywords.some(keyword => 
      title.includes(keyword) || content.includes(keyword)
    );
    const hasContactInfo = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(content) || 
                          /\bwww\.|\.org|\.gov\b/.test(result.url);
    return hasShelterKeyword && hasContactInfo;
  }

  /**
   * Create voice response for shelter results
   * @param {Array} results - Shelter results
   * @param {string} location - Location
   * @returns {string} Voice response
   */
  static createVoiceResponse(results, location) {
    if (!results || results.length === 0) {
      return `I wasn't able to find shelters in ${location || 'your area'}. Please call the National Domestic Violence Hotline at 1-800-799-7233 for immediate assistance.`;
    }
    
    let response = `I found ${results.length} shelter${results.length > 1 ? 's' : ''} in ${location || 'your area'}. `;
    
    results.forEach((result, index) => {
      const title = this.cleanTitle(result.title);
      const phone = this.extractPhone(result.content);
      
      response += `${index + 1}. ${title}`;
      if (phone) {
        response += `. Phone: ${phone}`;
      }
      response += '. ';
    });
    
    response += 'Please call these shelters directly to check availability and policies.';
    
    return response;
  }

  /**
   * Create SMS response for shelter results
   * @param {Array} results - Shelter results
   * @param {string} location - Location
   * @returns {string} SMS response
   */
  static createSMSResponse(results, location) {
    if (!results || results.length === 0) {
      return `No shelters found in ${location || 'your area'}. Call 1-800-799-7233 for help.`;
    }
    
    let response = `Shelters in ${location || 'your area'}: `;
    
    results.forEach((result, index) => {
      const title = this.cleanTitle(result.title);
      const phone = this.extractPhone(result.content);
      
      response += `${index + 1}. ${title}`;
      if (phone) {
        response += ` (${phone})`;
      }
      response += '; ';
    });
    
    return response.substring(0, 160);
  }

  /**
   * Create web response for shelter results
   * @param {Array} results - Shelter results
   * @param {string} location - Location
   * @returns {string} Web response
   */
  static createWebResponse(results, location) {
    if (!results || results.length === 0) {
      return `I wasn't able to find shelters in ${location || 'your area'}. Please call the National Domestic Violence Hotline at 1-800-799-7233 for immediate assistance.`;
    }
    
    let response = `I found ${results.length} shelter${results.length > 1 ? 's' : ''} in ${location || 'your area'}:<br><br>`;
    
    results.forEach((result, index) => {
      const title = this.cleanTitle(result.title);
      const phone = this.extractPhone(result.content);
      
      response += `<strong>${index + 1}. ${title}</strong><br>`;
      if (phone) {
        response += `Phone: ${phone}<br>`;
      }
      response += `<br>`;
    });
    
    response += 'Please call these shelters directly to check availability and policies.';
    
    return response;
  }

  /**
   * Create SMS response from AI response
   * @param {string} aiResponse - AI response
   * @returns {string} SMS response
   */
  static createSMSResponseFromAI(aiResponse) {
    let smsResponse = aiResponse
      .replace(/^Hello[^.]*\./, '')
      .replace(/Thank you[^.]*\./, '')
      .trim();
    
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
  static createSummaryFromAI(aiResponse) {
    const sentences = aiResponse.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length <= 2) {
      return aiResponse;
    }
    
    return sentences.slice(0, 2).join('. ') + '.';
  }

  /**
   * Create summary for shelter results
   * @param {Array} results - Shelter results
   * @param {string} location - Location
   * @returns {string} Summary
   */
  static createSummary(results, location) {
    if (!results || results.length === 0) {
      return `No shelters found in ${location || 'your area'}. Please call 1-800-799-7233 for assistance.`;
    }
    
    return `Found ${results.length} shelter${results.length > 1 ? 's' : ''} in ${location || 'your area'}. Please call them directly for availability.`;
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
   * Get web instructions (simplified version)
   * @returns {string} Web instructions
   */
  static getWebInstructions() {
    return `You are a domestic violence support assistant. Be empathetic, helpful, and prioritize safety. If someone mentions immediate danger, direct them to call 911. Provide clear, actionable guidance and resources.`;
  }

  /**
   * Generate fallback response when everything fails
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
   * Utility methods
   */
  static cleanTitle(title) {
    if (!title) return '';
    return title.replace(/[^\w\s-]/g, '').trim();
  }

  static extractPhone(content) {
    if (!content) return null;
    const phoneMatch = content.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
    return phoneMatch ? phoneMatch[0] : null;
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
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  static getCacheStats() {
    return gptCache.getStats();
  }
} 