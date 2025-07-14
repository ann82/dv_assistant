import logger from '../lib/logger.js';
import { v4 as uuidv4 } from 'uuid';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_SEARCH_DEPTH = process.env.TAVILY_SEARCH_DEPTH || 'basic';
const TAVILY_SEARCH_TYPE = process.env.TAVILY_SEARCH_TYPE || 'basic';
const TAVILY_MAX_RESULTS = parseInt(process.env.TAVILY_MAX_RESULTS) || 8;
const TAVILY_TIMEOUT = parseInt(process.env.TAVILY_TIMEOUT) || 6000; // Reduced from 15000 to 6000ms for faster response

if (!TAVILY_API_KEY) {
  logger.error('Tavily API key not found in environment variables');
  throw new Error('Tavily API key not found in environment variables');
}

/**
 * Log Search integration operation with consistent format
 * @param {string} operation - Operation being performed
 * @param {Object} data - Data to log
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} requestId - Optional request ID for tracking
 */
function logSearchOperation(operation, data = {}, level = 'info', requestId = null) {
  const logData = {
    integration: 'Search',
    operation,
    requestId: requestId || uuidv4(),
    timestamp: new Date().toISOString(),
    ...data
  };
  
  logger[level](`Search Integration - ${operation}:`, logData);
}

export const SearchIntegration = {
  /**
   * Perform a search using Tavily API
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<Object>} Search results
   */
  async search(query, options = {}, requestId = null) {
    const operationId = requestId || uuidv4();
    
    try {
      logSearchOperation('search.start', { 
        queryLength: query.length,
        queryPreview: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        options 
      }, 'info', operationId);

      const searchOptions = {
        api_key: TAVILY_API_KEY,
        query,
        search_depth: options.searchDepth || TAVILY_SEARCH_DEPTH,
        include_answer: options.includeAnswer !== false,
        include_raw_content: options.includeRawContent !== false,
        include_images: options.includeImages !== false,
        max_results: options.maxResults || TAVILY_MAX_RESULTS,
        include_domains: options.includeDomains,
        exclude_domains: options.excludeDomains,
        ...options
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TAVILY_TIMEOUT);

      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(searchOptions),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Tavily API error: ${response.status} ${response.statusText} - ${errorData.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        logSearchOperation('search.success', {
          queryLength: query.length,
          resultCount: data.results?.length || 0,
          hasAnswer: !!data.answer,
          searchDepth: searchOptions.search_depth,
          maxResults: searchOptions.max_results,
          responseTime: Date.now() - (operationId ? parseInt(operationId.split('-')[0], 16) : Date.now())
        }, 'info', operationId);

        return {
          success: true,
          data: {
            results: data.results || [],
            answer: data.answer,
            query,
            searchDepth: searchOptions.search_depth,
            maxResults: searchOptions.max_results
          }
        };

      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error(`Tavily search timed out after ${TAVILY_TIMEOUT}ms`);
        }
        throw fetchError;
      }

    } catch (error) {
      logSearchOperation('search.error', {
        queryLength: query.length,
        queryPreview: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        error: error.message,
        errorType: error.name,
        options
      }, 'error', operationId);
      
      logger.error('Error performing Tavily search:', {
        error: error.message,
        query: query.substring(0, 100) + '...',
        options,
        requestId: operationId
      });
      
      return {
        success: false,
        error: error.message,
        data: {
          results: [],
          answer: null,
          query
        }
      };
    }
  },

  /**
   * Build a specialized search query for domestic violence resources
   * @param {string} location - Location to search in
   * @param {Object} filters - Additional filters
   * @param {string} requestId - Optional request ID for tracking
   * @returns {string} Formatted search query
   */
  buildDvSearchQuery(location, filters = {}, requestId = null) {
    const operationId = requestId || uuidv4();
    
    let query = `domestic violence shelters resources help ${location}`;
    
    if (filters.pets) {
      query += ' pet friendly';
    }
    
    if (filters.children) {
      query += ' children families';
    }
    
    if (filters.emergency) {
      query += ' emergency crisis immediate help';
    }
    
    if (filters.legal) {
      query += ' legal assistance advocacy';
    }
    
    if (filters.counseling) {
      query += ' counseling therapy support groups';
    }
    
    logSearchOperation('buildDvSearchQuery', { 
      location, 
      filters, 
      queryLength: query.length,
      queryPreview: query.substring(0, 100) + (query.length > 100 ? '...' : '')
    }, 'info', operationId);
    
    return query;
  },

  /**
   * Check if the search integration is healthy
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<boolean>} Health status
   */
  async isHealthy(requestId = null) {
    const operationId = requestId || uuidv4();
    
    try {
      logSearchOperation('isHealthy.start', {}, 'info', operationId);
      
      const result = await this.search('test query', { maxResults: 1 }, operationId);
      
      logSearchOperation('isHealthy.result', { 
        healthy: result.success 
      }, 'info', operationId);
      
      return result.success;
    } catch (error) {
      logSearchOperation('isHealthy.error', { 
        error: error.message 
      }, 'error', operationId);
      
      logger.error('Search integration health check failed:', {
        error: error.message,
        requestId: operationId
      });
      return false;
    }
  },

  /**
   * Get search integration configuration
   * @returns {Object} Configuration object
   */
  getConfig() {
    return {
      integration: 'Search',
      apiKey: TAVILY_API_KEY ? '***' + TAVILY_API_KEY.slice(-4) : undefined,
      searchDepth: TAVILY_SEARCH_DEPTH,
      searchType: TAVILY_SEARCH_TYPE,
      maxResults: TAVILY_MAX_RESULTS,
      timeout: TAVILY_TIMEOUT,
      timestamp: new Date().toISOString()
    };
  }
}; 