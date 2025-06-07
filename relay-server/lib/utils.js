import { createHash } from 'crypto';
import logger from './logger.js';

/**
 * Generates a hash for speech results to prevent duplicate processing
 * @param {string} speechResult - The speech result to hash
 * @returns {string} The generated hash
 */
export function generateSpeechHash(speechResult) {
  try {
    const hash = createHash('sha256')
      .update(speechResult.toLowerCase().trim())
      .digest('hex');
    
    logger.info('Generated speech hash:', { hash });
    return hash;
  } catch (error) {
    logger.error('Error generating speech hash:', error);
    return '';
  }
} 