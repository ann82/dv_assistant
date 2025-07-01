#!/usr/bin/env node

import { config } from './lib/config.js';
import logger from './lib/logger.js';

logger.info('🔊 Voice Configuration Test');
logger.info('============================');

logger.info('Current Voice Settings:');
logger.info(`  ENABLE_TTS: ${config.ENABLE_TTS}`);
logger.info(`  TTS_VOICE: ${config.TTS_VOICE}`);
logger.info(`  TTS_TIMEOUT: ${config.TTS_TIMEOUT}ms`);
logger.info(`  FALLBACK_TO_POLLY: ${config.FALLBACK_TO_POLLY}`);

logger.info('\nVoice Options:');
logger.info('  OpenAI TTS Voices: alloy, echo, fable, onyx, nova, shimmer');
logger.info('  Twilio Polly Voices: Polly.Amy (fallback)');

logger.info('\nTo disable TTS and use Polly only:');
logger.info('  export ENABLE_TTS=false');

logger.info('\nTo change TTS voice:');
logger.info('  export TTS_VOICE=nova');

logger.info('\nTo adjust TTS timeout:');
logger.info('  export TTS_TIMEOUT=5000');

logger.info('\nCurrent Configuration:');
if (config.ENABLE_TTS) {
  logger.info('✅ TTS is ENABLED - Using OpenAI TTS with voice:', config.TTS_VOICE);
  logger.info('   Timeout:', config.TTS_TIMEOUT, 'ms');
  if (config.FALLBACK_TO_POLLY) {
    logger.info('   Fallback: Polly.Amy (if TTS fails)');
  }
} else {
  logger.info('❌ TTS is DISABLED - Using Polly.Amy only');
}

logger.info('\nRecommendation for Railway:');
logger.info('  If experiencing timeouts, try:');
logger.info('    1. ENABLE_TTS=false (use Polly only)');
logger.info('    2. TTS_TIMEOUT=5000 (5 second timeout)');
logger.info('    3. TTS_VOICE=nova (faster voice)'); 