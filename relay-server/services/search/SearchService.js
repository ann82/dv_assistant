import { BaseService } from '../base/BaseService.js';
import { apiConfig } from '../../lib/config/api.js';
import { withTimeout, retryWithBackoff, isRetryableError } from '../../lib/utils/errorHandling.js';
import { isNotEmpty, isValidUrl } from '../../lib/utils/validation.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * Search Service
 * Handles all search functionality including Tavily integration, result processing, and caching
 */
export class SearchService extends BaseService {
  constructor(config = {}) {
    super(config, 'SearchService');
    this.config = { ...apiConfig.tavily, ...config };
    this.cache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      total: 0
    };
  }
  
  /**
   * Initialize search service
   */
  async initialize() {
    try {
      this.logOperation('initializing');
      
      // Validate configuration
      if (!this.config.apiKey) {
        throw new Error('Tavily API key is required for search service');
      }
      
      // Initialize cache directory
      if (this.config.cacheEnabled) {
        await this.initializeCache();
      }
      
      this.logOperation('initialized');
    } catch (error) {
      await this.handleError(error, 'initialize');
      throw error;
    }
  }
  
  /**
   * Initialize cache directory
   */
  async initializeCache() {
    try {
      const cacheDir = './cache/search';
      await fs.mkdir(cacheDir, { recursive: true });
      this.logOperation('cache initialized', { directory: cacheDir });
    } catch (error) {
      this.logger.warn('Failed to initialize search cache directory:', error.message);
    }
  }
  
  /**
   * Search for resources using Tavily
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
          maxResults: options.maxResults || this.config.maxResults,
          searchDepth: options.searchDepth || this.config.searchDepth,
          searchType: options.searchType || this.config.searchType,
          includeRawContent: this.config.includeRawContent,
          ...options
        };
        
        // Check cache first
        const cacheKey = this.generateCacheKey(query, searchOptions);
        const cachedResult = await this.getFromCache(cacheKey);
        
        if (cachedResult) {
          this.logOperation('cache hit', { cacheKey: cacheKey.substring(0, 8) });
          return cachedResult;
        }
        
        this.logOperation('cache miss', { cacheKey: cacheKey.substring(0, 8) });
        
        // Perform search
        const results = await this.performTavilySearch(query, searchOptions);
        
        // Process and filter results
        const processedResults = this.processSearchResults(results, query, options);
        
        const searchResult = {
          query,
          results: processedResults,
          totalResults: processedResults.length,
          searchOptions,
          timestamp: new Date().toISOString()
        };
        
        // Cache result
        if (this.config.cacheEnabled) {
          await this.addToCache(cacheKey, searchResult);
        }
        
        return searchResult;
      }
    );
  }
  
  /**
   * Perform search using Tavily API
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Raw search results
   */
  async performTavilySearch(query, options) {
    const searchFunction = async () => {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          query,
          search_depth: options.searchDepth,
          include_answer: false,
          include_raw_content: options.includeRawContent,
          max_results: options.maxResults,
          include_domains: [],
          exclude_domains: []
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Tavily API error: ${response.status} - ${errorData.message || response.statusText}`);
      }
      
      const data = await response.json();
      return data.results || [];
    };
    
    return retryWithBackoff(searchFunction, {
      maxRetries: 3,
      baseDelay: 1000,
      retryCondition: isRetryableError
    });
  }
  
  /**
   * Process and filter search results
   * @param {Array} results - Raw search results
   * @param {string} query - Original search query
   * @param {Object} options - Search options
   * @returns {Array} Processed results
   */
  processSearchResults(results, query, options = {}) {
    if (!Array.isArray(results)) {
      return [];
    }
    
    return results
      .map(result => this.processSingleResult(result, query))
      .filter(result => result !== null)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, options.maxResults || this.config.maxResults);
  }
  
  /**
   * Process a single search result
   * @param {Object} result - Raw result from Tavily
   * @param {string} query - Original search query
   * @returns {Object|null} Processed result or null if invalid
   */
  processSingleResult(result, query) {
    try {
      // Validate required fields
      if (!result.title || !result.url) {
        return null;
      }
      
      // Validate URL
      if (!isValidUrl(result.url)) {
        return null;
      }
      
      // Extract and clean content
      const content = this.extractContent(result);
      if (!content || content.length < 50) {
        return null;
      }
      
      // Calculate relevance score
      const score = this.calculateRelevanceScore(result, query);
      
      return {
        title: result.title.trim(),
        url: result.url,
        content: content,
        score: score,
        source: result.source || 'unknown',
        publishedDate: result.published_date || null,
        domain: this.extractDomain(result.url)
      };
    } catch (error) {
      this.logger.warn('Failed to process search result:', error.message);
      return null;
    }
  }
  
  /**
   * Extract content from search result
   * @param {Object} result - Raw result from Tavily
   * @returns {string} Extracted content
   */
  extractContent(result) {
    // Try different content fields in order of preference
    const contentFields = ['content', 'snippet', 'description', 'text'];
    
    for (const field of contentFields) {
      if (result[field] && typeof result[field] === 'string') {
        const content = result[field].trim();
        if (content.length > 0) {
          return content;
        }
      }
    }
    
    return '';
  }
  
  /**
   * Calculate relevance score for search result
   * @param {Object} result - Search result
   * @param {string} query - Search query
   * @returns {number} Relevance score (0-1)
   */
  calculateRelevanceScore(result, query) {
    let score = 0;
    const queryLower = query.toLowerCase();
    const titleLower = (result.title || '').toLowerCase();
    const contentLower = (result.content || '').toLowerCase();
    
    // Title relevance (higher weight)
    const titleWords = queryLower.split(/\s+/);
    const titleMatches = titleWords.filter(word => titleLower.includes(word)).length;
    score += (titleMatches / titleWords.length) * 0.6;
    
    // Content relevance
    const contentMatches = titleWords.filter(word => contentLower.includes(word)).length;
    score += (contentMatches / titleWords.length) * 0.3;
    
    // URL relevance
    if (result.url && result.url.toLowerCase().includes(queryLower)) {
      score += 0.1;
    }
    
    // Boost for domestic violence related content
    const dvKeywords = ['domestic violence', 'abuse', 'shelter', 'crisis', 'help', 'support'];
    const hasDvContent = dvKeywords.some(keyword => 
      titleLower.includes(keyword) || contentLower.includes(keyword)
    );
    
    if (hasDvContent) {
      score += 0.2;
    }
    
    return Math.min(1, Math.max(0, score));
  }
  
  /**
   * Extract domain from URL
   * @param {string} url - URL to extract domain from
   * @returns {string} Domain name
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }
  
  /**
   * Generate cache key for search request
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {string} Cache key
   */
  generateCacheKey(query, options) {
    const data = {
      query: query.toLowerCase().trim(),
      maxResults: options.maxResults,
      searchDepth: options.searchDepth,
      searchType: options.searchType
    };
    
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  }
  
  /**
   * Get search result from cache
   * @param {string} cacheKey - Cache key
   * @returns {Promise<Object|null>} Cached result or null
   */
  async getFromCache(cacheKey) {
    if (!this.config.cacheEnabled) {
      return null;
    }
    
    try {
      const cacheFile = path.join('./cache/search', `${cacheKey}.json`);
      const cacheData = await fs.readFile(cacheFile, 'utf8');
      const cached = JSON.parse(cacheData);
      
      // Check if cache is still valid (1 hour TTL)
      const age = Date.now() - new Date(cached.timestamp).getTime();
      if (age > (60 * 60 * 1000)) {
        await this.removeFromCache(cacheKey);
        return null;
      }
      
      this.cacheStats.hits++;
      this.cacheStats.total++;
      
      return cached;
    } catch (error) {
      // Cache miss or error
      this.cacheStats.misses++;
      this.cacheStats.total++;
      return null;
    }
  }
  
  /**
   * Add search result to cache
   * @param {string} cacheKey - Cache key
   * @param {Object} result - Search result
   */
  async addToCache(cacheKey, result) {
    if (!this.config.cacheEnabled) {
      return;
    }
    
    try {
      const cacheFile = path.join('./cache/search', `${cacheKey}.json`);
      await fs.writeFile(cacheFile, JSON.stringify(result, null, 2));
      
      this.logOperation('cached', { cacheKey: cacheKey.substring(0, 8) });
    } catch (error) {
      this.logger.warn('Failed to cache search result:', error.message);
    }
  }
  
  /**
   * Remove item from cache
   * @param {string} cacheKey - Cache key
   */
  async removeFromCache(cacheKey) {
    try {
      const cacheFile = path.join('./cache/search', `${cacheKey}.json`);
      await fs.unlink(cacheFile);
    } catch (error) {
      // Ignore errors when removing cache files
    }
  }
  
  /**
   * Search for domestic violence resources
   * @param {string} location - Location for search
   * @param {Object} options - Additional search options
   * @returns {Promise<Object>} Search results
   */
  async searchDomesticViolenceResources(location, options = {}) {
    const query = this.buildDvSearchQuery(location, options);
    
    return this.search(query, {
      maxResults: 10,
      searchDepth: 'advanced',
      ...options
    });
  }
  
  /**
   * Build search query for domestic violence resources
   * @param {string} location - Location
   * @param {Object} options - Search options
   * @returns {string} Search query
   */
  buildDvSearchQuery(location, options = {}) {
    let query = 'domestic violence';
    
    // Add resource type
    if (options.resourceType) {
      query += ` ${options.resourceType}`;
    } else {
      query += ' shelter resources help';
    }
    
    // Add location
    if (location) {
      query += ` ${location}`;
    }
    
    // Add specific requirements
    if (options.pets) {
      query += ' pet friendly';
    }
    
    if (options.children) {
      query += ' children families';
    }
    
    if (options.legal) {
      query += ' legal aid attorney';
    }
    
    if (options.counseling) {
      query += ' counseling therapy support';
    }
    
    return query;
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const hitRate = this.cacheStats.total > 0 
      ? (this.cacheStats.hits / this.cacheStats.total * 100).toFixed(2)
      : 0;
    
    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`
    };
  }
  
  /**
   * Clear search cache
   */
  async clearCache() {
    if (!this.config.cacheEnabled) {
      return;
    }
    
    try {
      const cacheDir = './cache/search';
      const files = await fs.readdir(cacheDir);
      const cacheFiles = files.filter(file => file.endsWith('.json'));
      
      await Promise.all(
        cacheFiles.map(file => 
          fs.unlink(path.join(cacheDir, file)).catch(() => {})
        )
      );
      
      this.cacheStats = { hits: 0, misses: 0, total: 0 };
      this.logOperation('cache cleared');
    } catch (error) {
      this.logger.warn('Failed to clear search cache:', error.message);
    }
  }
  
  /**
   * Check if search service is healthy
   * @returns {Promise<boolean>} Health status
   */
  async isHealthy() {
    try {
      // Test Tavily API connection
      const testQuery = 'test';
      await withTimeout(
        this.performTavilySearch(testQuery, { maxResults: 1 }),
        10000,
        'tavily-health-check'
      );
      
      return true;
    } catch (error) {
      this.logger.error('Search service health check failed:', error.message);
      return false;
    }
  }
  
  /**
   * Get search service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      apiKey: this.config.apiKey ? 'configured' : 'missing',
      maxResults: this.config.maxResults,
      searchDepth: this.config.searchDepth,
      cache: {
        enabled: this.config.cacheEnabled,
        stats: this.getCacheStats()
      }
    };
  }
} 