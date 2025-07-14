import { BaseHandler } from '../base/BaseHandler.js';
import { getLanguageConfig, DEFAULT_LANGUAGE } from '../../lib/languageConfig.js';

/**
 * ResponseHandler - Handles response generation operations
 * Extends BaseHandler for common functionality and focuses on response-specific operations
 */
export class ResponseHandler extends BaseHandler {
  constructor(services = {}, dependencies = {}) {
    super(services, 'ResponseHandler');
    this._deps = dependencies;
  }

  /**
   * Get required services for this handler
   * @returns {Array} Array of required service names
   */
  getRequiredServices() {
    return ['search', 'context', 'tts'];
  }

  /**
   * Validate request structure
   * @param {Object} request - Request to validate
   */
  async validateRequest(request) {
    if (!request) {
      throw new Error('Request is required');
    }
    
    if (!request.query && !request.intent) {
      throw new Error('Request must contain either query or intent');
    }
  }

  /**
   * Generate response based on query and context
   * @param {Object} request - Request containing query and context
   * @returns {Promise<Object>} Generated response
   */
  async generateResponse(request) {
    return this.processRequest(request, 'response generation', async (req) => {
      const { query, contextId, languageCode = DEFAULT_LANGUAGE, format = 'text' } = req;

      // Get context if provided
      let context = null;
      if (contextId) {
        const contextResult = await this.services.context.getConversationContext(contextId);
        context = contextResult;
      }

      // Perform search
      const searchResult = await this.services.search.performSearch(query, context);
      
      if (!searchResult.success) {
        throw new Error(`Search failed: ${searchResult.error}`);
      }

      // Format response based on requested format
      let formattedResponse;
      switch (format) {
        case 'text':
          formattedResponse = this.formatTextResponse(searchResult.data, languageCode);
          break;
        case 'voice':
          formattedResponse = await this.formatVoiceResponse(searchResult.data, languageCode);
          break;
        case 'structured':
          formattedResponse = this.formatStructuredResponse(searchResult.data, context);
          break;
        default:
          formattedResponse = this.formatTextResponse(searchResult.data, languageCode);
      }

      // Update context with response
      if (contextId) {
        await this.services.context.updateConversationContext(contextId, {
          lastQuery: query,
          lastResults: searchResult.data,
          lastResponse: formattedResponse,
          timestamp: Date.now()
        });
      }

      return {
        query,
        response: formattedResponse,
        searchResults: searchResult.data,
        context: context,
        languageCode,
        format,
        timestamp: Date.now()
      };
    });
  }

  /**
   * Format response as text
   * @param {Object} searchData - Search results data
   * @param {string} languageCode - Language code
   * @returns {string} Formatted text response
   */
  formatTextResponse(searchData, languageCode) {
    const langConfig = getLanguageConfig(languageCode);
    
    if (!searchData.results || searchData.results.length === 0) {
      return langConfig.prompts.noResults || 'I could not find any relevant resources for your query.';
    }

    let response = langConfig.prompts.resultsIntro || 'Here are some resources that might help:\n\n';
    
    // Limit to 3 results for voice clarity
    const limitedResults = searchData.results.slice(0, 3);
    
    limitedResults.forEach((result, index) => {
      response += `${index + 1}. ${result.title}\n`;
      if (result.snippet) {
        response += `   ${result.snippet}\n`;
      }
      if (result.url) {
        response += `   Website: ${result.url}\n`;
      }
      response += '\n';
    });

    response += langConfig.prompts.resultsOutro || 'Please let me know if you need any additional information.';
    
    return response;
  }

  /**
   * Format response for voice
   * @param {Object} searchData - Search results data
   * @param {string} languageCode - Language code
   * @returns {Promise<Object>} Formatted voice response with audio
   */
  async formatVoiceResponse(searchData, languageCode) {
    const textResponse = this.formatTextResponse(searchData, languageCode);
    
    // Generate TTS
    const ttsOptions = {
      language: languageCode,
      voice: 'nova'
    };
    const ttsResult = await this.services.tts.generateSpeech(textResponse, ttsOptions);
    
    return {
      text: textResponse,
      audioUrl: ttsResult.success ? ttsResult.data.audioUrl : null,
      languageCode,
      duration: ttsResult.success ? ttsResult.data.duration : null
    };
  }

  /**
   * Format response as structured data
   * @param {Object} searchData - Search results data
   * @param {Object} context - Conversation context
   * @returns {Object} Structured response
   */
  formatStructuredResponse(searchData, context) {
    return {
      query: searchData.query,
      results: searchData.results || [],
      totalResults: searchData.totalResults || 0,
      context: context ? {
        location: context.location,
        familyConcerns: context.familyConcerns,
        lastQuery: context.lastQuery
      } : null,
      metadata: {
        searchTime: searchData.searchTime || 0,
        confidence: searchData.confidence || 0,
        source: searchData.source || 'unknown'
      }
    };
  }

  /**
   * Generate emergency response
   * @param {Object} request - Request containing emergency details
   * @returns {Promise<Object>} Emergency response
   */
  async generateEmergencyResponse(request) {
    return this.processRequest(request, 'emergency response generation', async (req) => {
      const { location, languageCode = DEFAULT_LANGUAGE, format = 'text' } = req;
      
      const langConfig = getLanguageConfig(languageCode);
      
      // Emergency response content
      const emergencyContent = {
        immediate: langConfig.prompts.emergencyImmediate || 'If you are in immediate danger, call 911 right now.',
        safety: langConfig.prompts.emergencySafety || 'Your safety is the most important thing. If possible, get to a safe location.',
        resources: langConfig.prompts.emergencyResources || 'I can help you find local emergency resources and shelters.',
        support: langConfig.prompts.emergencySupport || 'You are not alone. Help is available 24/7.'
      };

      let response;
      switch (format) {
        case 'text':
          response = this.formatEmergencyText(emergencyContent, location, languageCode);
          break;
        case 'voice':
          response = await this.formatEmergencyVoice(emergencyContent, location, languageCode);
          break;
        default:
          response = this.formatEmergencyText(emergencyContent, location, languageCode);
      }

      return {
        type: 'emergency',
        response,
        location,
        languageCode,
        format,
        timestamp: Date.now()
      };
    });
  }

  /**
   * Format emergency response as text
   * @param {Object} content - Emergency content
   * @param {string} location - Location
   * @param {string} languageCode - Language code
   * @returns {string} Formatted emergency text
   */
  formatEmergencyText(content, location, languageCode) {
    let response = `${content.immediate}\n\n`;
    response += `${content.safety}\n\n`;
    
    if (location) {
      response += `I can help you find emergency resources in ${location}.\n\n`;
    }
    
    response += `${content.resources}\n\n`;
    response += `${content.support}`;
    
    return response;
  }

  /**
   * Format emergency response for voice
   * @param {Object} content - Emergency content
   * @param {string} location - Location
   * @param {string} languageCode - Language code
   * @returns {Promise<Object>} Formatted emergency voice response
   */
  async formatEmergencyVoice(content, location, languageCode) {
    const textResponse = this.formatEmergencyText(content, location, languageCode);
    
    // Generate TTS with urgent voice settings
    const ttsOptions = {
      language: languageCode,
      voice: 'nova'
    };
    const ttsResult = await this.services.tts.generateSpeech(textResponse, ttsOptions);
    
    return {
      text: textResponse,
      audioUrl: ttsResult.success ? ttsResult.data.audioUrl : null,
      languageCode,
      urgency: 'high',
      duration: ttsResult.success ? ttsResult.data.duration : null
    };
  }

  /**
   * Generate follow-up response
   * @param {Object} request - Request containing follow-up details
   * @returns {Promise<Object>} Follow-up response
   */
  async generateFollowUpResponse(request) {
    return this.processRequest(request, 'follow-up response generation', async (req) => {
      const { contextId, query, languageCode = DEFAULT_LANGUAGE, format = 'text' } = req;

      if (!contextId) {
        throw new Error('Context ID is required for follow-up responses');
      }

      // Get conversation context
      const context = await this.services.context.getConversationContext(contextId);
      if (!context) {
        throw new Error('Context not found');
      }

      // Build context-aware query
      const enhancedQuery = this.buildContextualQuery(query, context);
      
      // Generate response with context
      const response = await this.generateResponse({
        query: enhancedQuery,
        contextId,
        languageCode,
        format
      });

      return {
        ...response,
        type: 'follow-up',
        originalQuery: query,
        enhancedQuery,
        contextUsed: {
          location: context.location,
          familyConcerns: context.familyConcerns,
          lastQuery: context.lastQuery
        }
      };
    });
  }

  /**
   * Build contextual query using conversation history
   * @param {string} query - Current query
   * @param {Object} context - Conversation context
   * @returns {string} Enhanced query with context
   */
  buildContextualQuery(query, context) {
    let enhancedQuery = query;

    // Add location context if available
    if (context.location && !query.toLowerCase().includes(context.location.toLowerCase())) {
      enhancedQuery += ` in ${context.location}`;
    }

    // Add family context if relevant
    if (context.familyConcerns && this.isFamilyRelated(query)) {
      enhancedQuery += ` for families with ${context.familyConcerns}`;
    }

    // Add previous query context if it's a follow-up
    if (context.lastQuery && this.isFollowUp(query)) {
      enhancedQuery = `${context.lastQuery} - ${enhancedQuery}`;
    }

    return enhancedQuery;
  }

  /**
   * Check if query is family-related
   * @param {string} query - Query to check
   * @returns {boolean} Whether query is family-related
   */
  isFamilyRelated(query) {
    const familyKeywords = ['children', 'kids', 'family', 'child', 'baby', 'parent', 'mother', 'father'];
    return familyKeywords.some(keyword => query.toLowerCase().includes(keyword));
  }

  /**
   * Check if query is a follow-up
   * @param {string} query - Query to check
   * @returns {boolean} Whether query is a follow-up
   */
  isFollowUp(query) {
    const followUpIndicators = ['what about', 'how about', 'also', 'too', 'as well', 'in addition', 'more', 'other'];
    return followUpIndicators.some(indicator => query.toLowerCase().includes(indicator));
  }

  /**
   * Generate multi-language response
   * @param {Object} request - Request containing multi-language details
   * @returns {Promise<Object>} Multi-language response
   */
  async generateMultiLanguageResponse(request) {
    return this.processRequest(request, 'multi-language response generation', async (req) => {
      const { query, languages = [DEFAULT_LANGUAGE], format = 'text' } = req;

      const responses = {};

      for (const languageCode of languages) {
        try {
          const response = await this.generateResponse({
            query,
            languageCode,
            format
          });
          
          responses[languageCode] = response;
        } catch (error) {
          responses[languageCode] = {
            error: error.message,
            languageCode
          };
        }
      }

      return {
        query,
        responses,
        languages,
        format,
        timestamp: Date.now()
      };
    });
  }

  /**
   * Generate response summary
   * @param {Object} request - Request containing response data
   * @returns {Promise<Object>} Response summary
   */
  async generateResponseSummary(request) {
    return this.processRequest(request, 'response summary generation', async (req) => {
      const { responses, contextId, languageCode = DEFAULT_LANGUAGE } = req;

      if (!Array.isArray(responses) || responses.length === 0) {
        throw new Error('Responses array is required');
      }

      // Get context if provided
      let context = null;
      if (contextId) {
        const contextResult = await this.services.context.getConversationContext(contextId);
        context = contextResult;
      }

      // Analyze responses
      const summary = {
        totalResponses: responses.length,
        successfulResponses: responses.filter(r => !r.error).length,
        averageConfidence: 0,
        topResults: [],
        commonThemes: [],
        languageDistribution: {},
        timestamp: Date.now()
      };

      // Calculate average confidence
      const validResponses = responses.filter(r => !r.error && r.searchResults);
      if (validResponses.length > 0) {
        const totalConfidence = validResponses.reduce((sum, r) => sum + (r.searchResults.confidence || 0), 0);
        summary.averageConfidence = totalConfidence / validResponses.length;
      }

      // Extract top results
      const allResults = validResponses.flatMap(r => r.searchResults.results || []);
      const uniqueResults = this.deduplicateResults(allResults);
      summary.topResults = uniqueResults.slice(0, 5);

      // Analyze common themes
      summary.commonThemes = this.extractCommonThemes(validResponses);

      // Language distribution
      responses.forEach(response => {
        const lang = response.languageCode || DEFAULT_LANGUAGE;
        summary.languageDistribution[lang] = (summary.languageDistribution[lang] || 0) + 1;
      });

      return {
        summary,
        context: context ? {
          location: context.location,
          familyConcerns: context.familyConcerns,
          conversationLength: context.history?.length || 0
        } : null
      };
    });
  }

  /**
   * Deduplicate search results
   * @param {Array} results - Array of search results
   * @returns {Array} Deduplicated results
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      const key = result.url || result.title;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Extract common themes from responses
   * @param {Array} responses - Array of responses
   * @returns {Array} Common themes
   */
  extractCommonThemes(responses) {
    const themes = new Map();
    
    responses.forEach(response => {
      if (response.searchResults && response.searchResults.results) {
        response.searchResults.results.forEach(result => {
          const words = (result.title + ' ' + (result.snippet || '')).toLowerCase().split(/\s+/);
          words.forEach(word => {
            if (word.length > 3) {
              themes.set(word, (themes.get(word) || 0) + 1);
            }
          });
        });
      }
    });

    return Array.from(themes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([theme, count]) => ({ theme, count }));
  }

  /**
   * Get response generation statistics
   * @returns {Object} Generation statistics
   */
  getGenerationStats() {
    return {
      handlerName: this.handlerName,
      totalResponses: this.responseCount || 0,
      averageGenerationTime: this.averageGenerationTime || 0,
      errorRate: this.errorRate || 0,
      lastGenerated: this.lastGenerated || null,
      formatDistribution: this.formatDistribution || {},
      languageDistribution: this.languageDistribution || {}
    };
  }
} 