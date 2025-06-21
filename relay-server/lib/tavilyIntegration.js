import { processTavilyResponse, getResultDetails } from './tavilyProcessor.js';
import { TavilyService } from './TavilyService.js';
import logger from './logger.js';

/**
 * Enhanced Tavily integration that uses the new processor
 */
export class EnhancedTavilyService extends TavilyService {
  
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
    console.log('🔍 Searching for shelters...');
    console.log('User Query:', userQuery);
    console.log('Search Query:', searchQuery);
    console.log('');
    
    // Get both voice and SMS responses
    const result = await tavilyService.searchShelters(searchQuery, userQuery, 3);
    
    console.log('🎤 VOICE RESPONSE:');
    console.log(result.voiceResponse);
    console.log('');
    
    console.log('📱 SMS RESPONSE:');
    console.log(result.smsResponse);
    console.log('');
    
    // Show details of top result
    if (result.topResults.length > 0) {
      console.log('📋 TOP RESULT DETAILS:');
      const details = tavilyService.getResultDetails(result.topResults[0]);
      console.log('Title:', details.title);
      console.log('URL:', details.url);
      console.log('Score:', details.score);
      console.log('Phone Numbers:', details.phoneNumbers);
      console.log('Address:', details.address);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Export for use in other modules
export default EnhancedTavilyService; 