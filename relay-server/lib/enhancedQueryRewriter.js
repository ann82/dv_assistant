import logger from './logger.js';
import { detectUSLocation, extractLocationFromQuery, detectLocationWithGeocoding } from './enhancedLocationDetector.js';

/**
 * Enhanced Query Rewriter for Domestic Violence Support Assistant
 * 
 * This module handles:
 * 1. Cleaning natural language queries by removing conversational fillers
 * 2. US-only location detection with proper scope handling using geocoding
 * 3. Crafting high-quality search queries for shelter discovery
 */

// Conversational fillers to remove from the start of queries
const CONVERSATIONAL_FILLERS = [
  'hey', 'hi', 'hello', 'good morning', 'good afternoon', 'good evening',
  'can you help me', 'could you help me', 'i need help', 'i need assistance',
  'please help me', 'please assist me', 'i\'m looking for', 'i want to find',
  'i need to find', 'i\'m trying to find', 'i\'m searching for', 'i want to search for',
  'can you find', 'could you find', 'can you search', 'could you search',
  'i need', 'i want', 'i\'m looking', 'i\'m trying', 'i\'m searching',
  'help me find', 'help me search', 'assist me with', 'help me with',
  'excuse me', 'sorry to bother you', 'i was wondering', 'i hope you can help',
  'i hope you can assist', 'i hope you can find', 'i hope you can search'
];

/**
 * Clean conversational fillers from the start of a query
 * @param {string} query - The user query to clean
 * @returns {string} Cleaned query
 */
function cleanConversationalFillers(query) {
  if (!query || typeof query !== 'string') {
    return query;
  }

  let cleaned = query.toLowerCase().trim();
  const original = query.trim();
  
  // Remove consecutive fillers from the start
  let previousLength = 0;
  do {
    previousLength = cleaned.length;
    
    for (const filler of CONVERSATIONAL_FILLERS) {
      // Check if the query starts with the filler (with optional punctuation)
      const fillerPattern = new RegExp(`^${filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[.,!?;]?\\s*`, 'i');
      cleaned = cleaned.replace(fillerPattern, '');
    }
  } while (cleaned.length < previousLength && cleaned.length > 0);
  
  // Clean up extra whitespace and restore original case if needed
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (!cleaned) return original;
  return cleaned;
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

  // If we have a US location, enhance the query for better results
  if (locationInfo.location && locationInfo.isUS) {
    // Check if "shelter" is already in the query
    const hasShelterTerm = /\bshelter\b/i.test(cleanedQuery);
    
    if (!hasShelterTerm) {
      // Add shelter-specific terms for better relevance
      searchQuery = `domestic violence shelter near ${locationInfo.location}`;
    } else {
      // If shelter terms are present, just add "near location"
      searchQuery = `${cleanedQuery} near ${locationInfo.location}`;
    }
    
    // Add site restrictions for better quality results
    searchQuery += ' site:org OR site:gov -site:wikipedia.org -filetype:pdf';
    
    logger.info('Enhanced US query:', { searchQuery, callSid });
  } else if (locationInfo.location && !locationInfo.isUS) {
    // For non-US locations, preserve the location but don't add US-specific enhancements
    logger.info('Non-US location detected:', { location: locationInfo.location, callSid });
    // Keep the original query as-is for non-US locations
  }

  logger.info('Final rewritten query:', { 
    original: query, 
    rewritten: searchQuery, 
    location: locationInfo.location,
    isUS: locationInfo.isUS,
    callSid 
  });

  return searchQuery;
}

/**
 * Test function for query rewriting (synchronous version for testing)
 * @param {string} query - The user query
 * @param {string} intent - The detected intent
 * @returns {Promise<string>} Rewritten query
 */
export async function testQueryRewriting(query, intent = 'find_shelter') {
  return rewriteQuery(query, intent);
}

// Export utility functions for testing
export {
  cleanConversationalFillers,
  extractLocationFromQuery,
  detectLocationWithGeocoding
}; 