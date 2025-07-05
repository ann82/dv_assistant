import logger from './logger.js';

/**
 * Enhanced Location Detector for Domestic Violence Support Assistant
 * 
 * This module provides intelligent location detection using:
 * 1. Geocoding APIs (Nominatim/OpenStreetMap) for accurate location validation
 * 2. Fallback to pattern matching for reliability
 * 3. Caching for performance
 * 4. Global location detection with proper state/country specification
 */

// Cache for geocoding results (in-memory, expires after 24 hours)
const LOCATION_CACHE = new Map();
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Common words to filter out from location detection
const FILTER_WORDS = [
  'me', 'here', 'nearby', 'close', 'around', 'somewhere', 'anywhere',
  'home', 'house', 'place', 'area', 'region', 'zone', 'district'
];

const CURRENT_LOCATION_WORDS = [
  'me', 'my location', 'here', 'near me', 'nearby', 'around me', 'close to me', 'current location'
];

/**
 * Get cached location data
 * @param {string} location - The location string
 * @returns {Object|null} Cached location data or null if not found/expired
 */
function getCachedLocation(location) {
  const normalized = location.toLowerCase().trim();
  const cached = LOCATION_CACHE.get(normalized);
  
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
    return cached.data;
  }
  
  // Remove expired entry
  if (cached) {
    LOCATION_CACHE.delete(normalized);
  }
  
  return null;
}

/**
 * Cache location data
 * @param {string} location - The location string
 * @param {Object} data - The location data to cache
 */
function cacheLocation(location, data) {
  const normalized = location.toLowerCase().trim();
  LOCATION_CACHE.set(normalized, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Geocode location using Nominatim API
 * @param {string} location - The location string to geocode
 * @returns {Promise<Object>} Geocoding result with country and coordinates
 */
async function geocodeLocation(location) {
  try {
    const encodedLocation = encodeURIComponent(location);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedLocation}&limit=1&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DomesticViolenceAssistant/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      return null;
    }
    
    const result = data[0];
    return {
      country: result.address?.country,
      countryCode: result.address?.country_code,
      state: result.address?.state,
      city: result.address?.city || result.address?.town,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      displayName: result.display_name
    };
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
  
  const normalizedLocation = location.toLowerCase().trim();
  
  // Treat current-location words as incomplete (word boundary match)
  if (containsCurrentLocationWord(normalizedLocation)) {
    return { location: null, scope: 'current-location', isComplete: false };
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
  
  // Check if it contains state/province and country indicators
  const hasState = /,\s*[A-Z]{2}\b|\b(?:state|province|region|california|texas|florida|new york|illinois|pennsylvania|ohio|georgia|north carolina|michigan|new jersey|virginia|washington|arizona|massachusetts|tennessee|indiana|missouri|maryland|colorado|minnesota|wisconsin|south carolina|alabama|louisiana|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|vermont|nebraska|idaho|west virginia|hawaii|new hampshire|maine|montana|rhode island|delaware|south dakota|north dakota|alaska|wyoming|ontario|quebec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island|northwest territories|nunavut|yukon)\b/i.test(location);
  const hasCountry = /,\s*(?:united states|usa|canada|uk|england|australia|germany|france|india|china|japan|brazil|mexico|spain|italy|netherlands|sweden|norway|denmark|finland|switzerland|austria|belgium|ireland|new zealand|south africa|singapore|malaysia|thailand|vietnam|philippines|indonesia|korea|taiwan|hong kong|israel|turkey|greece|poland|czech|hungary|romania|bulgaria|croatia|serbia|slovenia|slovakia|estonia|latvia|lithuania|iceland|luxembourg|monaco|liechtenstein|andorra|san marino|vatican|malta|cyprus)\b/i.test(location);
  
  const isComplete = hasState || hasCountry;
  
  return {
    location: location.trim(),
    scope: isComplete ? 'complete' : 'incomplete',
    isComplete
  };
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

  // Clean the query first by removing common conversational fillers
  const cleanedQuery = cleanConversationalFillers(query);
  
  // If query contains current-location words (word boundary match), treat as current-location
  if (containsCurrentLocationWord(cleanedQuery)) {
    return { location: null, scope: 'current-location' };
  }

  // Check for incomplete location queries first
  if (isIncompleteLocationQuery(cleanedQuery)) {
    return { location: null, scope: 'incomplete' };
  }
  
  // Check for "near me" or "nearby" type queries that indicate current location
  if (isCurrentLocationQuery(cleanedQuery)) {
    return { location: null, scope: 'current-location' };
  }
  
  // Enhanced location patterns that handle more conversational contexts
  const locationPatterns = [
    // Direct location patterns
    /in\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    /near\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    /around\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    /at\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    /within\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    /close\s+to\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    // Enhanced patterns for conversational queries
    /find\s+(?:some\s+)?(?:shelter|help|resources?|services?)\s+(?:in|near|around|at|within|close\s+to)\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    /(?:need|want|looking\s+for)\s+(?:some\s+)?(?:shelter|help|resources?|services?)\s+(?:in|near|around|at|within|close\s+to)\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    /(?:can\s+you\s+)?(?:help\s+me\s+)?(?:find|get)\s+(?:some\s+)?(?:shelter|help|resources?|services?)\s+(?:in|near|around|at|within|close\s+to)\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    // Pattern for queries that end with location
    /(?:shelter|help|resources?|services?)\s+(?:in|near|around|at|within|close\s+to)\s+([^,.]+(?:,\s*[^,.]+)?)(?:\s*$|\s*[?.,])/i,
    // Pattern for location at the end of sentence
    /(?:in|near|around|at|within|close\s+to)\s+([^,.]+(?:,\s*[^,.]+)?)(?:\s*$|\s*[?.,])/i,
    // Pattern for queries like "find shelter home Mumbai" where "home" is a service word
    /find\s+(?:some\s+)?(?:shelter|help|resources?|services?)\s+(?:home|house|place)s?\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    /(?:need|want|looking\s+for)\s+(?:some\s+)?(?:shelter|help|resources?|services?)\s+(?:home|house|place)s?\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    /(?:can\s+you\s+)?(?:help\s+me\s+)?(?:find|get)\s+(?:some\s+)?(?:shelter|help|resources?|services?)\s+(?:home|house|place)s?\s+([^,.]+(?:,\s*[^,.]+)?)/i
  ];

  for (const pattern of locationPatterns) {
    const match = cleanedQuery.match(pattern);
    if (match && match[1]) {
      const extractedLocation = match[1].trim();
      // Additional cleaning of the extracted location
      const cleanLocation = cleanExtractedLocation(extractedLocation);
      if (cleanLocation) {
        return {
          location: cleanLocation,
          scope: 'unknown' // Will be determined by detectLocation
        };
      }
    }
  }

  // Try to extract standalone location names
  const standaloneLocation = extractStandaloneLocation(cleanedQuery);
  if (standaloneLocation) {
    return {
      location: standaloneLocation,
      scope: 'unknown'
    };
  }

  // If no location found, return scope: 'none'
  return { location: null, scope: 'none' };
}

/**
 * Clean conversational fillers from query
 * @param {string} query - The query to clean
 * @returns {string} Cleaned query
 */
function cleanConversationalFillers(query) {
  if (!query || typeof query !== 'string') {
    return '';
  }

  let cleaned = query.toLowerCase().trim();
  
  // Remove common conversational fillers
  const fillers = [
    /\b(?:um|uh|er|ah|hmm|well|like|you know|i mean|basically|actually|literally)\b/gi,
    /\b(?:please|can you|could you|would you|will you)\b/gi,
    /\b(?:i need|i want|i'm looking for|i'm trying to find)\b/gi,
    /\b(?:help me|assist me|guide me)\b/gi
  ];
  
  fillers.forEach(filler => {
    cleaned = cleaned.replace(filler, ' ').replace(/\s+/g, ' ').trim();
  });
  
  return cleaned;
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
  
  // Remove common words that shouldn't be treated as locations
  const words = cleaned.toLowerCase().split(/\s+/);
  const filteredWords = words.filter(word => {
    const cleanWord = word.replace(/[^\w]/g, '');
    return !FILTER_WORDS.includes(cleanWord) && cleanWord.length > 1;
  });
  
  if (filteredWords.length === 0) {
    return null;
  }
  
  // Reconstruct the location with proper capitalization
  cleaned = filteredWords.map(word => {
    // Preserve original capitalization for proper nouns
    const originalWord = location.toLowerCase().includes(word) ? 
      location.match(new RegExp(word, 'i'))[0] : word;
    return originalWord.charAt(0).toUpperCase() + originalWord.slice(1).toLowerCase();
  }).join(' ');
  
  return cleaned || null;
}

/**
 * Extract standalone location names from query
 * @param {string} query - The query to extract from
 * @returns {string|null} Extracted location or null
 */
function extractStandaloneLocation(query) {
  if (!query || typeof query !== 'string') {
    return null;
  }

  // Look for capitalized words that might be location names
  const words = query.split(/\s+/);
  const potentialLocations = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^\w]/g, '');
    
    // Check if it's a capitalized word (potential location)
    if (word.length > 2 && word.charAt(0) === word.charAt(0).toUpperCase()) {
      // Look for consecutive capitalized words
      let location = word;
      let j = i + 1;
      
      while (j < words.length) {
        const nextWord = words[j].replace(/[^\w]/g, '');
        if (nextWord.length > 2 && nextWord.charAt(0) === nextWord.charAt(0).toUpperCase()) {
          location += ' ' + nextWord;
          j++;
        } else {
          break;
        }
      }
      
      if (location.length > 2) {
        potentialLocations.push(location);
      }
      
      i = j - 1; // Skip the words we've already processed
    }
  }
  
  // Return the longest potential location
  if (potentialLocations.length > 0) {
    return potentialLocations.sort((a, b) => b.length - a.length)[0];
  }
  
  return null;
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
  
  const locationInfo = await detectLocation(location);
  
  // Only return coordinates if we have valid geocode data and the location matches
  if (locationInfo.geocodeData && locationInfo.geocodeData.latitude && locationInfo.geocodeData.longitude) {
    // Validate that the geocoded location is reasonably close to the requested location
    const geocodedName = locationInfo.geocodeData.displayName || '';
    const requestedLower = location.toLowerCase();
    
    // Check if the requested location appears in the geocoded result
    // This helps filter out cases where geocoding returns a default location
    if (geocodedName.toLowerCase().includes(requestedLower) || 
        requestedLower.includes(locationInfo.geocodeData.city?.toLowerCase() || '')) {
      return {
        latitude: locationInfo.geocodeData.latitude,
        longitude: locationInfo.geocodeData.longitude
      };
    }
  }
  
  return null;
}



/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  return {
    size: LOCATION_CACHE.size,
    maxAge: CACHE_EXPIRY
  };
}



// Export helper functions for testing
export { 
  detectLocationFallback,
  cleanConversationalFillers,
  cleanExtractedLocation,
  extractStandaloneLocation
};

 

function containsCurrentLocationWord(text) {
  if (!text || typeof text !== 'string') return false;
  for (const word of CURRENT_LOCATION_WORDS) {
    // Escape regex special characters in word
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use word boundary regex for each word/phrase
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(text)) return true;
  }
  return false;
} 