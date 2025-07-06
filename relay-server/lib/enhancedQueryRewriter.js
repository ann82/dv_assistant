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

  // Step 2: Extract and validate location using enhanced geocoding
  const locationInfo = await detectLocationWithGeocoding(cleanedQuery);
  logger.info('Location detection result:', { locationInfo, callSid });

  // Step 3: Build optimized search query
  let searchQuery = cleanedQuery;

  // Always add 'domestic violence shelter' for resource-seeking intents
  if (['find_shelter', 'legal_services', 'counseling_services', 'emergency_help', 'other_resources'].includes(intent)) {
    let locationPart = locationInfo.location && locationInfo.isComplete ? ` ${locationInfo.location}` : '';
    searchQuery = `"domestic violence shelter"${locationPart}`;
    
    // Add specific resource details for all queries
    if (intent === 'find_shelter') {
      searchQuery += ' "shelter name" "address" "phone number"';
    } else if (intent === 'legal_services') {
      searchQuery += ' "legal aid" "attorney" "lawyer"';
    } else if (intent === 'counseling_services') {
      searchQuery += ' "counseling" "therapy" "support group"';
    }
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