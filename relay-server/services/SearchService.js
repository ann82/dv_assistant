import { BaseService } from './base/BaseService.js';
import { SearchIntegration } from '../integrations/searchIntegration.js';
import { isNotEmpty } from '../lib/utils/validation.js';
import logger from '../lib/logger.js';

/**
 * Search Service
 * Handles all search functionality using SearchIntegration
 */
export class SearchService extends BaseService {
  constructor(config = {}) {
    super(config, 'SearchService');
    this.config = {
      apiKey: config.apiKey || process.env.TAVILY_API_KEY,
      maxResults: config.maxResults || 8,
      searchDepth: config.searchDepth || 'basic',
      cacheEnabled: config.cacheEnabled !== false,
      ...config
    };
  }

  /**
   * Initialize the search service
   */
  async initialize() {
    return this.processRequest(
      {},
      'initialize',
      async () => {
        this.logOperation('initializing');
        
        // Validate configuration
        if (!this.config.apiKey) {
          throw new Error('Tavily API key is required');
        }
        
        // Test search integration health
        const isHealthy = await SearchIntegration.isHealthy();
        if (!isHealthy) {
          throw new Error('Search integration health check failed');
        }
        
        this.logOperation('initialized successfully');
        return true;
      }
    );
  }

  /**
   * Perform a search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async search(query, options = {}) {
    return this.processRequest(
      { query, options },
      'search',
      async ({ query, options }) => {
        // Validate input
        if (!isNotEmpty(query)) {
          throw new Error('Search query is required');
        }
        
        const searchOptions = {
          maxResults: this.config.maxResults,
          searchDepth: this.config.searchDepth,
          ...options
        };
        
        // Use SearchIntegration to perform search
        const result = await SearchIntegration.search(query, searchOptions);
        
        if (!result.success) {
          throw new Error(result.error || 'Search failed');
        }
        
        this.logOperation('search completed', {
          queryLength: query.length,
          resultCount: result.data.results.length
        });
        
        return result.data;
      }
    );
  }

  /**
   * Build a specialized search query for domestic violence resources
   * @param {string} location - Location to search in
   * @param {Object} filters - Additional filters
   * @returns {string} Formatted search query
   */
  buildDvSearchQuery(location, filters = {}) {
    return SearchIntegration.buildDvSearchQuery(location, filters);
  }

  /**
   * Check if the search service is healthy
   * @returns {Promise<boolean>} Health status
   */
  async isHealthy() {
    try {
      return await SearchIntegration.isHealthy();
    } catch (error) {
      this.logger.error('Search service health check failed:', error.message);
      return false;
    }
  }

  /**
   * Get service status
   * @returns {Object} Status information
   */
  getStatus() {
    const config = SearchIntegration.getConfig();
    
    return {
      name: 'SearchService',
      enabled: true,
      initialized: this.initialized,
      config: {
        apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : undefined,
        maxResults: this.config.maxResults,
        searchDepth: this.config.searchDepth,
        cacheEnabled: this.config.cacheEnabled
      },
      integration: {
        healthy: true, // This would be checked in isHealthy()
        config: config
      }
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    this.logOperation('cleaning up');
    this.initialized = false;
  }
} 