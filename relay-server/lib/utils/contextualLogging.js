import logger from '../logger.js';
import { v4 as uuidv4 } from 'uuid';
import { redactLogData, redactRequest, redactError } from './sensitiveDataRedaction.js';

/**
 * Contextual Logging Utility
 * Provides consistent contextual metadata for all logging operations
 */

// Global context store for request-scoped data
const contextStore = new Map();

/**
 * Initialize request context
 * @param {Object} req - Express request object
 * @param {Object} additionalContext - Additional context data
 * @returns {Object} Request context
 */
export function initializeRequestContext(req, additionalContext = {}) {
  const requestId = req.headers['x-request-id'] || req.id || uuidv4();
  
  const context = {
    requestId,
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection?.remoteAddress,
    timestamp: new Date().toISOString(),
    // Twilio-specific context
    callSid: req.body?.CallSid,
    from: req.body?.From,
    to: req.body?.To,
    // Web-specific context
    sessionId: req.headers['x-session-id'],
    userId: req.headers['x-user-id'],
    // Additional context
    ...additionalContext
  };
  
  // Store context for this request
  contextStore.set(requestId, context);
  
  // Add to request object for middleware access
  req.requestContext = context;
  req.id = requestId;
  
  return context;
}

/**
 * Get current request context
 * @param {string} requestId - Optional request ID
 * @returns {Object} Current context or empty object
 */
export function getCurrentContext(requestId = null) {
  if (requestId && contextStore.has(requestId)) {
    return contextStore.get(requestId);
  }
  
  // Try to get from current request if available
  // This is a fallback for when requestId is not explicitly provided
  return {};
}

/**
 * Log with contextual metadata
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 * @param {string} requestId - Optional request ID for context
 * @param {Object} additionalContext - Additional context to include
 */
export function logWithContext(level, message, data = {}, requestId = null, additionalContext = {}) {
  const context = getCurrentContext(requestId);
  
  const logData = {
    ...context,
    ...additionalContext,
    ...data,
    timestamp: new Date().toISOString()
  };
  
  // Redact sensitive data before logging
  const redactedData = redactLogData(logData);
  
  logger[level](message, redactedData);
}

/**
 * Log operation start with context
 * @param {string} operation - Operation name
 * @param {Object} data - Operation data
 * @param {string} requestId - Optional request ID
 * @param {Object} additionalContext - Additional context
 */
export function logOperationStart(operation, data = {}, requestId = null, additionalContext = {}) {
  logWithContext('info', `${operation} started`, {
    operation,
    ...data
  }, requestId, additionalContext);
}

/**
 * Log operation success with context
 * @param {string} operation - Operation name
 * @param {Object} data - Operation data
 * @param {string} requestId - Optional request ID
 * @param {Object} additionalContext - Additional context
 */
export function logOperationSuccess(operation, data = {}, requestId = null, additionalContext = {}) {
  logWithContext('info', `${operation} completed successfully`, {
    operation,
    success: true,
    ...data
  }, requestId, additionalContext);
}

/**
 * Log operation error with context
 * @param {string} operation - Operation name
 * @param {Error} error - Error object
 * @param {Object} data - Additional error data
 * @param {string} requestId - Optional request ID
 * @param {Object} additionalContext - Additional context
 */
export function logOperationError(operation, error, data = {}, requestId = null, additionalContext = {}) {
  const context = getCurrentContext(requestId);
  
  const logData = {
    ...context,
    ...additionalContext,
    operation,
    error: error.message,
    errorName: error.name,
    errorCode: error.code,
    errorStack: error.stack,
    ...data,
    timestamp: new Date().toISOString()
  };
  
  // Redact sensitive data before logging
  const redactedData = redactLogData(logData);
  
  logger.error(`${operation} failed`, redactedData);
}

/**
 * Log API endpoint access with context
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {Object} data - Endpoint data
 * @param {string} requestId - Optional request ID
 * @param {Object} additionalContext - Additional context
 */
export function logApiEndpoint(endpoint, method, data = {}, requestId = null, additionalContext = {}) {
  logWithContext('info', `API ${method} ${endpoint}`, {
    endpoint,
    method: method,
    ...data
  }, requestId, additionalContext);
}

/**
 * Log integration operation with context
 * @param {string} integration - Integration name
 * @param {string} operation - Operation name
 * @param {Object} data - Operation data
 * @param {string} requestId - Optional request ID
 * @param {Object} additionalContext - Additional context
 */
export function logIntegrationOperation(integration, operation, data = {}, requestId = null, additionalContext = {}) {
  logWithContext('info', `${integration} integration - ${operation}`, {
    integration,
    operation,
    ...data
  }, requestId, additionalContext);
}

/**
 * Log performance metrics with context
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 * @param {Object} data - Additional performance data
 * @param {string} requestId - Optional request ID
 * @param {Object} additionalContext - Additional context
 */
export function logPerformance(operation, duration, data = {}, requestId = null, additionalContext = {}) {
  const level = duration > 1000 ? 'warn' : 'info';
  
  logWithContext(level, `${operation} performance`, {
    operation,
    duration: `${duration}ms`,
    durationMs: duration,
    ...data
  }, requestId, additionalContext);
}

/**
 * Log security event with context
 * @param {string} event - Security event type
 * @param {Object} data - Event data
 * @param {string} requestId - Optional request ID
 * @param {Object} additionalContext - Additional context
 */
export function logSecurityEvent(event, data = {}, requestId = null, additionalContext = {}) {
  logWithContext('warn', `Security event: ${event}`, {
    securityEvent: event,
    ...data
  }, requestId, additionalContext);
}

/**
 * Clear request context
 * @param {string} requestId - Request ID to clear
 */
export function clearRequestContext(requestId) {
  if (requestId && contextStore.has(requestId)) {
    contextStore.delete(requestId);
  }
}

/**
 * Create a contextual logger for a specific component
 * @param {string} component - Component name
 * @returns {Object} Component-specific logger
 */
export function createComponentLogger(component) {
  return {
    info: (message, data = {}, requestId = null, additionalContext = {}) => {
      logWithContext('info', message, {
        component,
        ...data
      }, requestId, additionalContext);
    },
    
    warn: (message, data = {}, requestId = null, additionalContext = {}) => {
      logWithContext('warn', message, {
        component,
        ...data
      }, requestId, additionalContext);
    },
    
    error: (message, data = {}, requestId = null, additionalContext = {}) => {
      logWithContext('error', message, {
        component,
        ...data
      }, requestId, additionalContext);
    },
    
    debug: (message, data = {}, requestId = null, additionalContext = {}) => {
      logWithContext('debug', message, {
        component,
        ...data
      }, requestId, additionalContext);
    },
    
    operationStart: (operation, data = {}, requestId = null, additionalContext = {}) => {
      logOperationStart(operation, {
        component,
        ...data
      }, requestId, additionalContext);
    },
    
    operationSuccess: (operation, data = {}, requestId = null, additionalContext = {}) => {
      logOperationSuccess(operation, {
        component,
        ...data
      }, requestId, additionalContext);
    },
    
    operationError: (operation, error, data = {}, requestId = null, additionalContext = {}) => {
      logOperationError(operation, error, {
        component,
        ...data
      }, requestId, additionalContext);
    }
  };
}

/**
 * Middleware to ensure request context is available
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
export function ensureRequestContext(req, res, next) {
  if (!req.requestContext) {
    initializeRequestContext(req);
  }
  next();
}

/**
 * Get context summary for logging
 * @param {string} requestId - Request ID
 * @returns {Object} Context summary
 */
export function getContextSummary(requestId) {
  const context = getCurrentContext(requestId);
  
  return {
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    callSid: context.callSid,
    from: context.from,
    to: context.to,
    sessionId: context.sessionId,
    userId: context.userId,
    timestamp: context.timestamp
  };
} 