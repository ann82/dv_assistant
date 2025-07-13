/**
 * Error Handling Utilities
 * Common error handling functions used throughout the application
 */

import logger from '../logger.js';

/**
 * Custom error classes for different types of errors
 */
export class ValidationError extends Error {
  constructor(message, field = null, value = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.timestamp = new Date().toISOString();
  }
}

export class ApiError extends Error {
  constructor(message, statusCode = 500, endpoint = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.timestamp = new Date().toISOString();
  }
}

export class TimeoutError extends Error {
  constructor(message, timeout = null, operation = null) {
    super(message);
    this.name = 'TimeoutError';
    this.timeout = timeout;
    this.operation = operation;
    this.timestamp = new Date().toISOString();
  }
}

export class ConfigurationError extends Error {
  constructor(message, configKey = null) {
    super(message);
    this.name = 'ConfigurationError';
    this.configKey = configKey;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Wrap async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error logging
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, context = 'unknown') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      await handleError(error, context, { args });
      throw error;
    }
  };
}

/**
 * Handle error with consistent logging and formatting
 * @param {Error} error - Error to handle
 * @param {string} context - Context where error occurred
 * @param {Object} additionalData - Additional data to log
 * @returns {Object} Standardized error response
 */
export async function handleError(error, context, additionalData = {}) {
  const errorInfo = {
    name: error.name || 'Error',
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    ...additionalData
  };
  
  // Log error with appropriate level
  if (error.name === 'ValidationError') {
    logger.warn(`Validation error in ${context}:`, errorInfo);
  } else if (error.name === 'TimeoutError') {
    logger.warn(`Timeout error in ${context}:`, errorInfo);
  } else if (error.name === 'ApiError') {
    logger.error(`API error in ${context}:`, errorInfo);
  } else {
    logger.error(`Unexpected error in ${context}:`, errorInfo);
  }
  
  return {
    success: false,
    error: error.message,
    errorType: error.name,
    context: errorInfo,
    timestamp: errorInfo.timestamp
  };
}

/**
 * Create a standardized error response for HTTP requests
 * @param {Error} error - Error that occurred
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Express response
 */
export function createErrorResponse(error, req, res) {
  const errorInfo = {
    name: error.name || 'Error',
    message: error.message,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown'
  };
  
  // Determine status code based on error type
  let statusCode = 500;
  if (error.name === 'ValidationError') {
    statusCode = 400;
  } else if (error.name === 'ApiError') {
    statusCode = error.statusCode || 500;
  } else if (error.name === 'TimeoutError') {
    statusCode = 408;
  } else if (error.name === 'ConfigurationError') {
    statusCode = 500;
  }
  
  // Log error
  logger.error(`HTTP ${statusCode} error:`, errorInfo);
  
  // Create response
  const response = {
    success: false,
    error: error.message,
    errorType: error.name,
    timestamp: errorInfo.timestamp,
    requestId: errorInfo.requestId
  };
  
  // Add additional error details in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
    response.context = errorInfo;
  }
  
  return res.status(statusCode).json(response);
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Function result
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryCondition = null
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (retryCondition && !retryCondition(error)) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay);
      
      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms:`, {
        error: error.message,
        delay,
        attempt: attempt + 1
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Create a timeout promise
 * @param {Promise} promise - Promise to timeout
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operation - Operation name for error message
 * @returns {Promise<any>} Promise with timeout
 */
export function withTimeout(promise, timeoutMs, operation = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(
          `${operation} timed out after ${timeoutMs}ms`,
          timeoutMs,
          operation
        ));
      }, timeoutMs);
    })
  ]);
}

/**
 * Validate error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean} Whether error is retryable
 */
export function isRetryableError(error) {
  // Network errors are usually retryable
  if (error.code === 'ECONNRESET' || 
      error.code === 'ECONNREFUSED' || 
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT') {
    return true;
  }
  
  // HTTP 5xx errors are retryable
  if (error.statusCode && error.statusCode >= 500 && error.statusCode < 600) {
    return true;
  }
  
  // Rate limiting errors are retryable
  if (error.statusCode === 429) {
    return true;
  }
  
  // Timeout errors are retryable
  if (error.name === 'TimeoutError') {
    return true;
  }
  
  return false;
}

/**
 * Create error from API response
 * @param {Object} response - API response object
 * @param {string} endpoint - API endpoint
 * @returns {ApiError} API error
 */
export function createApiErrorFromResponse(response, endpoint) {
  const statusCode = response.status || response.statusCode || 500;
  const message = response.data?.error || response.message || `API request failed with status ${statusCode}`;
  
  return new ApiError(message, statusCode, endpoint);
}

/**
 * Handle promise rejection
 * @param {Promise} promise - Promise to handle
 * @param {string} context - Context for error logging
 * @returns {Promise<Object>} Promise result or error
 */
export async function handlePromiseRejection(promise, context) {
  try {
    const result = await promise;
    return { success: true, data: result };
  } catch (error) {
    const errorResult = await handleError(error, context);
    return errorResult;
  }
} 