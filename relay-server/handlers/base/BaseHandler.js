import logger from '../../lib/logger.js';

/**
 * Base handler class that provides common functionality for all handlers
 * Includes service injection, error handling, and request processing patterns
 */
export class BaseHandler {
  constructor(services = {}, handlerName = 'BaseHandler') {
    this.services = services;
    this.handlerName = handlerName;
    this.logger = logger;
    
    // Validate required services
    this.validateServices();
  }
  
  /**
   * Validate that required services are available
   * @throws {Error} If required services are missing
   */
  validateServices() {
    const requiredServices = this.getRequiredServices();
    
    for (const serviceName of requiredServices) {
      if (!this.services[serviceName]) {
        throw new Error(`${this.handlerName}: Required service '${serviceName}' is missing`);
      }
    }
    
    this.logger.info(`${this.handlerName}: All required services validated`);
  }
  
  /**
   * Get list of required services for this handler
   * Subclasses should override this method
   * @returns {string[]} Array of required service names
   */
  getRequiredServices() {
    return [];
  }
  
  /**
   * Common request processing pattern
   * @param {Object} request - The request object
   * @param {string} operation - Operation being performed
   * @param {Function} processor - Function to process the request
   * @returns {Promise<Object>} Processing result
   */
  async processRequest(request, operation, processor) {
    const requestId = this.generateRequestId();
    
    try {
      this.logOperation(operation, { requestId, request: this.sanitizeRequest(request) });
      
      // Validate request
      await this.validateRequest(request);
      
      // Process request
      const result = await processor(request);
      
      this.logOperation(`${operation} completed`, { requestId, success: true });
      
      return this.createSuccessResponse(result, { requestId });
      
    } catch (error) {
      const errorResult = await this.handleError(error, operation, { requestId, request });
      this.logOperation(`${operation} failed`, { requestId, error: error.message });
      return errorResult;
    }
  }
  
  /**
   * Validate incoming request
   * @param {Object} request - Request to validate
   * @throws {Error} If request is invalid
   */
  async validateRequest(request) {
    if (!request) {
      throw new Error('Request is required');
    }
    
    // Subclasses can override this method to add specific validation
  }
  
  /**
   * Sanitize request for logging (remove sensitive data)
   * @param {Object} request - Request to sanitize
   * @returns {Object} Sanitized request
   */
  sanitizeRequest(request) {
    if (!request) return null;
    // Only log safe fields
    return {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      params: request.params,
      query: request.query,
    };
  }
  
  /**
   * Centralized error handling for all handlers
   * @param {Error} error - The error that occurred
   * @param {string} context - Context where the error occurred
   * @param {Object} additionalData - Additional data to log
   * @returns {Object} Standardized error response
   */
  async handleError(error, context, additionalData = {}) {
    const errorContext = {
      handler: this.handlerName,
      context,
      error: error.message,
      stack: error.stack,
      ...additionalData
    };
    
    this.logger.error(`Error in ${this.handlerName}:`, errorContext);
    
    return {
      success: false,
      error: error.message,
      context: errorContext,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Log handler operation with consistent format
   * @param {string} operation - Operation being performed
   * @param {Object} data - Data to log
   * @param {string} level - Log level (info, warn, error, debug)
   */
  logOperation(operation, data = {}, level = 'info') {
    const logData = {
      handler: this.handlerName,
      operation,
      timestamp: new Date().toISOString(),
      ...data
    };
    
    this.logger[level](`${this.handlerName} - ${operation}:`, logData);
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
   * Generate a unique request ID
   * @returns {string} Unique request ID
   */
  generateRequestId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  
  /**
   * Get a service by name
   * @param {string} serviceName - Name of the service to get
   * @returns {Object} Service instance
   * @throws {Error} If service is not found
   */
  getService(serviceName) {
    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`${this.handlerName}: Service '${serviceName}' not found`);
    }
    return service;
  }
  
  /**
   * Check if handler is healthy/ready
   * @returns {boolean} Handler health status
   */
  async isHealthy() {
    try {
      // Check if all required services are healthy
      const requiredServices = this.getRequiredServices();
      
      for (const serviceName of requiredServices) {
        const service = this.getService(serviceName);
        if (service.isHealthy && !(await service.isHealthy())) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error(`${this.handlerName}: Health check failed:`, error);
      return false;
    }
  }
} 