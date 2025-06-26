import { processTavilyResponse, getResultDetails } from './tavilyProcessor.js';
import logger from './logger.js';

/**
 * Enhanced Tavily integration that uses the new processor
 */
export class EnhancedTavilyService {
  
  /**
   * Call Tavily API directly using the standardized function
   * @param {string} query - Search query
   * @param {string} location - Optional location for enhanced search
   * @returns {Object} Tavily API response
   */
  async callTavilyAPI(query, location = null) {
    try {
      // Use the standardized Tavily API function
      const { callTavilyAPI } = await import('./apis.js');
      return await callTavilyAPI(query, location);
    } catch (error) {
      logger.error('Error calling Tavily API:', error);
      throw error;
    }
  }
  
  /**
   * Search for shelters and return processed voice/SMS responses
   * @param {string} query - User query
   * @param {string} userQuery - Original user query for context
   * @param {number} maxResults - Maximum results to include
   * @returns {Object} Object with voiceResponse and smsResponse
   */
  async searchShelters(query, userQuery, maxResults = 3) {
    try {
      logger.info('Enhanced Tavily search:', { query, userQuery, maxResults });
      
      // Extract location from query for better search results
      const location = this.extractLocationFromQuery(query);
      
      // Get raw Tavily response using standardized API
      const tavilyResponse = await this.callTavilyAPI(query, location);
      
      // Process the response using the new processor
      const processedResponse = processTavilyResponse(tavilyResponse, userQuery, maxResults);
      
      logger.info('Enhanced Tavily search completed:', {
        originalResults: tavilyResponse?.results?.length || 0,
        processedResults: maxResults,
        voiceResponseLength: processedResponse.voiceResponse.length,
        smsResponseLength: processedResponse.smsResponse.length
      });
      
      return {
        ...processedResponse,
        rawResponse: tavilyResponse, // Include raw response for debugging
        topResults: tavilyResponse?.results?.slice(0, maxResults) || []
      };
      
    } catch (error) {
      logger.error('Error in enhanced Tavily search:', error);
      return {
        voiceResponse: "I'm sorry, I encountered an error while searching for shelters. Please try again.",
        smsResponse: "Error processing shelter search. Please try again or contact the National Domestic Violence Hotline at 1-800-799-7233.",
        rawResponse: null,
        topResults: []
      };
    }
  }

  /**
   * Extract location from query string
   * @param {string} query - Search query
   * @returns {string|null} Extracted location or null
   */
  extractLocationFromQuery(query) {
    if (!query) return null;
    
    // Simple location extraction - can be enhanced with more sophisticated parsing
    const locationPatterns = [
      /(?:in|near|at|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*[A-Z]{2}/i,
      /\d{5}/ // ZIP codes
    ];
    
    for (const pattern of locationPatterns) {
      const match = query.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    
    return null;
  }
  
  /**
   * Get detailed information about a specific result
   * @param {Object} result - Tavily result object
   * @returns {Object} Detailed information
   */
  getResultDetails(result) {
    return getResultDetails(result);
  }
  
  /**
   * Search and return only the voice response
   * @param {string} query - User query
   * @param {string} userQuery - Original user query
   * @param {number} maxResults - Maximum results
   * @returns {string} Voice response
   */
  async getVoiceResponse(query, userQuery, maxResults = 3) {
    const result = await this.searchShelters(query, userQuery, maxResults);
    return result.voiceResponse;
  }
  
  /**
   * Search and return only the SMS response
   * @param {string} query - User query
   * @param {string} userQuery - Original user query
   * @param {number} maxResults - Maximum results
   * @returns {string} SMS response
   */
  async getSMSResponse(query, userQuery, maxResults = 3) {
    const result = await this.searchShelters(query, userQuery, maxResults);
    return result.smsResponse;
  }
}

/**
 * Example usage function
 */
export async function exampleUsage() {
  const tavilyService = new EnhancedTavilyService();
  
  // Example query
  const userQuery = "find shelter homes in South Lake Tahoe";
  const searchQuery = "domestic violence shelters South Lake Tahoe California";
  
  try {
    logger.info('🔍 Searching for shelters...', { userQuery, searchQuery });
    
    // Get both voice and SMS responses
    const result = await tavilyService.searchShelters(searchQuery, userQuery, 3);
    
    logger.info('🎤 VOICE RESPONSE:', { 
      voiceResponse: result.voiceResponse.substring(0, 100) + '...',
      smsResponse: result.smsResponse.substring(0, 100) + '...'
    });
    
    // Show details of top result
    if (result.topResults.length > 0) {
      const details = tavilyService.getResultDetails(result.topResults[0]);
      logger.info('📋 TOP RESULT DETAILS:', {
        title: details.title,
        url: details.url,
        score: details.score,
        phoneNumbers: details.phoneNumbers,
        address: details.address
      });
    }
    
  } catch (error) {
    logger.error('❌ Error in example usage:', error);
  }
}

// Export for use in other modules
export default EnhancedTavilyService; 