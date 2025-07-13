import logger from '../../lib/logger.js';

/**
 * Base service class that provides common functionality for all services
 * Includes error handling, logging, and configuration validation
 */
export class BaseService {
  constructor(config = {}, serviceName = 'BaseService') {
    this.config = config;
    this.serviceName = serviceName;
    this.logger = logger;
    
    // Validate configuration on initialization
    this.validateConfig();
  }
  
  /**
   * Centralized error handling for all services
   * @param {Error} error - The error that occurred
   * @param {string} context - Context where the error occurred
   * @param {Object} additionalData - Additional data to log
   * @returns {Object} Standardized error response
   */
  async handleError(error, context, additionalData = {}) {
    const errorContext = {
      service: this.serviceName,
      context,
      error: error.message,
      stack: error.stack,
      ...additionalData
    };
    
    this.logger.error(`Error in ${this.serviceName}:`, errorContext);
    
    return {
      success: false,
      error: error.message,
      context: errorContext,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Validate service configuration
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    if (!this.config) {
      throw new Error(`${this.serviceName}: Configuration is required`);
    }
    
    // Subclasses can override this method to add specific validation
    this.logger.info(`${this.serviceName}: Configuration validated successfully`);
  }
  
  /**
   * Log service operation with consistent format
   * @param {string} operation - Operation being performed
   * @param {Object} data - Data to log
   * @param {string} level - Log level (info, warn, error, debug)
   */
  logOperation(operation, data = {}, level = 'info') {
    const logData = {
      service: this.serviceName,
      operation,
      timestamp: new Date().toISOString(),
      ...data
    };
    
    this.logger[level](`${this.serviceName} - ${operation}:`, logData);
  }
  
  /**
   * Create a standardized success response
   * @param {any} data - Response data
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Standardized success response
   */
  createSuccessResponse(data, metadata = {}) {
    return {
      success: true,
      data,
      metadata,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Check if service is healthy/ready
   * @returns {boolean} Service health status
   */
  async isHealthy() {
    try {
      // Subclasses can override this method to add specific health checks
      return true;
    } catch (error) {
      this.logger.error(`${this.serviceName}: Health check failed:`, error);
      return false;
    }
  }
  
  /**
   * Initialize service (called after construction)
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.logOperation('initializing');
      // Subclasses can override this method to add initialization logic
      this.logOperation('initialized');
    } catch (error) {
      await this.handleError(error, 'initialize');
      throw error;
    }
  }
  
  /**
   * Process a request with standardized error handling and logging
   * @param {any} requestData - Request data
   * @param {string} operation - Operation name for logging
   * @param {Function} handler - Async function to handle the request
   * @returns {Promise<Object>} Standardized response
   */
  async processRequest(requestData, operation, handler) {
    try {
      this.logOperation(`${operation} started`, { requestData });
      
      const result = await handler(requestData);
      
      this.logOperation(`${operation} completed`, { 
        success: true,
        resultType: typeof result 
      });
      
      return this.createSuccessResponse(result);
    } catch (error) {
      const errorResponse = await this.handleError(error, operation, { requestData });
      this.logOperation(`${operation} failed`, { 
        error: error.message,
        success: false 
      });
      return errorResponse;
    }
  }
  
  /**
   * Cleanup service resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      this.logOperation('cleaning up');
      // Subclasses can override this method to add cleanup logic
      this.logOperation('cleanup completed');
    } catch (error) {
      await this.handleError(error, 'cleanup');
    }
  }
} 