import winston from 'winston';

// Helper to safely stringify objects with circular references
function safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, function(key, value) {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  }, 2);
}

// Custom format for better error handling
const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let output = `[${timestamp}] ${level}: ${message}`;
    
    // Handle error objects specially
    if (meta.error && typeof meta.error === 'object') {
      output += `\nError Details: ${meta.error.message || 'Unknown error'}`;
      if (meta.error.stack) {
        output += `\nStack Trace: ${meta.error.stack}`;
      }
      if (meta.error.code) {
        output += `\nError Code: ${meta.error.code}`;
      }
      if (meta.error.status) {
        output += `\nError Status: ${meta.error.status}`;
      }
    }
    
    // Handle other metadata
    const otherMeta = { ...meta };
    delete otherMeta.error; // Already handled above
    
    if (Object.keys(otherMeta).length > 0) {
      try {
        output += `\nAdditional Info: ${safeStringify(otherMeta)}`;
      } catch (e) {
        output += `\n[Could not stringify additional meta: ${e.message}]`;
      }
    }
    
    return output;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    new winston.transports.Console({
      // Ensure console transport doesn't truncate
      handleExceptions: true,
      handleRejections: true,
      // Increase max string length for console output
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export default logger; 