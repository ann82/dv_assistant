/**
 * Main Configuration Index
 * Centralized configuration management for the entire application
 */

import { apiConfig, validateApiConfig, getApiStatus } from './api.js';
import { ttsConfig, validateTtsConfig, getTtsStatus } from './tts.js';
import { loggingConfig, validateLoggingConfig, getLoggingStatus } from './logging.js';

// Main configuration object
export const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
  
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || '0.0.0.0',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    cors: {
      enabled: process.env.CORS_ENABLED !== 'false',
      origin: process.env.CORS_ORIGIN || '*',
      credentials: process.env.CORS_CREDENTIALS === 'true'
    }
  },
  
  // Application Configuration
  app: {
    name: 'Domestic Violence Support Assistant',
    version: process.env.APP_VERSION || '1.21.7',
    description: 'Real-time voice-based assistant for domestic violence support',
    contact: {
      email: process.env.CONTACT_EMAIL || 'support@example.com',
      phone: process.env.CONTACT_PHONE || '+1-800-HELP-NOW'
    }
  },
  
  // Feature Flags
  features: {
    emergencyDetection: process.env.EMERGENCY_DETECTION !== 'false',
    safetyPlanning: process.env.SAFETY_PLANNING !== 'false',
    followUpDetection: process.env.FOLLOW_UP_DETECTION !== 'false',
    conversationContext: process.env.CONVERSATION_CONTEXT !== 'false',
    locationDetection: process.env.LOCATION_DETECTION !== 'false',
    multilingualSupport: process.env.MULTILINGUAL_SUPPORT === 'true',
    callSummaries: process.env.CALL_SUMMARIES === 'true'
  },
  
  // Timeouts and Limits
  timeouts: {
    conversation: parseInt(process.env.CONVERSATION_TIMEOUT) || 15 * 60 * 1000, // 15 minutes
    search: parseInt(process.env.SEARCH_TIMEOUT) || 8000,
    intent: parseInt(process.env.INTENT_TIMEOUT) || 10000,
    response: parseInt(process.env.RESPONSE_TIMEOUT) || 15000,
    call: parseInt(process.env.CALL_TIMEOUT) || 30 * 60 * 1000 // 30 minutes
  },
  
  // Import sub-configurations
  api: apiConfig,
  tts: ttsConfig,
  logging: loggingConfig
};

/**
 * Validate entire configuration
 * @throws {Error} If any configuration is invalid
 */
export function validateConfig() {
  const errors = [];
  
  try {
    validateApiConfig();
  } catch (error) {
    errors.push(`API Config: ${error.message}`);
  }
  
  try {
    validateTtsConfig();
  } catch (error) {
    errors.push(`TTS Config: ${error.message}`);
  }
  
  try {
    validateLoggingConfig();
  } catch (error) {
    errors.push(`Logging Config: ${error.message}`);
  }
  
  // Validate server configuration
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('Server port must be between 1 and 65535');
  }
  
  // Validate timeouts
  for (const [name, timeout] of Object.entries(config.timeouts)) {
    if (timeout < 1000) {
      errors.push(`${name} timeout must be at least 1 second`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Get configuration for a specific environment
 * @param {string} env - Environment name
 * @returns {Object} Environment-specific configuration
 */
export function getConfigForEnvironment(env) {
  const baseConfig = { ...config };
  
  switch (env) {
    case 'production':
      return {
        ...baseConfig,
        logging: {
          ...baseConfig.logging,
          level: 'warn',
          output: {
            ...baseConfig.logging.output,
            console: false,
            file: true
          }
        },
        features: {
          ...baseConfig.features,
          emergencyDetection: true,
          safetyPlanning: true,
          callSummaries: true
        }
      };
      
    case 'test':
      return {
        ...baseConfig,
        logging: {
          ...baseConfig.logging,
          level: 'error',
          output: {
            ...baseConfig.logging.output,
            console: false,
            file: false
          }
        },
        features: {
          ...baseConfig.features,
          emergencyDetection: false,
          safetyPlanning: false,
          callSummaries: false
        },
        timeouts: {
          ...baseConfig.timeouts,
          conversation: 5 * 60 * 1000, // 5 minutes for tests
          call: 10 * 60 * 1000 // 10 minutes for tests
        }
      };
      
    case 'development':
    default:
      return {
        ...baseConfig,
        logging: {
          ...baseConfig.logging,
          level: 'debug',
          output: {
            ...baseConfig.logging.output,
            console: true,
            file: false
          }
        }
      };
  }
}

/**
 * Get system status (all services and configurations)
 * @returns {Object} Complete system status
 */
export function getSystemStatus() {
  return {
    app: {
      name: config.app.name,
      version: config.app.version,
      environment: config.env,
      timestamp: new Date().toISOString()
    },
    server: {
      port: config.server.port,
      host: config.server.host,
      baseUrl: config.server.baseUrl
    },
    features: config.features,
    api: getApiStatus(),
    tts: getTtsStatus(),
    logging: getLoggingStatus(),
    timeouts: config.timeouts
  };
}

/**
 * Get configuration value by path
 * @param {string} path - Dot-separated path to configuration value
 * @param {any} defaultValue - Default value if path doesn't exist
 * @returns {any} Configuration value
 */
export function getConfigValue(path, defaultValue = undefined) {
  const keys = path.split('.');
  let value = config;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }
  
  return value;
}

/**
 * Set configuration value by path
 * @param {string} path - Dot-separated path to configuration value
 * @param {any} value - Value to set
 */
export function setConfigValue(path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  let current = config;
  
  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[lastKey] = value;
}

// Export individual configurations for backward compatibility
export { apiConfig, ttsConfig, loggingConfig };
export { validateApiConfig, validateTtsConfig, validateLoggingConfig };
export { getApiStatus, getTtsStatus, getLoggingStatus }; 