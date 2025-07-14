import logger from './logger.js';
import { geocodingIntegration } from '../integrations/geocodingIntegration.js';

/**
 * Enhanced Location Detector for Domestic Violence Support Assistant
 * 
 * This module provides intelligent location detection using:
 * 1. Geocoding APIs (Nominatim/OpenStreetMap) for accurate location validation
 * 2. Fallback to pattern matching for reliability
 * 3. Caching for performance
 * 4. Global location detection with proper state/country specification
 */

// Constants for current location detection
const CURRENT_LOCATION_WORDS = [
  'current location',
  'my location',
  'where i am',
  'my area',
  'my city',
  'my town',
  'current area',
  'current city',
  'current town',
  'near me',
  'close to me',
  'around me',
  'nearby',
  'here',
  'me'
];

// Cache for location detection results
const locationCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Get cached location data
 * @param {string} location - Location string
 * @returns {Object|null} Cached location data or null
 */
function getCachedLocation(location) {
  if (!location) return null;
  
  const normalizedLocation = location.toLowerCase().trim();
  const cached = locationCache.get(normalizedLocation);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }
  
  return null;
}

/**
 * Cache location data
 * @param {string} location - Location string
 * @param {Object} data - Location data to cache
 */
function cacheLocation(location, data) {
  if (!location) return;
  
  const normalizedLocation = location.toLowerCase().trim();
  locationCache.set(normalizedLocation, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Geocode location using GeocodingIntegration
 * @param {string} location - The location string to geocode
 * @returns {Promise<Object>} Geocoding result with country and coordinates
 */
async function geocodeLocation(location) {
  try {
    const result = await geocodingIntegration.geocode(location);
    
    if (!result.success) {
      return null;
    }
    
    return result.data;
  } catch (error) {
    logger.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Enhanced global location detection using geocoding with fallback
 * @param {string} location - The location string to check
 * @returns {Promise<Object>} Object with location info and completeness status
 */
export async function detectLocation(location) {
  if (!location || typeof location !== 'string') {
    return { location: null, scope: 'none', isComplete: false };
  }
  
  const normalizedLocation = location.trim();

  // Check for current-location words FIRST - before any other processing
  if (containsCurrentLocationWord(normalizedLocation)) {
    return { location: null, scope: 'current-location', isComplete: false };
  }
  
  // Normalize whitespace, lowercase, and pad with spaces for phrase matching
  let paddedInput = ' ' + location.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  
  // Sort phrases by length (longest first)
  const sortedPhrases = [...CURRENT_LOCATION_WORDS].sort((a, b) => b.length - a.length);
  
  for (const phrase of sortedPhrases) {
    const phraseWithSpaces = ' ' + phrase + ' ';
    if (paddedInput.includes(phraseWithSpaces)) {
      return { location: null, scope: 'current-location', isComplete: false };
    }
  }

  // Check cache first
  const cached = getCachedLocation(normalizedLocation);
  if (cached) {
    logger.info('Using cached location data:', { location, cached });
    return cached;
  }

  // Try geocoding first (most accurate)
  try {
    const geocodeResult = await geocodeLocation(location);

    if (geocodeResult) {
      // Consider location complete if geocoding succeeded and we have city, state, or country
      const isComplete = !!(geocodeResult.city || geocodeResult.state || geocodeResult.country);
      const result = {
        location: location.trim(),
        scope: isComplete ? 'complete' : 'incomplete',
        isComplete,
        geocodeData: geocodeResult
      };

      cacheLocation(normalizedLocation, result);
      logger.info('Geocoded location:', { location, result });
      return result;
    }
  } catch (error) {
    logger.warn('Geocoding failed, falling back to pattern matching:', error);
  }
  
  // Fallback to pattern matching
  // Double-check that we haven't missed any current-location words
  if (containsCurrentLocationWord(normalizedLocation)) {
    return { location: null, scope: 'current-location', isComplete: false };
  }
  
  const fallbackResult = detectLocationFallback(location);
  
  // If fallbackResult has a US city or state, treat as complete
  if (fallbackResult.location) {
    const usCitiesOrStates = /san francisco|oakland|new york|los angeles|chicago|houston|phoenix|philadelphia|san antonio|san diego|dallas|san jose|austin|jacksonville|fort worth|columbus|charlotte|indianapolis|seattle|denver|washington|boston|el paso|nashville|detroit|oklahoma city|portland|las vegas|memphis|louisville|baltimore|milwaukee|albuquerque|tucson|fresno|sacramento|kansas city|atlanta|miami|colorado springs|raleigh|omaha|long beach|virginia beach|oakland|minneapolis|tulsa|arlington|tampa|new orleans|wichita|cleveland|bakersfield|aurora|anaheim|honolulu|santa ana|riverside|corpus christi|lexington|henderson|stockton|saint paul|cincinnati|st. louis|pittsburgh|greensboro|lincoln|anchorage|plano|orlando|irvine|newark|toledo|durham|chula vista|fort wayne|jersey city|st. petersburg|laredo|madison|chandler|lubbock|scottsdale|reno|buffalo|gilbert|glendale|north las vegas|winston–salem|chesapeake|norfolk|fremont|garland|irving|hialeah|richmond|boise|spokane|baton rouge|des moines|tacoma|san bernardino|modesto|fontana|santa clarita|birmingham|oxnard|fayetteville|moreno valley|rochester|glendale|huntington beach|salt lake city|grand rapids|amarillo|yonkers|aurora|montgomery|akron|little rock|huntsville|augusta|port st. lucie|grand prairie|columbus|tallahassee|overland park|tempe|mckinney|mobile|cape coral|shreveport|frisco|knoxville|worcester|brownsville|vancouver|fort lauderdale|sioux falls|peoria|ontario|jackson|elizabeth|warren|salem|springfield|eugene|pembroke pines|paterson|naperville|bridgeport|savannah|mesquite|killeen|palmdale|alexandria|hayward|clarksville|lakewood|hollywood|pasadena|syracuse|macon|torrance|fullerton|surprise|denton|roseville|thornton|miramar|pasadena|mesquite|olathe|dayton|carrollton|waco|clearwater|west valley city|bellevue|west jordan|richmond|gainesville|cedar rapids|visalia|coral springs|new haven|stamford|concord|kent|santa clara|el monte|topeka|simi valley|springfield|abilene|evansville|athens|vallejo|allentown|norman|beaumont|independence|murfreesboro|ann arbor|springfield|berkeley|peoria|providence|elgin|columbia|fairfield|aspen|boulder|durango|estes park|fort collins|glenwood springs|grand junction|gunnison|leadville|montrose|pueblo|steamboat springs|telluride|vail|alamosa|canon city|craig|delta|eagle|englewood|frisco|georgetown|golden|la junta|lamar|littleton|longmont|louisville|montrose|pagosa springs|parker|ridgway|salida|silverton|sterling|trinidad|walsenburg|wellington|westminster|wheat ridge|yuma|alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming/gi;
    if (usCitiesOrStates.test(fallbackResult.location.toLowerCase())) {
      fallbackResult.isComplete = true;
      fallbackResult.scope = 'complete';
    }
  }
  cacheLocation(normalizedLocation, fallbackResult);
  return fallbackResult;
}

/**
 * Fallback location detection using pattern matching
 * @param {string} location - The location string to check
 * @returns {Object} Object with location info and completeness status
 */
function detectLocationFallback(location) {
  if (!location || typeof location !== 'string') {
    return { location: null, scope: 'none', isComplete: false };
  }
  const normalizedLocation = location.toLowerCase().trim();
  
  // Guard: If this is a current-location phrase, return immediately
  if (containsCurrentLocationWord(normalizedLocation)) {
    return { location: null, scope: 'current-location', isComplete: false };
  }
  
  // Check if it contains state/province and country indicators
  const hasState = /,\s*[A-Z]{2}\b|\b(?:state|province|region|california|texas|florida|new york|illinois|pennsylvania|ohio|georgia|north carolina|michigan|new jersey|virginia|washington|arizona|massachusetts|tennessee|indiana|missouri|maryland|colorado|minnesota|wisconsin|south carolina|alabama|louisiana|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|vermont|nebraska|idaho|west virginia|hawaii|new hampshire|maine|montana|rhode island|delaware|south dakota|north dakota|alaska|wyoming|ontario|quebec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island|northwest territories|nunavut|yukon)\b/i.test(location);
  const hasCountry = /,\s*(?:united states|usa|canada|uk|england|australia|germany|france|india|china|japan|brazil|mexico|spain|italy|netherlands|sweden|norway|denmark|finland|switzerland|austria|belgium|ireland|new zealand|south africa|singapore|malaysia|thailand|vietnam|philippines|indonesia|korea|taiwan|hong kong|israel|turkey|greece|poland|czech|hungary|romania|bulgaria|croatia|serbia|slovenia|slovakia|estonia|latvia|lithuania|iceland|luxembourg|monaco|liechtenstein|andorra|san marino|vatican|malta|cyprus)\b/i.test(location);
  
  const isComplete = hasState || hasCountry;
  
  const result = {
    location: location.trim(),
    scope: isComplete ? 'complete' : 'incomplete',
    isComplete
  };
  
  return result;
}

/**
 * Extract location from query using enhanced patterns
 * @param {string} query - The user query
 * @returns {Object} Object with location info and scope
 */
export function extractLocationFromQuery(query) {
  if (!query || typeof query !== 'string') {
    return { location: null, scope: 'none' };
  }

  logger.info('extractLocationFromQuery DEBUG - Input query:', query);

  // Simple approach: Look for common location patterns in the text
  const text = query.toLowerCase();
  
  // Check for current location indicators first
  logger.info('extractLocationFromQuery DEBUG - Checking containsCurrentLocationWord:', text);
  if (containsCurrentLocationWord(text)) {
    logger.info('extractLocationFromQuery DEBUG - Found current location word, returning current-location scope');
    return { location: null, scope: 'current-location' };
  }
  
  logger.info('extractLocationFromQuery DEBUG - Checking isCurrentLocationQuery:', text);
  if (isCurrentLocationQuery(text)) {
    logger.info('extractLocationFromQuery DEBUG - Found current location query, returning current-location scope');
    return { location: null, scope: 'current-location' };
  }
  
  logger.info('extractLocationFromQuery DEBUG - Checking isIncompleteLocationQuery:', text);
  if (isIncompleteLocationQuery(text)) {
    logger.info('extractLocationFromQuery DEBUG - Found incomplete location query, returning incomplete scope');
    return { location: null, scope: 'incomplete' };
  }
  
  // Check for follow-up questions that shouldn't trigger location extraction
  logger.info('extractLocationFromQuery DEBUG - Checking isFollowUpQuestion:', text);
  if (isFollowUpQuestion(text)) {
    logger.info('extractLocationFromQuery DEBUG - Found follow-up question, returning follow-up scope');
    return { location: null, scope: 'follow-up' };
  }

  // Simple pattern: look for "near [location]" or "in [location]" or "at [location]"
  const simplePatterns = [
    /near\s+([^,.?]+(?:,\s*[^,.?]+)?)/i,
    /in\s+([^,.?]+(?:,\s*[^,.?]+)?)/i,
    /at\s+([^,.?]+(?:,\s*[^,.?]+)?)/i,
    /around\s+([^,.?]+(?:,\s*[^,.?]+)?)/i,
    /within\s+([^,.?]+(?:,\s*[^,.?]+)?)/i,
    /close\s+to\s+([^,.?]+(?:,\s*[^,.?]+)?)/i,
    // New: Look for standalone location names (like "I Station 2")
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Station|Street|Avenue|Road|Drive|Lane|Place|Boulevard|Highway|Freeway|Interstate|Center|Plaza|Mall|Building|Complex|District|Neighborhood|Park|Area|Region|County|City|Town|State|Province|Country))\b/i,
    // New: Look for numbered locations (like "Station 2", "Building 5")
    /\b([A-Z][a-z]*\s+\d+)\b/i
  ];

  logger.info('extractLocationFromQuery DEBUG - Checking simple patterns');
  for (const pattern of simplePatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      const location = match[1].trim();
      logger.info('extractLocationFromQuery DEBUG - Pattern match found:', { pattern: pattern.toString(), location });
      // Clean the location
      const cleanLocation = cleanExtractedLocation(location);
      if (cleanLocation) {
        logger.info('extractLocationFromQuery DEBUG - Simple location extraction found:', { query, location: cleanLocation });
        return {
          location: cleanLocation,
          scope: 'unknown'
        };
      }
    }
  }

  // Fallback: look for capitalized words that might be locations
  // This is more conservative and focuses on actual location patterns
  const words = query.split(/\s+/);
  const potentialLocations = [];
  
  // Common non-location words that should be ignored
  const commonNonLocationWords = [
    'can', 'could', 'would', 'should', 'will', 'may', 'might', 'must', 'shall',
    'yes', 'no', 'okay', 'sure', 'right', 'left', 'here', 'there', 'yeah',
    'help', 'need', 'want', 'looking', 'find', 'get', 'give', 'tell', 'show',
    'know', 'think', 'feel', 'hope', 'wish', 'like', 'love', 'hate', 'want',
    'danger', 'relationship', 'out', 'this', 'that', 'these', 'those',
    'my', 'mine', 'you', 'your', 'yours', 'he', 'she', 'they', 'them',
    'we', 'us', 'our', 'ours', 'i', 'am', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'cannot'
  ];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^\w]/g, '');
    
    // FIXED: More conservative check: must be capitalized, longer than 3 chars OR contain numbers
    // AND must not be a common non-location word
    if (((word.length > 3 && word.charAt(0) === word.charAt(0).toUpperCase()) || /\d/.test(word)) &&
        !commonNonLocationWords.includes(word.toLowerCase())) {
      
      // Look for consecutive capitalized words or words with numbers
      let location = word;
      let j = i + 1;
      
      while (j < words.length) {
        const nextWord = words[j].replace(/[^\w]/g, '');
        // FIXED: Include words with numbers or capitalized words
        if (((nextWord.length > 3 && nextWord.charAt(0) === nextWord.charAt(0).toUpperCase()) || /\d/.test(nextWord)) &&
            !commonNonLocationWords.includes(nextWord.toLowerCase())) {
          location += ' ' + nextWord;
          j++;
        } else {
          break;
        }
      }
      
      // FIXED: More lenient location detection - prefer multi-word locations
      const locationLower = location.toLowerCase();
      
      // Check for strong location indicators
      const strongLocationIndicators = [
        /city|town|state|county|province|country/i,
        /street|avenue|road|drive|lane|place|boulevard|highway|freeway|interstate/i,
        /park|center|plaza|mall|building|complex|district|neighborhood/i,
        /new\s+\w+|north\s+\w+|south\s+\w+|east\s+\w+|west\s+\w+/i,
        /upper\s+\w+|lower\s+\w+|central\s+\w+|downtown|uptown|midtown/i,
        /station|building|area|region|zone|section/i
      ];
      
      const hasStrongIndicator = strongLocationIndicators.some(pattern => pattern.test(locationLower));
      
      // Check for known patterns
      const hasCommaPattern = /^[A-Z][a-z]+,\s*[A-Z][a-z]+$/.test(location);
      const hasNumberPattern = /\d+/.test(location); // Contains numbers (like "Station 2")
      const hasMultipleWords = location.split(' ').length > 1; // Multiple words
      
      // FIXED: Prefer multi-word locations and avoid common non-location words
      if ((hasStrongIndicator || hasCommaPattern || hasNumberPattern || hasMultipleWords) && 
          !commonNonLocationWords.includes(locationLower)) {
        potentialLocations.push(location);
      }
      
      i = j - 1; // Skip the words we've already processed
    }
  }
  
  // FIXED: Return the longest potential location only if we found something that looks like a real location
  if (potentialLocations.length > 0) {
    // Sort by length (longest first) and prefer multi-word locations
    const sortedLocations = potentialLocations.sort((a, b) => {
      const aWords = a.split(' ').length;
      const bWords = b.split(' ').length;
      if (aWords !== bWords) {
        return bWords - aWords; // Prefer multi-word locations
      }
      return b.length - a.length; // Then by total length
    });
    
    const bestLocation = sortedLocations[0];
    logger.info('Fallback location extraction found:', { query, location: bestLocation });
    return {
      location: bestLocation,
      scope: 'unknown'
    };
  }

  // If no location found, return scope: 'none'
  return { location: null, scope: 'none' };
}



/**
 * Clean extracted location by removing common words and normalizing
 * @param {string} location - The location string to clean
 * @returns {string|null} Cleaned location or null if invalid
 */
function cleanExtractedLocation(location) {
  if (!location || typeof location !== 'string') {
    return null;
  }

  let cleaned = location.trim();
  
  // FIXED: Expanded list of non-location words to filter out
  const nonLocationWords = [
    'me', 'here', 'nearby', 'close', 'around', 'somewhere', 'anywhere',
    'can', 'could', 'would', 'should', 'will', 'may', 'might', 'must', 'shall',
    'yes', 'no', 'okay', 'sure', 'right', 'left', 'yeah',
    'help', 'need', 'want', 'looking', 'find', 'get', 'give', 'tell', 'show',
    'know', 'think', 'feel', 'hope', 'wish', 'like', 'love', 'hate',
    'danger', 'relationship', 'out', 'this', 'that', 'these', 'those',
    'my', 'mine', 'you', 'your', 'yours', 'he', 'she', 'they', 'them',
    'we', 'us', 'our', 'ours', 'i', 'am', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'cannot',
    'any', 'but', 'want', 'to', 'get', 'of', 'with', 'that', 'what'
  ];
  
  // FIXED: More aggressive filtering - if the location contains too many non-location words, reject it
  const words = cleaned.split(/\s+/);
  const nonLocationCount = words.filter(word => {
    const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
    return nonLocationWords.includes(cleanWord);
  }).length;
  
  // If more than 50% of words are non-location words, reject the entire location
  if (nonLocationCount > words.length * 0.5) {
    return null;
  }
  
  // Filter out non-location words
  const filteredWords = words.filter(word => {
    const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
    return !nonLocationWords.includes(cleanWord);
  });
  
  if (filteredWords.length === 0) {
    return null;
  }
  
  // FIXED: Preserve original structure and capitalization
  cleaned = filteredWords.join(' ');
  
  // Additional check: if the cleaned location is too short or contains mostly non-location words, reject it
  if (cleaned.length < 3 || cleaned.split(' ').length < 1) {
    return null;
  }
  
  return cleaned || null;
}



/**
 * Check if query is an incomplete location query
 * @param {string} query - The query to check
 * @returns {boolean} True if incomplete location query
 */
function isIncompleteLocationQuery(query) {
  if (!query || typeof query !== 'string') {
    return false;
  }

  const lowerQuery = query.toLowerCase();
  
  // Check for queries that mention location but don't specify where
  const incompletePatterns = [
    /\b(?:find|need|want|looking\s+for)\s+(?:shelter|help|resources?|services?)\s+(?:near|in|around|at)\s*$/i,
    /\b(?:shelter|help|resources?|services?)\s+(?:near|in|around|at)\s*$/i,
    /\b(?:near|in|around|at)\s*$/i,
    /\b(?:location|place|area|city|town)\s*$/i
  ];
  
  return incompletePatterns.some(pattern => pattern.test(lowerQuery));
}

/**
 * Check if query is a current location query
 * @param {string} query - The query to check
 * @returns {boolean} True if current location query
 */
function isCurrentLocationQuery(query) {
  if (!query || typeof query !== 'string') {
    return false;
  }

  const lowerQuery = query.toLowerCase();
  
  // Check for "near me" or "nearby" type queries
  const currentLocationPatterns = [
    /\b(?:near|around|close\s+to)\s+(?:me|here|nearby|my\s+location|current\s+location)\b/i,
    /\b(?:my\s+area|my\s+city|my\s+town|where\s+i\s+am)\b/i,
    /\b(?:current\s+area|current\s+city|current\s+town)\b/i
  ];
  
  return currentLocationPatterns.some(pattern => pattern.test(lowerQuery));
}

/**
 * Check if query is a follow-up question that shouldn't trigger location extraction
 * @param {string} query - The query to check
 * @returns {boolean} True if follow-up question
 */
function isFollowUpQuestion(query) {
  if (!query || typeof query !== 'string') {
    return false;
  }

  const lowerQuery = query.toLowerCase();
  
  // More targeted patterns for follow-up questions that are clearly not location requests
  const followUpPatterns = [
    // Questions about specific services/features of previously mentioned resources
    /\b(?:do|does|can|will|are|is|have|has)\s+(?:any|some|they|them|it|this|that)\s+(?:accept|allow|let|permit|enable|provide|offer)\b/i,
    /\b(?:what\s+about|how\s+about|tell\s+me\s+about)\s+(?:pets?|dogs?|cats?|children|kids?|family|elders?|seniors?)\b/i,
    
    // Questions about specific details of resources
    /\b(?:do|does|can|will|are|is|have|has)\s+(?:they|them|it|this|that)\s+(?:accept|allow|let|permit|enable|provide|offer)\s+(?:pets?|dogs?|cats?|children|kids?|family|elders?|seniors?)\b/i,
    
    // Questions about contact/accessibility information
    /\b(?:what|how)\s+(?:is|are)\s+(?:the|their)\s+(?:phone|number|contact|address|hours|open|close|available)\b/i,
    
    // Questions about costs/payment
    /\b(?:what|how)\s+(?:is|are)\s+(?:the|their)\s+(?:cost|price|free|payment|insurance|medicaid|medicare)\b/i,
    
    // Questions about transportation
    /\b(?:what|how)\s+(?:is|are)\s+(?:the|their)\s+(?:transportation|bus|train|car|drive|walk|distance)\b/i,
    
    // Questions about language support
    /\b(?:do|does|can|will|are|is|have|has)\s+(?:they|them|it|this|that)\s+(?:speak|support|offer)\s+(?:language|spanish|french|german|translator|interpreter)\b/i,
    
    // Questions about accessibility
    /\b(?:do|does|can|will|are|is|have|has)\s+(?:they|them|it|this|that)\s+(?:have|offer|support)\s+(?:wheelchair|accessible|disability|special\s+needs)\b/i
  ];
  
  return followUpPatterns.some(pattern => pattern.test(lowerQuery));
}

/**
 * Enhanced location detection with geocoding
 * @param {string} query - The user query
 * @returns {Promise<Object>} Enhanced location detection result
 */
export async function detectLocationWithGeocoding(query) {
  const locationInfo = extractLocationFromQuery(query);
  
  if (!locationInfo.location) {
    return locationInfo;
  }
  
  // Use geocoding to determine completeness
  const locationData = await detectLocation(locationInfo.location);
  
  logger.info('detectLocationWithGeocoding debug:', { 
    query, 
    locationInfo, 
    locationData,
    hasGeocodeData: !!(locationData?.geocodeData),
    hasCity: !!(locationData?.geocodeData?.city),
    hasState: !!(locationData?.geocodeData?.state),
    hasCountry: !!(locationData?.geocodeData?.country)
  });

  // Force complete if geocoding found city, state, or country
  if (locationData && (locationData.geocodeData?.city || locationData.geocodeData?.state || locationData.geocodeData?.country)) {
    const result = {
      location: locationInfo.location,
      scope: 'complete',
      isComplete: true,
      geocodeData: locationData.geocodeData
    };
    logger.info('detectLocationWithGeocoding: returning complete location:', result);
    return result;
  }

  // If detectLocation returned isComplete: true, use that
  if (locationData && locationData.isComplete) {
    const result = {
      location: locationInfo.location,
      scope: 'complete',
      isComplete: true,
      geocodeData: locationData.geocodeData
    };
    logger.info('detectLocationWithGeocoding: using detectLocation isComplete:', result);
    return result;
  }

  const result = {
    location: locationInfo.location,
    scope: locationData?.scope || 'unknown',
    isComplete: locationData?.isComplete || false,
    geocodeData: locationData?.geocodeData
  };
  logger.info('detectLocationWithGeocoding: returning fallback result:', result);
  return result;
}

/**
 * Get location coordinates for mapping (if available)
 * @param {string} location - The location string
 * @returns {Promise<Object|null>} Coordinates object or null
 */
export async function getLocationCoordinates(location) {
  if (!location) return null;
  
  try {
    const result = await geocodingIntegration.getCoordinates(location);
    
    if (!result.success) {
      return null;
    }
    
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      location: result.location
    };
  } catch (error) {
    logger.error('Error getting coordinates:', error);
    return null;
  }
}



/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  return {
    size: locationCache.size,
    maxAge: CACHE_TTL
  };
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache() {
  const now = Date.now();
  for (const [key, value] of locationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      locationCache.delete(key);
    }
  }
}



// Export helper functions for testing
export { 
  detectLocationFallback,
  cleanExtractedLocation
};

 

function containsCurrentLocationWord(text) {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  
  for (const phrase of CURRENT_LOCATION_WORDS) {
    // For single words like 'here', 'me', use word boundaries
    if (phrase.length <= 4 || phrase.split(' ').length === 1) {
      const wordBoundaryRegex = new RegExp(`\\b${phrase}\\b`, 'i');
      if (wordBoundaryRegex.test(normalized)) {
        return true;
      }
    } else {
      // For multi-word phrases, use simple includes
      if (normalized.includes(phrase)) {
        return true;
      }
    }
  }
  
  // Special case: Only detect "me" when it's part of location-specific phrases
  const locationSpecificMePatterns = [
    /\bnear\s+me\b/i,
    /\bclose\s+to\s+me\b/i,
    /\baround\s+me\b/i,
    /\bshelter\s+(?:near|close\s+to|around)\s+me\b/i,
    /\bresources?\s+(?:near|close\s+to|around)\s+me\b/i,
    /\bservices?\s+(?:near|close\s+to|around)\s+me\b/i
    // Removed /\bhelp\s+me\s+(?:find|locate|get)\b/i as it's too broad and catches valid queries
  ];
  
  return locationSpecificMePatterns.some(pattern => pattern.test(normalized));
} 