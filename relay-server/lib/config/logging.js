/**
 * Logging Configuration
 * Contains all logging-related configuration settings
 */

export const loggingConfig = {
  // General Logging Settings
  level: process.env.LOG_LEVEL || 'info',
  enabled: process.env.LOGGING_ENABLED !== 'false', // Default to true
  
  // Log Format Configuration
  format: {
    timestamp: true,
    includeStack: process.env.LOG_INCLUDE_STACK === 'true',
    includeContext: true,
    maxMessageLength: parseInt(process.env.LOG_MAX_MESSAGE_LENGTH) || 1000,
    sanitizeSensitiveData: true
  },
  
  // Log Output Configuration
  output: {
    console: process.env.LOG_CONSOLE !== 'false', // Default to true
    file: process.env.LOG_FILE === 'true',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
    maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
  },
  
  // Log Categories
  categories: {
    // API Logging
    api: {
      level: process.env.LOG_API_LEVEL || 'info',
      enabled: process.env.LOG_API !== 'false'
    },
    
    // TTS Logging
    tts: {
      level: process.env.LOG_TTS_LEVEL || 'info',
      enabled: process.env.LOG_TTS !== 'false'
    },
    
    // Voice Call Logging
    voice: {
      level: process.env.LOG_VOICE_LEVEL || 'info',
      enabled: process.env.LOG_VOICE !== 'false'
    },
    
    // Search Logging
    search: {
      level: process.env.LOG_SEARCH_LEVEL || 'info',
      enabled: process.env.LOG_SEARCH !== 'false'
    },
    
    // Context Logging
    context: {
      level: process.env.LOG_CONTEXT_LEVEL || 'debug',
      enabled: process.env.LOG_CONTEXT !== 'false'
    },
    
    // Error Logging
    error: {
      level: 'error',
      enabled: true,
      includeStack: true
    }
  },
  
  // Sensitive Data Patterns (to be redacted)
  sensitivePatterns: [
    /sk-[a-zA-Z0-9]{48}/g, // OpenAI API keys
    /AC[a-zA-Z0-9]{32}/g, // Twilio Account SID
    /[a-zA-Z0-9]{32}/g, // Generic 32-char tokens
    /password["\s]*[:=]["\s]*[^"\s,}]+/gi, // Password fields
    /token["\s]*[:=]["\s]*[^"\s,}]+/gi, // Token fields
    /apiKey["\s]*[:=]["\s]*[^"\s,}]+/gi, // API key fields
    /authToken["\s]*[:=]["\s]*[^"\s,}]+/gi // Auth token fields
  ],
  
  // Performance Logging
  performance: {
    enabled: process.env.LOG_PERFORMANCE === 'true',
    threshold: parseInt(process.env.LOG_PERFORMANCE_THRESHOLD) || 1000, // ms
    includeMemory: process.env.LOG_PERFORMANCE_MEMORY === 'true'
  },
  
  // Request Logging
  requests: {
    enabled: process.env.LOG_REQUESTS !== 'false',
    includeHeaders: process.env.LOG_REQUESTS_HEADERS === 'true',
    includeBody: process.env.LOG_REQUESTS_BODY === 'true',
    excludePaths: [
      '/health',
      '/metrics',
      '/favicon.ico'
    ]
  }
};

/**
 * Validate logging configuration
 * @throws {Error} If logging configuration is invalid
 */
export function validateLoggingConfig() {
  const errors = [];
  
  // Validate log level
  const validLevels = ['error', 'warn', 'info', 'debug', 'trace'];
  if (!validLevels.includes(loggingConfig.level)) {
    errors.push(`Invalid log level: ${loggingConfig.level}`);
  }
  
  // Validate file logging settings
  if (loggingConfig.output.file) {
    if (!loggingConfig.output.filePath) {
      errors.push('Log file path is required when file logging is enabled');
    }
    if (loggingConfig.output.maxFileSize < 1024 * 1024) {
      errors.push('Log max file size must be at least 1MB');
    }
    if (loggingConfig.output.maxFiles < 1) {
      errors.push('Log max files must be at least 1');
    }
  }
  
  // Validate category levels
  for (const [category, config] of Object.entries(loggingConfig.categories)) {
    if (config.level && !validLevels.includes(config.level)) {
      errors.push(`Invalid log level for category '${category}': ${config.level}`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Logging Configuration errors: ${errors.join(', ')}`);
  }
}

/**
 * Get logging configuration for a specific category
 * @param {string} category - Log category (e.g., 'api', 'tts', 'voice')
 * @returns {Object} Category-specific logging configuration
 */
export function getLoggingConfigForCategory(category) {
  const categoryConfig = loggingConfig.categories[category] || {};
  
  return {
    level: categoryConfig.level || loggingConfig.level,
    enabled: categoryConfig.enabled !== false && loggingConfig.enabled,
    includeStack: categoryConfig.includeStack || loggingConfig.format.includeStack,
    ...categoryConfig
  };
}

/**
 * Check if logging is enabled for a specific category and level
 * @param {string} category - Log category
 * @param {string} level - Log level
 * @returns {boolean} Whether logging is enabled
 */
export function isLoggingEnabled(category, level) {
  const categoryConfig = getLoggingConfigForCategory(category);
  
  if (!categoryConfig.enabled) {
    return false;
  }
  
  const levels = ['error', 'warn', 'info', 'debug', 'trace'];
  const categoryLevelIndex = levels.indexOf(categoryConfig.level);
  const requestedLevelIndex = levels.indexOf(level);
  
  return requestedLevelIndex <= categoryLevelIndex;
}

/**
 * Sanitize log message to remove sensitive data
 * @param {string} message - Log message to sanitize
 * @returns {string} Sanitized log message
 */
export function sanitizeLogMessage(message) {
  if (!loggingConfig.format.sanitizeSensitiveData) {
    return message;
  }
  
  let sanitized = message;
  
  for (const pattern of loggingConfig.sensitivePatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  
  return sanitized;
}

/**
 * Get logging status
 * @returns {Object} Logging status information
 */
export function getLoggingStatus() {
  return {
    enabled: loggingConfig.enabled,
    level: loggingConfig.level,
    output: {
      console: loggingConfig.output.console,
      file: loggingConfig.output.file,
      filePath: loggingConfig.output.filePath
    },
    categories: Object.fromEntries(
      Object.entries(loggingConfig.categories).map(([category, config]) => [
        category,
        {
          enabled: config.enabled !== false,
          level: config.level || loggingConfig.level
        }
      ])
    ),
    performance: {
      enabled: loggingConfig.performance.enabled,
      threshold: loggingConfig.performance.threshold
    },
    requests: {
      enabled: loggingConfig.requests.enabled,
      includeHeaders: loggingConfig.requests.includeHeaders,
      includeBody: loggingConfig.requests.includeBody
    }
  };
} 