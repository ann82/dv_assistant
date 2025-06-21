import logger from './logger.js';

/**
 * Extract location from speech input using hybrid approach
 * @param {string} speechInput - The speech input to process
 * @returns {string|null} Extracted location or null if not found
 */
export async function extractLocation(speechInput) {
  if (!speechInput || typeof speechInput !== 'string') {
    return null;
  }

  // Step 1: Try fast pattern matching first (cost-effective)
  const location = extractLocationByPattern(speechInput);
  
  // Step 2: If pattern matching fails or is uncertain, use AI for better accuracy
  if (!location || location.length < 2) {
    try {
      const aiLocation = await extractLocationWithAI(speechInput);
      if (aiLocation) {
        logger.info('Used AI for location extraction:', { 
          original: speechInput, 
          patternResult: location, 
          aiResult: aiLocation 
        });
        return aiLocation;
      }
    } catch (error) {
      logger.error('AI location extraction failed, using pattern result:', error);
      // Fall back to pattern matching result
    }
  }
  
  return location;
}

/**
 * Extract location using simple pattern matching (fast and cheap)
 * @param {string} speechInput - The speech input to process
 * @returns {string|null} Extracted location or null if not found
 */
function extractLocationByPattern(speechInput) {
  const input = speechInput.toLowerCase();
  
  // Common location patterns
  const locationPatterns = [
    // Standard patterns
    /(?:in|at|near|around|to|from)\s+([a-zA-Z\s]+?)(?:\s+(?:area|region|county|city|town|state))?/i,
    /(?:shelter|help|services)\s+(?:in|at|near|around)\s+([a-zA-Z\s]+)/i,
    /([a-zA-Z\s]+?)\s+(?:area|region|county|city|town|state)/i,
    
    // Handle speech recognition errors and informal speech
    /(?:hold|help|find|need|want)\s+(?:me|a|the)?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /(?:homeless|me|a)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    
    // Catch any capitalized word that might be a location (fallback)
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g
  ];
  
  for (const pattern of locationPatterns) {
    const match = speechInput.match(pattern);
    if (match && match[1]) {
      const location = match[1].trim();
      // Filter out common words that aren't locations
      const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'at', 'near', 'around', 'to', 'from', 'me', 'my', 'i', 'need', 'want', 'looking', 'for', 'help', 'shelter', 'services', 'hold', 'find', 'homeless'];
      const words = location.split(' ').filter(word => !commonWords.includes(word.toLowerCase()));
      
      if (words.length > 0) {
        return words.join(' ');
      }
    }
  }
  
  return null;
}

/**
 * Use AI to extract location from speech input (only when needed)
 * @param {string} speechInput - The speech input to process
 * @returns {string|null} Extracted location or null if not found
 */
async function extractLocationWithAI(speechInput) {
  try {
    const { callGPT } = await import('./apis.js');
    
    const prompt = `Extract the location from this speech input. Look for city names, area names, or geographic references.

Speech input: "${speechInput}"

If a location is found, respond with only the location name (e.g., "San Francisco", "Oakland", "Tahoe").
If no location is found, respond with "none".

Examples:
- "I need shelter in San Francisco" → "San Francisco"
- "homeless me a Tahoe" → "Tahoe" 
- "help in the Oakland area" → "Oakland"
- "I need assistance" → "none"`;

    const response = await callGPT(prompt, 'gpt-3.5-turbo');
    
    // Handle the response properly - callGPT returns an object with a text property
    let responseText;
    if (typeof response === 'string') {
      responseText = response;
    } else if (response && typeof response === 'object' && response.text) {
      responseText = response.text;
    } else {
      logger.error('Unexpected response format from callGPT:', { response, type: typeof response });
      return null;
    }
    
    const location = responseText.trim().toLowerCase();
    
    if (location === 'none' || location === 'no location' || location === '') {
      return null;
    }
    
    return location;
  } catch (error) {
    logger.error('Error calling GPT for location extraction:', error);
    return null;
  }
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