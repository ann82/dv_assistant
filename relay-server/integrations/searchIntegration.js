import logger from '../lib/logger.js';
import { v4 as uuidv4 } from 'uuid';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_SEARCH_DEPTH = process.env.TAVILY_SEARCH_DEPTH || 'advanced';
const TAVILY_SEARCH_TYPE = process.env.TAVILY_SEARCH_TYPE || 'basic';
const TAVILY_MAX_RESULTS = parseInt(process.env.TAVILY_MAX_RESULTS) || 5;
const TAVILY_TIMEOUT = parseInt(process.env.TAVILY_TIMEOUT) || 6000; // Reduced from 15000 to 6000ms for faster response

// Default domains for domestic violence shelter searches
const DEFAULT_INCLUDE_DOMAINS = [
  'domesticshelters.org',
  'womenshelters.org',
  'ncadv.org',
  'thehotline.org',
  'futureswithoutviolence.org',
  'endabuse.org',
  'womenslaw.org',
  '211.org',
  'findhelp.org'
];

const DEFAULT_EXCLUDE_DOMAINS = [
  'wikipedia.org',
  'reddit.com',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'youtube.com',
  'tiktok.com'
];

// Shelter-related keywords for filtering
const SHELTER_KEYWORDS = [
  'shelter', 'safe house', 'refuge', 'crisis center', 'emergency housing',
  'domestic violence', 'battered women', 'women\'s shelter', 'family shelter',
  'transitional housing', 'emergency shelter', 'crisis shelter', 'safe haven',
  'protective housing', 'emergency accommodation', 'crisis accommodation',
  'domestic abuse', 'family violence', 'intimate partner violence'
];

// Phone number patterns for content filtering
const PHONE_PATTERNS = [
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // 123-456-7890 or 123.456.7890
  /\b\(\d{3}\)\s*\d{3}[-.]?\d{4}\b/g, // (123) 456-7890
  /\b1[-.]?\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // 1-123-456-7890
  /\b\d{3}[-.]?\d{4}[-.]?\d{4}\b/g, // 123-4567-8901
  /\b\d{10}\b/g, // 1234567890
  /\b\d{11}\b/g // 11234567890
];

// Address patterns for content filtering
const ADDRESS_PATTERNS = [
  /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Way|Circle|Cir)\b/gi,
  /\b[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Way|Circle|Cir)\s+\d+\b/gi,
  /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Way|Circle|Cir)\s*,\s*[A-Za-z\s]+(?:,\s*[A-Z]{2}\s*\d{5})?\b/gi
];

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

/**
 * Filter results by score threshold
 * @param {Array} results - Array of search results
 * @param {number} minScore - Minimum score threshold (default: 0.6)
 * @returns {Array} Filtered results
 */
function filterByScore(results, minScore = 0.6) {
  if (!Array.isArray(results)) return [];
  
  const filtered = results.filter(result => {
    const score = parseFloat(result.score) || 0;
    return score >= minScore;
  });
  
  logger.info('Filtered results by score:', {
    originalCount: results.length,
    filteredCount: filtered.length,
    minScore,
    removedCount: results.length - filtered.length
  });
  
  return filtered;
}

/**
 * Filter results by shelter keywords in title or URL
 * @param {Array} results - Array of search results
 * @returns {Array} Filtered results
 */
function filterByShelterKeywords(results) {
  if (!Array.isArray(results)) return [];
  
  const filtered = results.filter(result => {
    const title = (result.title || '').toLowerCase();
    const url = (result.url || '').toLowerCase();
    const content = (result.content || '').toLowerCase();
    
    // Check if any shelter keyword is present in title, URL, or content
    return SHELTER_KEYWORDS.some(keyword => 
      title.includes(keyword.toLowerCase()) ||
      url.includes(keyword.toLowerCase()) ||
      content.includes(keyword.toLowerCase())
    );
  });
  
  logger.info('Filtered results by shelter keywords:', {
    originalCount: results.length,
    filteredCount: filtered.length,
    removedCount: results.length - filtered.length
  });
  
  return filtered;
}

/**
 * Extract phone numbers from content
 * @param {string} content - Content to search for phone numbers
 * @returns {Array} Array of found phone numbers
 */
function extractPhoneNumbers(content) {
  if (!content || typeof content !== 'string') return [];
  
  const phoneNumbers = new Set();
  
  PHONE_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => phoneNumbers.add(match));
    }
  });
  
  return Array.from(phoneNumbers);
}

/**
 * Extract addresses from content
 * @param {string} content - Content to search for addresses
 * @returns {Array} Array of found addresses
 */
function extractAddresses(content) {
  if (!content || typeof content !== 'string') return [];
  
  const addresses = new Set();
  
  ADDRESS_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => addresses.add(match));
    }
  });
  
  return Array.from(addresses);
}

/**
 * Filter and enhance results with contact information
 * @param {Array} results - Array of search results
 * @param {Object} options - Filtering options
 * @returns {Array} Filtered and enhanced results
 */
function filterAndEnhanceResults(results, options = {}) {
  if (!Array.isArray(results)) return [];
  
  const {
    minScore = 0.6,
    filterByKeywords = true,
    extractContactInfo = true
  } = options;
  
  let filtered = results;
  
  // Step 1: Filter by score
  if (minScore > 0) {
    filtered = filterByScore(filtered, minScore);
  }
  
  // Step 2: Filter by shelter keywords
  if (filterByKeywords) {
    filtered = filterByShelterKeywords(filtered);
  }
  
  // Step 3: Extract contact information
  if (extractContactInfo) {
    filtered = filtered.map(result => {
      const content = result.content || result.raw_content || '';
      const phoneNumbers = extractPhoneNumbers(content);
      const addresses = extractAddresses(content);
      
      return {
        ...result,
        extracted_phone_numbers: phoneNumbers,
        extracted_addresses: addresses,
        has_contact_info: phoneNumbers.length > 0 || addresses.length > 0
      };
    });
  }
  
  logger.info('Filtered and enhanced results:', {
    originalCount: results.length,
    finalCount: filtered.length,
    removedCount: results.length - filtered.length,
    withContactInfo: filtered.filter(r => r.has_contact_info).length
  });
  
  return filtered;
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

      // Enhanced search options with better defaults for domestic violence searches
      const searchOptions = {
        api_key: TAVILY_API_KEY,
        query,
        search_depth: options.searchDepth || TAVILY_SEARCH_DEPTH,
        include_answer: options.includeAnswer !== false, // Default to true
        include_results: options.includeResults !== false, // Default to true
        include_raw_content: options.includeRawContent !== false,
        max_results: options.maxResults || TAVILY_MAX_RESULTS,
        include_domains: options.includeDomains || DEFAULT_INCLUDE_DOMAINS,
        exclude_domains: options.excludeDomains || DEFAULT_EXCLUDE_DOMAINS,
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
        
        // Filter and enhance results
        const filteredResults = filterAndEnhanceResults(data.results || [], {
          minScore: options.minScore || 0.6,
          filterByKeywords: options.filterByKeywords !== false,
          extractContactInfo: options.extractContactInfo !== false
        });
        
        logSearchOperation('search.success', {
          queryLength: query.length,
          originalResultCount: data.results?.length || 0,
          filteredResultCount: filteredResults.length,
          hasAnswer: !!data.answer,
          searchDepth: searchOptions.search_depth,
          maxResults: searchOptions.max_results,
          includeDomains: searchOptions.include_domains?.length || 0,
          excludeDomains: searchOptions.exclude_domains?.length || 0,
          withContactInfo: filteredResults.filter(r => r.has_contact_info).length,
          responseTime: Date.now() - (operationId ? parseInt(operationId.split('-')[0], 16) : Date.now())
        }, 'info', operationId);

        return {
          success: true,
          data: {
            results: filteredResults,
            answer: data.answer,
            query,
            searchDepth: searchOptions.search_depth,
            maxResults: searchOptions.max_results,
            includeDomains: searchOptions.include_domains,
            excludeDomains: searchOptions.exclude_domains,
            filteringApplied: {
              minScore: options.minScore || 0.6,
              filterByKeywords: options.filterByKeywords !== false,
              extractContactInfo: options.extractContactInfo !== false
            }
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
   * Perform a specialized domestic violence shelter search with optimized parameters
   * @param {string} location - Location to search in
   * @param {Object} filters - Additional filters
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<Object>} Search results
   */
  async searchDvShelters(location, filters = {}, requestId = null) {
    const operationId = requestId || uuidv4();
    
    try {
      logSearchOperation('searchDvShelters.start', { 
        location, 
        filters 
      }, 'info', operationId);

      const query = this.buildDvSearchQuery(location, filters, operationId);
      
      // Use optimized parameters for domestic violence shelter searches
      const searchOptions = {
        searchDepth: 'advanced',
        includeAnswer: true,
        includeResults: true,
        includeRawContent: false,
        maxResults: 5,
        includeDomains: DEFAULT_INCLUDE_DOMAINS,
        excludeDomains: DEFAULT_EXCLUDE_DOMAINS,
        minScore: 0.6,
        filterByKeywords: true,
        extractContactInfo: true
      };

      const result = await this.search(query, searchOptions, operationId);
      
      logSearchOperation('searchDvShelters.success', { 
        location,
        filters,
        resultCount: result.data?.results?.length || 0,
        hasAnswer: !!result.data?.answer,
        withContactInfo: result.data?.results?.filter(r => r.has_contact_info).length || 0
      }, 'info', operationId);

      return result;

    } catch (error) {
      logSearchOperation('searchDvShelters.error', { 
        location,
        filters,
        error: error.message 
      }, 'error', operationId);
      
      return {
        success: false,
        error: error.message,
        data: {
          results: [],
          answer: null,
          query: `domestic violence shelters ${location}`
        }
      };
    }
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
      defaultIncludeDomains: DEFAULT_INCLUDE_DOMAINS,
      defaultExcludeDomains: DEFAULT_EXCLUDE_DOMAINS,
      shelterKeywords: SHELTER_KEYWORDS,
      phonePatterns: PHONE_PATTERNS.length,
      addressPatterns: ADDRESS_PATTERNS.length,
      timestamp: new Date().toISOString()
    };
  }
}; 