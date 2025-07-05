import logger from './logger.js';
import { detectUSLocation, extractLocationFromQuery, detectLocationWithGeocoding } from './enhancedLocationDetector.js';
import { getConversationContext } from './intentClassifier.js';

/**
 * Enhanced Query Rewriter for Domestic Violence Support Assistant
 * 
 * This module handles:
 * 1. Cleaning natural language queries by removing conversational fillers
 * 2. US-only location detection with proper scope handling using geocoding
 * 3. Crafting high-quality search queries for shelter discovery
 */

// Conversational fillers to remove from the start of queries
let CONVERSATIONAL_FILLERS = [
  'hey', 'hey!', 'hi', 'hello', 'good morning', 'good afternoon', 'good evening',
  'please help me', 'please assist me', 'i would like', 'i want to',
  'i am looking for', 'i am searching for', 'i need to find', 'i want to find',
  'can you find', 'could you find', 'can you get', 'could you get',
  'i need some', 'i want some', 'i am looking for some', 'i need to get some',
  'i was wondering', 'i hope you can help', 'i hope you can assist',
  'i hope you can find', 'i hope you can search', 'excuse me', 'sorry to bother you',
  'can you help me', 'could you help me', 'we can you help me'
];
// Sort fillers by descending length to match multi-word fillers first
CONVERSATIONAL_FILLERS = CONVERSATIONAL_FILLERS.sort((a, b) => b.length - a.length);

/**
 * Clean conversational fillers from the start of a query
 * @param {string} query - The query to clean
 * @returns {string} The cleaned query
 */
export function cleanConversationalFillers(query) {
  if (!query || typeof query !== 'string') {
    return query;
  }

  // Define conversational fillers that should only be removed at the very beginning
  const fillers = [
    'hey', 'hey!', 'hi', 'hello', 'excuse me', 'pardon me', 'sorry',
    'um', 'uh', 'like', 'you know', 'i mean', 'basically',
    'actually', 'literally', 'honestly', 'frankly', 'clearly',
    'obviously', 'simply', 'just', 'really', 'very', 'quite',
    'can you', 'could you', 'would you', 'please'
  ];

  let cleanedQuery = query.trim();
  
  // Remove fillers at the beginning of the query
  let previousLength;
  do {
    previousLength = cleanedQuery.length;
    
    // Check each filler
    for (const filler of fillers) {
      // Create regex pattern that matches the filler at the start, with optional punctuation and spaces
      const escapedFiller = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fillerPattern = new RegExp(`^\\s*${escapedFiller}\\s*[!.,;:?]*\\s*`, 'i');
      cleanedQuery = cleanedQuery.replace(fillerPattern, '');
    }
    
    // Also handle standalone punctuation at the start
    cleanedQuery = cleanedQuery.replace(/^[!.,;:?\s]+/, '');
    
  } while (cleanedQuery.length < previousLength && cleanedQuery.length > 0);

  return cleanedQuery.trim() || query; // Return original if everything was removed
}

/**
 * Rewrite query for optimal shelter search
 * @param {string} query - The user query
 * @param {string} intent - The detected intent
 * @param {string} callSid - Call SID for logging
 * @returns {Promise<string>} Rewritten query optimized for search
 */
export async function rewriteQuery(query, intent = 'find_shelter', callSid = null) {
  if (!query || typeof query !== 'string') {
    return query;
  }

  logger.info('Rewriting query:', { query, intent, callSid });

  // Step 1: Clean conversational fillers
  const cleanedQuery = cleanConversationalFillers(query);
  logger.info('Cleaned query:', { original: query, cleaned: cleanedQuery, callSid });

  // Step 2: Extract and validate location using enhanced geocoding
  const locationInfo = await detectLocationWithGeocoding(cleanedQuery);
  logger.info('Location detection result:', { locationInfo, callSid });

  // Step 3: Build optimized search query
  let searchQuery = cleanedQuery;

  if (locationInfo.location && locationInfo.isComplete) {
    // Resource-seeking keywords
    const resourceKeywords = /\b(shelter|help|resources?|housing|support)\b/i;
    if (resourceKeywords.test(cleanedQuery)) {
      if (/\bshelter\b/i.test(cleanedQuery)) {
        // Only append site restriction for US locations
        if (locationInfo.country === 'US' && !/site:org OR site:gov/i.test(cleanedQuery)) {
          searchQuery = `${cleanedQuery} site:org OR site:gov`;
        } else {
          searchQuery = cleanedQuery;
        }
        logger.info('Query contains shelter, appended site restriction (US only):', { searchQuery, callSid });
      } else {
        // Rewrite to enhanced form for resource-seeking queries without 'shelter' (US only)
        if (locationInfo.country === 'US') {
          searchQuery = `domestic violence shelter ${locationInfo.location} site:org OR site:gov`;
          logger.info('Enhanced query with complete US location and resource-seeking intent:', { searchQuery, callSid });
        } else {
          searchQuery = cleanedQuery;
          logger.info('Non-US location, no site restriction added:', { searchQuery, callSid });
        }
      }
    } else {
      // Non-resource-seeking query with complete location - just append site restriction (US only)
      if (locationInfo.country === 'US' && !/site:org OR site:gov/i.test(cleanedQuery)) {
        searchQuery = `${cleanedQuery} site:org OR site:gov`;
        logger.info('Non-resource query with complete US location, appended site restriction:', { searchQuery, callSid });
      } else {
        searchQuery = cleanedQuery;
        logger.info('Non-resource query with non-US location, no site restriction added:', { searchQuery, callSid });
      }
    }
  } else if (locationInfo.location && !locationInfo.isComplete) {
    // Incomplete location - keep original query but clean fillers
    logger.info('Incomplete location detected, keeping original query:', { searchQuery, callSid });
  } else {
    // No location - just clean conversational fillers
    logger.info('No location detected, keeping cleaned query:', { searchQuery, callSid });
  }

  // Step 4: Add conversation context if available
  if (callSid && searchQuery !== cleanedQuery) {
    const context = getConversationContext(callSid);
    if (context && context.previousQuery) {
      searchQuery = `${searchQuery} ${context.previousQuery}`;
      logger.info('Added conversation context to query:', { searchQuery, callSid });
    }
  }

  logger.info('Final rewritten query:', { original: query, rewritten: searchQuery, callSid });
  return searchQuery;
}



// Export utility functions for testing
export {
  extractLocationFromQuery,
  detectLocationWithGeocoding
}; 