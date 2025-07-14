import logger from './logger.js';
import { cleanConversationalFillers, rewriteQuery } from './enhancedQueryRewriter.js';
import { extractLocationFromQuery } from './enhancedLocationDetector.js';
import { SearchIntegration } from '../integrations/searchIntegration.js';

/**
 * Extract location from speech input using enhanced location detection
 * @param {string} speechInput - The speech input to process
 * @returns {string|null} Extracted location or null if not found
 */
export async function extractLocation(speechInput) {
  if (!speechInput || typeof speechInput !== 'string') {
    return null;
  }

  // Use the enhanced location detection logic that properly handles current location phrases
  const locationInfo = extractLocationFromQuery(speechInput);
  
  // If it's a current location phrase, return null (no specific location)
  if (locationInfo.scope === 'current-location') {
    logger.info('Detected current location phrase, returning null:', { 
      speechInput, 
      scope: locationInfo.scope 
    });
    return null;
  }
  
  // If it's a follow-up or incomplete query, return null
  if (locationInfo.scope === 'follow-up' || locationInfo.scope === 'incomplete') {
    logger.info('Detected follow-up or incomplete query, returning null:', { 
      speechInput, 
      scope: locationInfo.scope 
    });
    return null;
  }
  
  // Return the extracted location if found
  if (locationInfo.location) {
    logger.info('Extracted location using enhanced detection:', { 
      speechInput, 
      location: locationInfo.location,
      scope: locationInfo.scope 
    });
    return locationInfo.location;
  }
  
  logger.info('No location found in speech input:', { speechInput });
  return null;
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

    // Process with Tavily using SearchIntegration
    const searchResult = await SearchIntegration.search(rewrittenQuery);
    
    if (!searchResult.success) {
      logger.error('Search integration failed:', { error: searchResult.error, callSid });
      return {
        success: false,
        error: searchResult.error,
        callSid
      };
    }

    logger.info('Tavily processing complete:', { 
      success: searchResult.success, 
      resultCount: searchResult.data.results?.length || 0,
      callSid 
    });

    return {
      success: true,
      results: searchResult.data.results || [],
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