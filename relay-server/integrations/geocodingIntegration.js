import logger from '../lib/logger.js';
import { apiConfig } from '../lib/config/api.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Geocoding Integration
 * Abstracts geocoding API calls for location services
 * Currently supports Nominatim (OpenStreetMap) with extensibility for other providers
 */
export class GeocodingIntegration {
  constructor(config = {}) {
    this.config = {
      ...apiConfig.geocoding,
      ...config
    };
    this.provider = this.config.provider || 'nominatim';
    this.cache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      total: 0
    };
  }

  /**
   * Log Geocoding integration operation with consistent format
   * @param {string} operation - Operation being performed
   * @param {Object} data - Data to log
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} requestId - Optional request ID for tracking
   */
  logOperation(operation, data = {}, level = 'info', requestId = null) {
    const logData = {
      integration: 'Geocoding',
      operation,
      requestId: requestId || uuidv4(),
      timestamp: new Date().toISOString(),
      ...data
    };
    
    logger[level](`Geocoding Integration - ${operation}:`, logData);
  }

  /**
   * Geocode a location string
   * @param {string} location - Location string to geocode
   * @param {Object} options - Geocoding options
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<Object>} Geocoding result
   */
  async geocode(location, options = {}, requestId = null) {
    const operationId = requestId || uuidv4();
    
    try {
      this.logOperation('geocode.start', { 
        location, 
        provider: this.provider, 
        options 
      }, 'info', operationId);

      // Check cache first
      const cacheKey = this.generateCacheKey(location, options);
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.config.cacheTtl) {
        this.cacheStats.hits++;
        this.logOperation('geocode.cache.hit', { 
          location, 
          cacheKey 
        }, 'info', operationId);
        
        return {
          success: true,
          data: cached.data,
          cached: true,
          provider: this.provider
        };
      }

      this.cacheStats.misses++;
      this.cacheStats.total++;

      this.logOperation('geocode.cache.miss', { 
        location, 
        cacheKey 
      }, 'info', operationId);

      // Perform geocoding based on provider
      let result;
      switch (this.provider) {
        case 'nominatim':
          result = await this.geocodeWithNominatim(location, options, operationId);
          break;
        default:
          throw new Error(`Unsupported geocoding provider: ${this.provider}`);
      }

      if (result.success) {
        // Cache successful results
        this.cache.set(cacheKey, {
          data: result.data,
          timestamp: Date.now()
        });

        // Manage cache size
        if (this.cache.size > this.config.maxCacheSize) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }

        this.logOperation('geocode.cache.store', { 
          location, 
          cacheKey 
        }, 'info', operationId);
      }

      this.logOperation('geocode.completed', { 
        location, 
        success: result.success,
        provider: this.provider
      }, 'info', operationId);

      return result;

    } catch (error) {
      this.logOperation('geocode.error', { 
        location, 
        error: error.message,
        provider: this.provider
      }, 'error', operationId);
      
      logger.error('Geocoding error:', { 
        location, 
        error: error.message, 
        requestId: operationId 
      });
      
      return {
        success: false,
        error: error.message,
        provider: this.provider
      };
    }
  }

  /**
   * Geocode using Nominatim (OpenStreetMap)
   * @param {string} location - Location string
   * @param {Object} options - Geocoding options
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<Object>} Geocoding result
   */
  async geocodeWithNominatim(location, options = {}, requestId = null) {
    const operationId = requestId || uuidv4();
    
    try {
      this.logOperation('geocodeWithNominatim.start', { 
        location, 
        options 
      }, 'info', operationId);

      const encodedLocation = encodeURIComponent(location);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedLocation}&limit=1&addressdetails=1`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.config.timeout || 10000);

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'DomesticViolenceAssistant/1.0'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data || data.length === 0) {
          this.logOperation('geocodeWithNominatim.noResults', { 
            location 
          }, 'warn', operationId);
          
          return {
            success: false,
            error: 'No geocoding results found',
            provider: 'nominatim'
          };
        }

        const result = data[0];
        const geocodeData = {
          country: result.address?.country,
          countryCode: result.address?.country_code,
          state: result.address?.state,
          city: result.address?.city || result.address?.town,
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          displayName: result.display_name,
          placeId: result.place_id,
          osmType: result.osm_type,
          osmId: result.osm_id,
          importance: parseFloat(result.importance) || 0,
          confidence: parseFloat(result.importance) || 0 // Use importance as confidence score
        };

        this.logOperation('geocodeWithNominatim.success', { 
          location,
          hasCountry: !!geocodeData.country,
          hasState: !!geocodeData.state,
          hasCity: !!geocodeData.city,
          latitude: geocodeData.latitude,
          longitude: geocodeData.longitude,
          confidence: geocodeData.confidence
        }, 'info', operationId);

        return {
          success: true,
          data: geocodeData,
          provider: 'nominatim'
        };

      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          this.logOperation('geocodeWithNominatim.timeout', { 
            location,
            timeout: this.config.timeout || 10000
          }, 'error', operationId);
          
          throw new Error('Geocoding request timed out');
        }
        
        throw fetchError;
      }

    } catch (error) {
      this.logOperation('geocodeWithNominatim.error', { 
        location,
        error: error.message
      }, 'error', operationId);
      
      logger.error('Nominatim geocoding error:', {
        error: error.message,
        requestId: operationId
      });
      
      return {
        success: false,
        error: error.message,
        provider: 'nominatim'
      };
    }
  }

  /**
   * Get location coordinates
   * @param {string} location - Location string
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<Object>} Coordinates result
   */
  async getCoordinates(location, requestId = null) {
    const operationId = requestId || uuidv4();
    
    this.logOperation('getCoordinates.start', { location }, 'info', operationId);
    
    const result = await this.geocode(location, {}, operationId);
    
    if (!result.success) {
      this.logOperation('getCoordinates.error', { 
        location,
        error: result.error 
      }, 'error', operationId);
      
      return {
        success: false,
        error: result.error
      };
    }

    this.logOperation('getCoordinates.success', { 
      location,
      latitude: result.data.latitude,
      longitude: result.data.longitude
    }, 'info', operationId);

    return {
      success: true,
      latitude: result.data.latitude,
      longitude: result.data.longitude,
      location: result.data.displayName
    };
  }

  /**
   * Validate if a location string is complete
   * @param {string} location - Location string
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<Object>} Validation result
   */
  async validateLocation(location, requestId = null) {
    const operationId = requestId || uuidv4();
    
    this.logOperation('validateLocation.start', { location }, 'info', operationId);
    
    const result = await this.geocode(location, {}, operationId);
    
    if (!result.success) {
      this.logOperation('validateLocation.error', { 
        location,
        error: result.error 
      }, 'error', operationId);
      
      return {
        success: false,
        isValid: false,
        error: result.error
      };
    }

    const isComplete = !!(result.data.city || result.data.state || result.data.country);
    
    this.logOperation('validateLocation.success', { 
      location,
      isComplete,
      scope: isComplete ? 'complete' : 'incomplete'
    }, 'info', operationId);

    return {
      success: true,
      isValid: true,
      isComplete,
      scope: isComplete ? 'complete' : 'incomplete',
      data: result.data
    };
  }

  /**
   * Validate location with confidence threshold
   * @param {string} location - Location string
   * @param {number} confidenceThreshold - Minimum confidence score (0-1)
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<Object>} Validation result with confidence check
   */
  async validateLocationWithConfidence(location, confidenceThreshold = 0.5, requestId = null) {
    const operationId = requestId || uuidv4();
    
    this.logOperation('validateLocationWithConfidence.start', { 
      location, 
      confidenceThreshold 
    }, 'info', operationId);
    
    const result = await this.geocode(location, {}, operationId);
    
    if (!result.success) {
      this.logOperation('validateLocationWithConfidence.error', { 
        location,
        error: result.error 
      }, 'error', operationId);
      
      return {
        success: false,
        isValid: false,
        error: result.error
      };
    }

    const confidenceScore = result.data.confidence || 0;
    const hasSufficientConfidence = confidenceScore >= confidenceThreshold;
    const isComplete = !!(result.data.city || result.data.state || result.data.country);
    
    this.logOperation('validateLocationWithConfidence.result', { 
      location,
      confidenceScore,
      confidenceThreshold,
      hasSufficientConfidence,
      isComplete
    }, 'info', operationId);

    return {
      success: true,
      isValid: hasSufficientConfidence && isComplete,
      hasSufficientConfidence,
      isComplete,
      confidenceScore,
      confidenceThreshold,
      scope: isComplete ? 'complete' : 'incomplete',
      data: result.data
    };
  }

  /**
   * Generate cache key for location and options
   * @param {string} location - Location string
   * @param {Object} options - Options object
   * @returns {string} Cache key
   */
  generateCacheKey(location, options = {}) {
    const optionsStr = JSON.stringify(options);
    return `${location}:${optionsStr}`;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      ...this.cacheStats,
      size: this.cache.size,
      hitRate: this.cacheStats.total > 0 
        ? (this.cacheStats.hits / this.cacheStats.total * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    let cleared = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.config.cacheTtl) {
        this.cache.delete(key);
        cleared++;
      }
    }
    
    logger.info('Cleared expired cache entries:', { cleared });
  }

  /**
   * Clear all cache
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cleared all cache entries:', { size });
  }

  /**
   * Get integration status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      provider: this.provider,
      cacheStats: this.getCacheStats(),
      config: {
        timeout: this.config.timeout,
        cacheTtl: this.config.cacheTtl,
        maxCacheSize: this.config.maxCacheSize
      }
    };
  }
}

// Export singleton instance
export const geocodingIntegration = new GeocodingIntegration(); 