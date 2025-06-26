import { processTavilyResponse, getResultDetails } from './tavilyProcessor.js';
import logger from './logger.js';

/**
 * Enhanced Tavily integration that uses the new processor
 */
export class EnhancedTavilyService {
  
  /**
   * Call Tavily API directly
   * @param {string} query - Search query
   * @returns {Object} Tavily API response
   */
  async callTavilyAPI(query) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': process.env.TAVILY_API_KEY
        },
        body: JSON.stringify({
          query,
          search_depth: 'advanced',
          include_answer: true,
          include_results: true,
          include_raw_content: false,
          max_results: 5
        })
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.statusText}`);
      }

      return await response.json();
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
      
      // Get raw Tavily response
      const tavilyResponse = await this.callTavilyAPI(query);
      
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