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
  });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let metaString = '';
      if (Object.keys(meta).length > 0) {
        try {
          metaString = '\n' + safeStringify(meta, null, 2);
        } catch (e) {
          metaString = '\n[Could not stringify meta: ' + e.message + ']';
        }
      }
      return `[${timestamp}] ${level}: ${message}${metaString}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export default logger; 