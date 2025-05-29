import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // API Keys
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key',
  TAVILY_API_KEY: process.env.TAVILY_API_KEY,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  
  // Voice Settings
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || 'default_voice_id',
  
  // Response Settings
  DEFAULT_MAX_TOKENS: 150, // Reduced from 1000 to minimize costs
  CACHE_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
  
  // Audio Settings
  MIN_AUDIO_DURATION: 0.5, // seconds
  SILENCE_THRESHOLD: -50, // dB
  SILENCE_DURATION: 0.5, // seconds
  
  // Model Settings
  GPT4_MODEL: 'gpt-4',
  GPT35_MODEL: 'gpt-3.5-turbo',
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  PORT: process.env.PORT || 3000,
  WS_PORT: process.env.WS_PORT || 3001,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
}; 