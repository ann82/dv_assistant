import logger from './logger.js';
import { cleanConversationalFillers, rewriteQuery } from './enhancedQueryRewriter.js';
import { extractLocationFromQuery } from './enhancedLocationDetector.js';
import { callTavilyAPI } from './apis.js';

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
  
  // Common location patterns (now includes 'for')
  const locationPatterns = [
    // Standard patterns
    /(?:in|at|near|around|to|from|for)\s+([a-zA-Z\s,]+?)(?:\s+(?:area|region|county|city|town|state))?/i,
    /(?:shelter|help|services)\s+(?:in|at|near|around|for)\s+([a-zA-Z\s,]+)/i,
    /([a-zA-Z\s,]+?)\s+(?:area|region|county|city|town|state)/i,
    // New: direct 'for' pattern
    /for\s+([a-zA-Z\s,]+?)(?:[?.,!;]|$)/i,
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
      const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'at', 'near', 'around', 'to', 'from', 'for', 'me', 'my', 'i', 'need', 'want', 'looking', 'for', 'help', 'shelter', 'services', 'hold', 'find', 'homeless'];
      const words = location.split(' ').filter(word => !commonWords.includes(word.toLowerCase()));
      if (words.length > 0) {
        // Return with proper case (capitalize first letter of each word)
        return words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
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
    const { ResponseGenerator } = await import('./response.js');
    
    const prompt = `Extract the location from this speech input. Look for city names, area names, or geographic references.

Speech input: "${speechInput}"

If a location is found, respond with only the location name with proper capitalization (e.g., "San Francisco", "Oakland", "Tahoe").
If no location is found, respond with "none".

Examples:
- "I need shelter in San Francisco" → "San Francisco"
- "homeless me a Tahoe" → "Tahoe" 
- "help in the Oakland area" → "Oakland"
- "I need assistance" → "none"`;

    const response = await ResponseGenerator.generateGPTResponse(prompt, 'gpt-3.5-turbo', '');
    
    // Handle the response properly - generateGPTResponse returns an object with a text property
    let responseText;
    if (typeof response === 'string') {
      responseText = response;
    } else if (response && typeof response === 'object' && response.text) {
      responseText = response.text;
    } else {
      logger.error('Unexpected response format from generateGPTResponse:', { response, type: typeof response });
      return null;
    }
    
    const location = responseText.trim();
    
    if (location.toLowerCase() === 'none' || location.toLowerCase() === 'no location' || location === '') {
      return null;
    }
    
    // Ensure proper capitalization
    return location.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
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
  return "Please tell me your city or area, like San Francisco, California.";
}

/**
 * Process speech result and generate response
 * @param {string} speechInput - The speech input to process
 * @param {string} callSid - Call SID for logging
 * @returns {Promise<Object>} Processing result
 */
export async function processSpeechResult(speechInput, callSid) {
  try {
    logger.info('Processing speech result:', { speechInput, callSid });

    // Validate input
    if (!speechInput || typeof speechInput !== 'string' || speechInput.trim() === '') {
      logger.warn('Empty or invalid speech input:', { speechInput, callSid });
      return {
        success: false,
        error: 'No speech input provided',
        callSid
      };
    }

    // Clean conversational fillers
    const cleanedInput = cleanConversationalFillers(speechInput);
    logger.info('Cleaned input:', { original: speechInput, cleaned: cleanedInput, callSid });

    // Extract location
    const locationInfo = extractLocationFromQuery(cleanedInput);
    logger.info('Location extracted:', { locationInfo, callSid });

    // Rewrite query for better search results
    const rewrittenQuery = await rewriteQuery(cleanedInput, 'find_shelter', callSid);
    logger.info('Query rewritten:', { original: cleanedInput, rewritten: rewrittenQuery, callSid });

    // Process with Tavily using standardized API with location
    const tavilyResult = await callTavilyAPI(rewrittenQuery, locationInfo.location);

    logger.info('Tavily processing complete:', { 
      success: tavilyResult.success, 
      resultCount: tavilyResult.results?.length || 0,
      callSid 
    });

    return {
      success: true,
      results: tavilyResult.results || [],
      query: rewrittenQuery,
      location: locationInfo.location,
      callSid
    };

  } catch (error) {
    logger.error('Error processing speech result:', { error: error.message, callSid });
    return {
      success: false,
      error: error.message,
      callSid
    };
  }
} 