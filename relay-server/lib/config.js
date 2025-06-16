import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

// Validate required environment variables
const validateConfig = () => {
  const requiredVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error('Missing required environment variables:', {
      missing: missingVars
    });
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  logger.info('Environment variables validated successfully');
};

// Only validate in production
if (process.env.NODE_ENV === 'production') {
  validateConfig();
}

export const config = {
  // API Keys
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-test-key',
  TAVILY_API_KEY: process.env.TAVILY_API_KEY,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  
  // Voice Settings
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || 'default_voice_id',
  
  // Response Settings
  DEFAULT_MAX_TOKENS: 150,
  CACHE_EXPIRY: 1000 * 60 * 60, // 1 hour in milliseconds
  
  // Audio Settings
  MIN_AUDIO_DURATION: 0.5, // seconds
  SILENCE_THRESHOLD: -50, // dB
  SILENCE_DURATION: 0.5, // seconds
  
  // Model Settings
  GPT4_MODEL: 'gpt-4',
  GPT35_MODEL: 'gpt-3.5-turbo',
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',

  // Server Configuration
  PORT: process.env.PORT || 3000,
  WS_PORT: process.env.WS_PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Railway Configuration
  RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL,
  WS_HOST: process.env.WS_HOST,
  
  // Twilio Configuration
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  
  // Twilio object for backward compatibility
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },

  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
}; 