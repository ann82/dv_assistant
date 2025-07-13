/**
 * API Configuration
 * Contains all API-related configuration settings
 */

export const apiConfig = {
  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY || 'sk-test-key',
    model: {
      gpt4: 'gpt-4',
      gpt35: 'gpt-3.5-turbo'
    },
    timeout: parseInt(process.env.OPENAI_TIMEOUT) || 30000,
    maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES) || 3,
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 150
  },
  
  // Tavily Configuration
  tavily: {
    apiKey: process.env.TAVILY_API_KEY,
    searchDepth: process.env.TAVILY_SEARCH_DEPTH || 'basic',
    searchType: process.env.TAVILY_SEARCH_TYPE || 'basic',
    maxResults: parseInt(process.env.TAVILY_MAX_RESULTS) || 8,
    timeout: parseInt(process.env.TAVILY_TIMEOUT) || 8000,
    cacheEnabled: process.env.TAVILY_CACHE_ENABLED !== 'false',
    includeRawContent: false // Always false for performance
  },
  
  // Twilio Configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    webhookUrl: process.env.TWILIO_WEBHOOK_URL,
    timeout: parseInt(process.env.TWILIO_TIMEOUT) || 30000,
    maxRetries: parseInt(process.env.TWILIO_MAX_RETRIES) || 3
  },
  
  // Speech Recognition Configuration
  speech: {
    timeout: 'auto',
    model: 'phone_call',
    enhanced: 'true',
    language: 'en-US',
    speechRecognitionLanguage: 'en-US',
    profanityFilter: 'false',
    interimSpeechResultsCallback: '/twilio/voice/interim'
  },
  
  // Geocoding Configuration
  geocoding: {
    provider: process.env.GEOCODING_PROVIDER || 'nominatim',
    timeout: parseInt(process.env.GEOCODING_TIMEOUT) || 10000,
    cacheTtl: parseInt(process.env.GEOCODING_CACHE_TTL) || 1000 * 60 * 60 * 24, // 24 hours
    maxCacheSize: parseInt(process.env.GEOCODING_MAX_CACHE_SIZE) || 1000,
    userAgent: 'DomesticViolenceAssistant/1.0'
  },
  
  // Rate Limiting Configuration
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.'
  },
  
  // Cache Configuration
  cache: {
    ttl: 1000 * 60 * 60, // 1 hour
    maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000,
    enabled: process.env.CACHE_ENABLED !== 'false'
  }
};

/**
 * Validate API configuration
 * @throws {Error} If required configuration is missing
 */
export function validateApiConfig() {
  const errors = [];
  
  // Validate OpenAI config
  if (!apiConfig.openai.apiKey || apiConfig.openai.apiKey === 'sk-test-key') {
    errors.push('OpenAI API key is required');
  }
  
  // Validate Tavily config
  if (!apiConfig.tavily.apiKey) {
    errors.push('Tavily API key is required');
  }
  
  // Validate Twilio config (only in production)
  if (process.env.NODE_ENV === 'production') {
    if (!apiConfig.twilio.accountSid) {
      errors.push('Twilio Account SID is required');
    }
    if (!apiConfig.twilio.authToken) {
      errors.push('Twilio Auth Token is required');
    }
    if (!apiConfig.twilio.phoneNumber) {
      errors.push('Twilio Phone Number is required');
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`API Configuration errors: ${errors.join(', ')}`);
  }
}

/**
 * Get API status (which APIs are available)
 * @returns {Object} API availability status
 */
export function getApiStatus() {
  return {
    openai: {
      available: !!(apiConfig.openai.apiKey && apiConfig.openai.apiKey !== 'sk-test-key'),
      keyPrefix: apiConfig.openai.apiKey ? apiConfig.openai.apiKey.substring(0, 7) : 'none'
    },
    tavily: {
      available: !!apiConfig.tavily.apiKey,
      keyPrefix: apiConfig.tavily.apiKey ? apiConfig.tavily.apiKey.substring(0, 7) : 'none'
    },
    twilio: {
      available: !!(apiConfig.twilio.accountSid && apiConfig.twilio.authToken && apiConfig.twilio.phoneNumber),
      accountSid: apiConfig.twilio.accountSid ? apiConfig.twilio.accountSid.substring(0, 7) : 'none'
    }
  };
} 