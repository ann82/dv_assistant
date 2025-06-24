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
let CONVERSATIONAL_FILLERS = [
  'hey', 'hi', 'hello', 'good morning', 'good afternoon', 'good evening',
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
function cleanConversationalFillers(query) {
  if (!query || typeof query !== 'string') {
    return query;
  }

  let cleaned = query.trim();
  let original = cleaned;

  // Remove consecutive fillers at the start
  let previousLength = 0;
  while (cleaned.length !== previousLength) {
    previousLength = cleaned.length;
    for (const filler of CONVERSATIONAL_FILLERS) {
      // More aggressive pattern matching that handles punctuation
      const fillerPattern = new RegExp(`^\\s*${filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[.,!?;]?\\s*`, 'i');
      if (fillerPattern.test(cleaned)) {
        cleaned = cleaned.replace(fillerPattern, '');
      }
    }
  }

  // If we removed everything, return the original
  if (cleaned.trim() === '') {
    return original;
  }

  return cleaned.trim();
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
    return query || '';
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
  } else {
    // No location found - create a general shelter search query
    logger.info('No location found, creating general shelter search query:', { callSid });
    
    // Check if "shelter" is already in the query
    const hasShelterTerm = /\bshelter\b/i.test(cleanedQuery);
    
    if (!hasShelterTerm) {
      // Add shelter-specific terms for better relevance
      searchQuery = `domestic violence shelter ${cleanedQuery}`;
    }
    
    // Add site restrictions for better quality results
    searchQuery += ' site:org OR site:gov -site:wikipedia.org -filetype:pdf';
    
    logger.info('General shelter query:', { searchQuery, callSid });
  }

  // Ensure we always return a valid string
  if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim() === '') {
    searchQuery = 'domestic violence shelter resources site:org OR site:gov';
    logger.warn('Empty search query, using fallback:', { searchQuery, callSid });
  }

  logger.info('Final rewritten query:', { 
    original: query, 
    rewritten: searchQuery, 
    location: locationInfo.location,
    isUS: locationInfo.isUS,
    callSid 
  });

  return searchQuery.trim();
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