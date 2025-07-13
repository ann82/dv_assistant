import logger from '../lib/logger.js';

// Validation schemas for different request types
const validationSchemas = {
  // Twilio voice call validation
  twilioVoice: {
    required: ['CallSid'],
    optional: ['From', 'To', 'SpeechResult', 'CallStatus'],
    validate: (body) => {
      const errors = [];
      
      if (!body.CallSid) {
        errors.push('CallSid is required');
      }
      
      if (body.CallSid && typeof body.CallSid !== 'string') {
        errors.push('CallSid must be a string');
      }
      
      if (body.SpeechResult && typeof body.SpeechResult !== 'string') {
        errors.push('SpeechResult must be a string');
      }
      
      return errors;
    }
  },
  
  // Twilio SMS validation
  twilioSMS: {
    required: ['From', 'Body'],
    optional: ['To', 'MessageSid'],
    validate: (body) => {
      const errors = [];
      
      if (!body.From) {
        errors.push('From is required');
      }
      
      if (!body.Body) {
        errors.push('Body is required');
      }
      
      if (body.From && typeof body.From !== 'string') {
        errors.push('From must be a string');
      }
      
      if (body.Body && typeof body.Body !== 'string') {
        errors.push('Body must be a string');
      }
      
      return errors;
    }
  },
  
  // Web speech processing validation
  webSpeech: {
    required: ['speechResult'],
    optional: ['requestId', 'callSid'],
    validate: (body) => {
      const errors = [];
      
      if (!body.speechResult) {
        errors.push('speechResult is required');
      }
      
      if (body.speechResult && typeof body.speechResult !== 'string') {
        errors.push('speechResult must be a string');
      }
      
      if (body.speechResult && body.speechResult.trim().length === 0) {
        errors.push('speechResult cannot be empty');
      }
      
      return errors;
    }
  },
  
  // Call status validation
  callStatus: {
    required: ['CallSid', 'CallStatus'],
    optional: ['CallDuration', 'RecordingUrl'],
    validate: (body) => {
      const errors = [];
      
      if (!body.CallSid) {
        errors.push('CallSid is required');
      }
      
      if (!body.CallStatus) {
        errors.push('CallStatus is required');
      }
      
      const validStatuses = ['initiated', 'ringing', 'answered', 'completed', 'busy', 'failed', 'no-answer'];
      if (body.CallStatus && !validStatuses.includes(body.CallStatus)) {
        errors.push(`CallStatus must be one of: ${validStatuses.join(', ')}`);
      }
      
      return errors;
    }
  },
  
  // Recording validation
  recording: {
    required: ['RecordingSid', 'RecordingUrl', 'CallSid'],
    optional: ['RecordingDuration', 'RecordingChannels'],
    validate: (body) => {
      const errors = [];
      
      if (!body.RecordingSid) {
        errors.push('RecordingSid is required');
      }
      
      if (!body.RecordingUrl) {
        errors.push('RecordingUrl is required');
      }
      
      if (!body.CallSid) {
        errors.push('CallSid is required');
      }
      
      if (body.RecordingUrl && !body.RecordingUrl.startsWith('http')) {
        errors.push('RecordingUrl must be a valid URL');
      }
      
      return errors;
    }
  }
};

// Generic validation middleware
export function validateRequest(schemaName) {
  return (req, res, next) => {
    const schema = validationSchemas[schemaName];
    
    if (!schema) {
      logger.error(`Unknown validation schema: ${schemaName}`);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    const errors = schema.validate(req.body);
    
    if (errors.length > 0) {
      logger.warn('Validation failed:', {
        schema: schemaName,
        errors,
        body: req.body
      });
      
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }
    
    next();
  };
}

// Error handling middleware
export function errorHandler(err, req, res, next) {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body
  });
  
  // Don't expose internal errors to client
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;
  
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

// Request logging middleware
export function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  logger.info('Incoming request:', {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  // Log response when it completes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed:', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  });
  
  next();
}

// Rate limiting middleware (basic implementation)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // max requests per window

export function rateLimiter(req, res, next) {
  const clientId = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!requestCounts.has(clientId)) {
    requestCounts.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  } else {
    const client = requestCounts.get(clientId);
    
    if (now > client.resetTime) {
      // Reset window
      client.count = 1;
      client.resetTime = now + RATE_LIMIT_WINDOW;
    } else {
      client.count++;
      
      if (client.count > RATE_LIMIT_MAX) {
        logger.warn('Rate limit exceeded:', { clientId, count: client.count });
        return res.status(429).json({ error: 'Too many requests' });
      }
    }
  }
  
  next();
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [clientId, client] of requestCounts.entries()) {
    if (now > client.resetTime) {
      requestCounts.delete(clientId);
    }
  }
}, RATE_LIMIT_WINDOW); 