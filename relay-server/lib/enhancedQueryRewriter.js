import logger from './logger.js';
import { extractLocationFromQuery, detectLocationWithGeocoding } from './enhancedLocationDetector.js';
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

  // Step 2: Get conversation context for location only
  let locationInfo = { location: null, isComplete: false, scope: 'none' };
  
  if (callSid) {
    const context = getConversationContext(callSid);
    if (context) {
      // Check if this is a follow-up question (doesn't contain location keywords)
      const isFollowUpQuestion = !cleanedQuery.toLowerCase().match(/\b(?:in|at|near|around|close to|within)\b/);
      const hasPreviousLocation = context.lastQueryContext?.location;
      
      // For follow-up questions, prioritize conversation context over new location extraction
      if (isFollowUpQuestion && hasPreviousLocation) {
        // Use previous location instead of trying to extract from follow-up question
        locationInfo.location = context.lastQueryContext.location;
        locationInfo.isComplete = true;
        locationInfo.scope = 'complete';
        logger.info('Using previous location for follow-up question:', { 
          previousLocation: context.lastQueryContext.location,
          isFollowUpQuestion,
          callSid 
        });
      } else if (!locationInfo.location && hasPreviousLocation) {
        // Use previous location if current query doesn't have one
        locationInfo.location = context.lastQueryContext.location;
        locationInfo.isComplete = true;
        logger.info('Using previous location from context:', { 
          previousLocation: context.lastQueryContext.location, 
          callSid 
        });
      }
    }
  }

  // Step 3: Only extract location if the intent is a location-seeking one
  const locationSeekingIntents = ['find_shelter', 'legal_services', 'counseling_services', 'other_resources'];
  const isLocationSeekingIntent = locationSeekingIntents.includes(intent);
  
  if (isLocationSeekingIntent && !locationInfo.location) {
    // Only extract location if we don't already have one from context
    try {
      locationInfo = await detectLocationWithGeocoding(cleanedQuery);
      logger.info('Location detection result for location-seeking intent:', { locationInfo, intent, callSid });
    } catch (locationError) {
      logger.error('Error detecting location in query rewriter:', locationError);
      // Continue without location
    }
  } else if (!isLocationSeekingIntent) {
    logger.info('Skipping location extraction for non-location-seeking intent in query rewriter:', { intent, callSid });
  }

  // Step 4: Build clean, focused search query
  let searchQuery = cleanedQuery;

  // For resource-seeking intents, enhance the query while preserving user's specific terms
  if (['find_shelter', 'legal_services', 'counseling_services', 'emergency_help', 'other_resources'].includes(intent)) {
    // Start with the cleaned user query
    let enhancedQuery = cleanedQuery;
    
    // Add location if detected and not already in the query
    if (locationInfo.location && locationInfo.isComplete && !cleanedQuery.toLowerCase().includes(locationInfo.location.toLowerCase())) {
      enhancedQuery += ` ${locationInfo.location}`;
    }
    
    // Add specific resource terms based on intent (simplified for better performance)
    if (intent === 'find_shelter') {
      enhancedQuery += ' domestic violence shelter OR emergency housing OR domestic shelter homes';
    } else if (intent === 'legal_services') {
      enhancedQuery += ' legal aid attorney';
    } else if (intent === 'counseling_services') {
      enhancedQuery += ' counseling therapy';
    } else {
      // For other resource intents, add general domestic violence terms
      enhancedQuery += ' domestic violence help';
    }
    
    searchQuery = enhancedQuery;
  }

  // Step 5: Clean up the final query to ensure it's focused and not too long
  searchQuery = searchQuery
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim()
    .substring(0, 200); // Limit query length to prevent timeouts

  logger.info('Final rewritten query:', { original: query, rewritten: searchQuery, callSid });
  return searchQuery;
}



// Export utility functions for testing
export {
  extractLocationFromQuery,
  detectLocationWithGeocoding
}; 