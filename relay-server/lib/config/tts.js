/**
 * TTS (Text-to-Speech) Configuration
 * Contains all TTS-related configuration settings
 */

export const ttsConfig = {
  // TTS General Settings
  enabled: process.env.ENABLE_TTS !== 'false', // Default to true
  timeout: parseInt(process.env.TTS_TIMEOUT) || 5000, // TTS timeout in milliseconds (optimized for faster response)
  fallbackToPolly: process.env.FALLBACK_TO_POLLY !== 'false', // Default to true
  
  // OpenAI TTS Configuration
  openai: {
    voice: process.env.TTS_VOICE || 'nova', // OpenAI TTS voice: nova, alloy, echo, fable, onyx, shimmer
    model: 'tts-1',
    maxRetries: 0, // No retries for faster response
    maxRetryDelay: 500, // Reduced retry delay for faster fallback
    bufferSize: 512 * 1024, // 512KB chunks for faster processing
    supportedVoices: ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer']
  },
  
  // Polly Fallback Configuration
  polly: {
    voice: process.env.POLLY_VOICE || 'Joanna',
    engine: 'neural',
    languageCode: 'en-US',
    supportedVoices: {
      'en-US': ['Joanna', 'Matthew', 'Ivy', 'Justin'],
      'es-ES': ['Lupe', 'Pedro'],
      'fr-FR': ['Lea', 'Remi'],
      'de-DE': ['Vicki', 'Daniel']
    }
  },
  
  // Audio Settings
  audio: {
    minDuration: 0.5, // seconds
    silenceThreshold: -50, // dB
    silenceDuration: 0.5, // seconds
    sampleRate: 24000, // Hz
    channels: 1, // Mono
    bitDepth: 16 // bits
  },
  
  // TTS Cache Configuration
  cache: {
    enabled: process.env.TTS_CACHE_ENABLED !== 'false',
    ttl: 1000 * 60 * 60 * 24, // 24 hours
    maxSize: parseInt(process.env.TTS_CACHE_MAX_SIZE) || 1000,
    directory: process.env.TTS_CACHE_DIR || './cache/audio',
    cleanupInterval: 1000 * 60 * 60 * 6, // 6 hours
    maxFileAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    logMisses: process.env.TTS_CACHE_LOG_MISSES === 'true' // Only log cache misses if explicitly enabled
  },
  
  // Language-specific TTS Configuration
  languages: {
    'en-US': {
      openaiVoice: 'nova',
      pollyVoice: 'Joanna',
      languageCode: 'en-US'
    },
    'es-ES': {
      openaiVoice: 'shimmer',
      pollyVoice: 'Lupe',
      languageCode: 'es-ES'
    },
    'fr-FR': {
      openaiVoice: 'echo',
      pollyVoice: 'Lea',
      languageCode: 'fr-FR'
    },
    'de-DE': {
      openaiVoice: 'onyx',
      pollyVoice: 'Vicki',
      languageCode: 'de-DE'
    }
  }
};

/**
 * Validate TTS configuration
 * @throws {Error} If TTS configuration is invalid
 */
export function validateTtsConfig() {
  const errors = [];
  
  // Validate OpenAI voice
  if (!ttsConfig.openai.supportedVoices.includes(ttsConfig.openai.voice)) {
    errors.push(`Unsupported OpenAI TTS voice: ${ttsConfig.openai.voice}`);
  }
  
  // Validate timeout
  if (ttsConfig.timeout < 5000 || ttsConfig.timeout > 60000) {
    errors.push('TTS timeout must be between 5 and 60 seconds');
  }
  
  // Validate cache settings
  if (ttsConfig.cache.enabled) {
    if (ttsConfig.cache.maxSize < 1) {
      errors.push('TTS cache max size must be at least 1');
    }
    if (ttsConfig.cache.ttl < 1000 * 60) {
      errors.push('TTS cache TTL must be at least 1 minute');
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`TTS Configuration errors: ${errors.join(', ')}`);
  }
}

/**
 * Get TTS configuration for a specific language
 * @param {string} languageCode - Language code (e.g., 'en-US')
 * @returns {Object} Language-specific TTS configuration
 */
export function getTtsConfigForLanguage(languageCode) {
  const defaultConfig = ttsConfig.languages['en-US'];
  const languageConfig = ttsConfig.languages[languageCode] || defaultConfig;
  
  return {
    ...ttsConfig,
    openai: {
      ...ttsConfig.openai,
      voice: languageConfig.openaiVoice
    },
    polly: {
      ...ttsConfig.polly,
      voice: languageConfig.pollyVoice,
      languageCode: languageConfig.languageCode
    }
  };
}

/**
 * Get TTS status (which TTS providers are available)
 * @returns {Object} TTS availability status
 */
export function getTtsStatus() {
  return {
    enabled: ttsConfig.enabled,
    openai: {
      available: ttsConfig.enabled,
      voice: ttsConfig.openai.voice,
      model: ttsConfig.openai.model
    },
    polly: {
      available: ttsConfig.enabled && ttsConfig.fallbackToPolly,
      voice: ttsConfig.polly.voice,
      engine: ttsConfig.polly.engine
    },
    cache: {
      enabled: ttsConfig.cache.enabled,
      ttl: ttsConfig.cache.ttl,
      maxSize: ttsConfig.cache.maxSize
    }
  };
} 