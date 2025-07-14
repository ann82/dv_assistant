import logger from '../lib/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { 
  initializeRequestContext, 
  logWithContext, 
  logOperationStart, 
  logOperationSuccess, 
  logOperationError,
  logPerformance,
  clearRequestContext
} from '../lib/utils/contextualLogging.js';
import { redactRequest, redactResponse, redactError } from '../lib/utils/sensitiveDataRedaction.js';

/**
 * Sensitive data patterns to redact from logs
 */
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{48}/g, // OpenAI API keys
  /AC[a-zA-Z0-9]{32}/g, // Twilio Account SID
  /[a-zA-Z0-9]{32}/g, // Generic 32-char tokens
  /password["\s]*[:=]["\s]*[^"\s,}]+/gi, // Password fields
  /token["\s]*[:=]["\s]*[^"\s,}]+/gi, // Token fields
  /apiKey["\s]*[:=]["\s]*[^"\s,}]+/gi, // API key fields
  /authToken["\s]*[:=]["\s]*[^"\s,}]+/gi, // Auth token fields
  /TWILIO_AUTH_TOKEN["\s]*[:=]["\s]*[^"\s,}]+/gi, // Twilio auth token
  /OPENAI_API_KEY["\s]*[:=]["\s]*[^"\s,}]+/gi, // OpenAI API key
  /TAVILY_API_KEY["\s]*[:=]["\s]*[^"\s,}]+/gi // Tavily API key
];

/**
 * Redact sensitive data from log objects
 * @param {any} data - Data to redact
 * @returns {any} Redacted data
 */
export function redactSensitiveData(data) {
  if (typeof data === 'string') {
    let redacted = data;
    SENSITIVE_PATTERNS.forEach(pattern => {
      redacted = redacted.replace(pattern, '[REDACTED]');
    });
    return redacted;
  }
  
  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map(item => redactSensitiveData(item));
    }
    
    const redacted = {};
    for (const [key, value] of Object.entries(data)) {
      redacted[key] = redactSensitiveData(value);
    }
    return redacted;
  }
  
  return data;
}

/**
 * Generate request context with metadata
 * @param {Object} req - Express request object
 * @returns {Object} Request context
 */
function generateRequestContext(req) {
  return initializeRequestContext(req);
}

/**
 * Enhanced request logging middleware
 * Logs incoming requests with full context and redacted sensitive data
 */
export function enhancedRequestLogger(req, res, next) {
  const startTime = Date.now();
  const context = generateRequestContext(req);
  
  // Add requestId to response headers for client tracking
  res.set('X-Request-ID', context.requestId);
  
  // Store context and timing in request object for use in other middleware
  req.requestContext = context;
  req.requestStartTime = startTime;
  
  // Log incoming request with redacted data
  const redactedRequest = redactRequest(req);
  const logData = {
    ...context,
    ...redactedRequest
  };
  
  logWithContext('info', 'Incoming request', logData, context.requestId);
  
  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Handle TwiML objects that have circular references
    let responseSize = 0;
    if (typeof data === 'string') {
      responseSize = data.length;
    } else if (data && typeof data === 'object') {
      // Check if it's a TwiML object (has toString method and _propertyName)
      if (data.toString && typeof data.toString === 'function' && data._propertyName) {
        try {
          responseSize = data.toString().length;
        } catch (error) {
          responseSize = '[TwiML object - size unknown]';
        }
      } else {
        try {
          responseSize = JSON.stringify(data).length;
        } catch (error) {
          responseSize = '[Circular object - size unknown]';
        }
      }
    }
    
    const responseData = {
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      responseSize
    };
    
    // Log successful responses (not errors)
    if (res.statusCode < 400) {
      logOperationSuccess('Request processing', responseData, context.requestId);
    }
    
    // If it's a TwiML object, convert it to string before calling originalJson
    if (data && typeof data === 'object' && data.toString && typeof data.toString === 'function' && data._propertyName) {
      try {
        const twimlString = data.toString();
        return originalJson.call(this, { twiml: twimlString, _twimlObject: true });
      } catch (error) {
        return originalJson.call(this, { error: 'Failed to convert TwiML object to string', _twimlObject: true });
      }
    }
    
    return originalJson.call(this, data);
  };
  
  // Override res.send for non-JSON responses (like TwiML)
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Handle TwiML objects that have circular references
    let responseSize = 0;
    if (typeof data === 'string') {
      responseSize = data.length;
    } else if (data && typeof data === 'object') {
      // Check if it's a TwiML object (has toString method and _propertyName)
      if (data.toString && typeof data.toString === 'function' && data._propertyName) {
        try {
          responseSize = data.toString().length;
        } catch (error) {
          responseSize = '[TwiML object - size unknown]';
        }
      } else {
        try {
          responseSize = JSON.stringify(data).length;
        } catch (error) {
          responseSize = '[Circular object - size unknown]';
        }
      }
    }
    
    const responseData = {
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      responseSize,
      contentType: res.get('Content-Type')
    };
    
    // Log successful responses (not errors)
    if (res.statusCode < 400) {
      logOperationSuccess('Request processing', responseData, context.requestId);
    }
    
    return originalSend.call(this, data);
  };
  
  // Log when response finishes (for all response types)
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const responseData = {
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`
    };
    
    // Log based on status code
    if (res.statusCode >= 500) {
      logOperationError('Request processing', new Error(`HTTP ${res.statusCode}`), responseData, context.requestId);
    } else if (res.statusCode >= 400) {
      logWithContext('warn', 'Request failed with client error', responseData, context.requestId);
    }
    
    // Clear request context after response
    clearRequestContext(context.requestId);
  });
  
  next();
}

/**
 * Enhanced error logging middleware
 * Logs errors with full context and request information
 */
export function enhancedErrorLogger(err, req, res, next) {
  const context = req.requestContext || generateRequestContext(req);
  const responseTime = req.requestStartTime ? Date.now() - req.requestStartTime : 0;
  
  const errorData = {
    responseTime: `${responseTime}ms`
  };
  
  // Log error with appropriate level and redacted data
  logOperationError('Request processing', err, errorData, context.requestId);
  
  next(err);
}

/**
 * Controller-specific logging helper
 * Provides consistent logging for controller operations
 */
export function logControllerOperation(operation, data = {}, level = 'info', requestId = null) {
  const logData = redactSensitiveData(data);
  
  logWithContext(level, `Controller operation: ${operation}`, {
    operation,
    ...logData
  }, requestId);
}

/**
 * API endpoint logging helper
 * Provides consistent logging for API endpoints
 */
export function logApiEndpoint(endpoint, method, data = {}, level = 'info', requestId = null) {
  const logData = redactSensitiveData(data);
  
  logWithContext(level, `API ${method} ${endpoint}`, {
    endpoint,
    method,
    ...logData
  }, requestId);
}

/**
 * Performance logging middleware
 * Logs slow requests for performance monitoring
 */
export function performanceLogger(threshold = 1000) {
  return (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      if (duration > threshold) {
        const context = req.requestContext || generateRequestContext(req);
        logPerformance('Request processing', duration, {
          threshold: `${threshold}ms`
        }, context.requestId);
      }
    });
    
    next();
  };
}

/**
 * Health check logging middleware
 * Skips detailed logging for health check endpoints
 */
export function skipHealthCheckLogging(req, res, next) {
  if (req.path === '/health' || req.path === '/metrics') {
    // Skip detailed logging for health checks
    return next();
  }
  
  // Apply enhanced logging for all other requests
  return enhancedRequestLogger(req, res, next);
} 