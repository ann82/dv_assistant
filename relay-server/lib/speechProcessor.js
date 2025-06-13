import logger from './logger.js';

/**
 * Extract location from speech input
 * @param {string} speechResult - The speech input to process
 * @returns {string|null} The extracted location or null if not found
 */
export function extractLocationFromSpeech(speechResult) {
  if (!speechResult) {
    logger.warn('No speech result provided to extractLocationFromSpeech');
    return null;
  }

  logger.info('Extracting location from speech', { speechResult });

  // Patterns to match location mentions
  const patterns = [
    /in\s+([^,.]+(?:,\s*[^,.]+)?)/i,  // "in San Francisco, California"
    /find\s+shelters?\s+in\s+([^,.]+(?:,\s*[^,.]+)?)/i,  // "find shelters in San Francisco, California"
    /looking\s+for\s+shelters?\s+in\s+([^,.]+(?:,\s*[^,.]+)?)/i,  // "looking for shelters in San Francisco, California"
    /near\s+([^,.]+(?:,\s*[^,.]+)?)/i,  // "near San Francisco, California"
    /around\s+([^,.]+(?:,\s*[^,.]+)?)/i,  // "around San Francisco, California"
    /in\s+the\s+([^,.]+(?:,\s*[^,.]+)?)/i,  // "in the San Francisco, California"
    /find\s+shelters?\s+in\s+the\s+([^,.]+(?:,\s*[^,.]+)?)/i,  // "find shelters in the San Francisco, California"
    /looking\s+for\s+shelters?\s+in\s+the\s+([^,.]+(?:,\s*[^,.]+)?)/i,  // "looking for shelters in the San Francisco, California"
    /near\s+the\s+([^,.]+(?:,\s*[^,.]+)?)/i,  // "near the San Francisco, California"
    /around\s+the\s+([^,.]+(?:,\s*[^,.]+)?)/i,  // "around the San Francisco, California"
    /my\s+location\s+is\s+([^,.]+(?:,\s*[^,.]+)?)/i,  // "my location is San Francisco, California"
    /i\s+live\s+in\s+([^,.]+(?:,\s*[^,.]+)?)/i,  // "i live in San Francisco, California"
    /i'm\s+in\s+([^,.]+(?:,\s*[^,.]+)?)/i  // "i'm in San Francisco, California"
  ];

  for (const pattern of patterns) {
    const match = speechResult.match(pattern);
    if (match && match[1]) {
      let location = match[1].trim();
      // Remove trailing phrases like 'and need resources', 'and', 'area', 'county', etc.
      location = location.replace(/\s+(and|area|county|need resources).*$/i, '');
      // Remove trailing 'County' if not expected
      if (/County$/.test(location) && !/San Francisco County|Santa Clara County|San Mateo County|Alameda County|Contra Costa County|Marin County|Solano County|Sonoma County|Napa County/i.test(location)) {
        location = location.replace(/\s*County$/i, '');
      }
      // Remove leading 'the' if present
      location = location.replace(/^the\s+/i, '');
      logger.info('Location extracted from speech', { location });
      return location;
    }
  }

  logger.info('No location found in speech');
  return null;
}

/**
 * Generate a prompt asking for location
 * @returns {string} The location prompt message
 */
export function generateLocationPrompt() {
  const exampleCities = [
    'San Francisco',
    'Oakland',
    'San Jose',
    'Santa Clara',
    'San Mateo',
    'Palo Alto',
    'Mountain View',
    'Sunnyvale',
    'Redwood City'
  ];

  // Ensure we always include at least one example city
  const city1 = exampleCities[Math.floor(Math.random() * exampleCities.length)];
  const city2 = exampleCities[Math.floor(Math.random() * exampleCities.length)];

  const prompts = [
    `To help you find local resources, I need to know your location. Please tell me your city or area, like ${city1} or ${city2}.`,
    `I need to know your location to help you find resources. Could you please tell me which city you're in? For example, you could say ${city1} or ${city2}.`,
    `To find the closest resources to you, I need to know your location. Please tell me your city or area, such as ${city1} or ${city2}.`,
    `Please share your location so I can find the best resources for you. Which city or area are you in? For example, you could say ${city1} or ${city2}.`
  ];

  return prompts[Math.floor(Math.random() * prompts.length)];
} 