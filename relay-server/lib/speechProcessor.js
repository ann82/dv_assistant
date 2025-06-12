import logger from './logger.js';

/**
 * Extract location from speech input
 * @param {string} speechResult - The speech input to process
 * @returns {string|null} The extracted location or null if not found
 */
export function extractLocationFromSpeech(speechResult) {
  logger.info('Extracting location from speech:', { speechResult });

  // Common patterns for location mentions
  const locationPatterns = [
    /(?:in|near|around|close to|at)\s+([^,.]+?(?:,\s*[A-Za-z\s]+)?)(?:\s+and|\s+area|\s+county|$)/i,  // "in San Francisco, California"
    /(?:find|looking for|search for|need|help me find)\s+(?:shelters?|homes?|help|resources?)\s+(?:in|near|around|close to|at)\s+([^,.]+?(?:,\s*[A-Za-z\s]+)?)(?:\s+and|\s+area|\s+county|$)/i,  // "find shelters in San Francisco, California"
    /(?:shelters?|homes?|help|resources?)\s+(?:in|near|around|close to|at)\s+([^,.]+?(?:,\s*[A-Za-z\s]+)?)(?:\s+and|\s+area|\s+county|$)/i,  // "shelters in San Francisco, California"
    /(?:I am|I'm|I live in|I'm in)\s+([^,.]+?(?:,\s*[A-Za-z\s]+)?)(?:\s+and|\s+area|\s+county|$)/i,  // "I am in San Francisco, California"
    /(?:location|area|city|town)\s+(?:is|are)\s+([^,.]+?(?:,\s*[A-Za-z\s]+)?)(?:\s+and|\s+area|\s+county|$)/i,  // "my location is San Francisco, California"
    /(?:can you|could you|please)\s+(?:help|find|search for)\s+(?:me|us)?\s+(?:some|any)?\s+(?:shelters?|homes?|help|resources?)\s+(?:in|near|around|close to|at)\s+([^,.]+?(?:,\s*[A-Za-z\s]+)?)(?:\s+and|\s+area|\s+county|$)/i  // "can you help me find some shelters near San Jose, California"
  ];

  // Try each pattern
  for (const pattern of locationPatterns) {
    const match = speechResult.match(pattern);
    if (match && match[1]) {
      // Remove leading articles like 'the'
      const location = match[1].trim().replace(/^the\s+/i, '');
      logger.info('Location extracted:', { location, pattern: pattern.toString() });
      return location;
    }
  }

  logger.info('No location found in speech input');
  return null;
}

/**
 * Generate a prompt asking for location
 * @returns {string} The location prompt message
 */
export function generateLocationPrompt() {
  return "I need to know your location to help you find the nearest resources. Could you please tell me which city or area you're in?";
} 