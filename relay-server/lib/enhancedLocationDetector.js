import logger from './logger.js';

/**
 * Enhanced Location Detector for Domestic Violence Support Assistant
 * 
 * This module provides intelligent location detection using:
 * 1. Geocoding APIs (Nominatim/OpenStreetMap) for accurate location validation
 * 2. Fallback to hardcoded patterns for reliability
 * 3. Caching for performance
 * 4. US-specific detection for shelter search optimization
 */

// Cache for geocoding results (in-memory, expires after 24 hours)
const LOCATION_CACHE = new Map();
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Fallback hardcoded values (kept for reliability)
const US_STATES = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  // Territories
  'american samoa': 'AS', 'guam': 'GU', 'northern mariana islands': 'MP', 'puerto rico': 'PR', 'us virgin islands': 'VI',
  'district of columbia': 'DC', 'washington dc': 'DC', 'dc': 'DC'
};

const NON_US_COUNTRIES = [
  'afghanistan', 'albania', 'algeria', 'andorra', 'angola', 'antigua and barbuda', 'argentina',
  'armenia', 'australia', 'austria', 'azerbaijan', 'bahamas', 'bahrain', 'bangladesh', 'barbados',
  'belarus', 'belgium', 'belize', 'benin', 'bhutan', 'bolivia', 'bosnia and herzegovina', 'botswana',
  'brazil', 'brunei', 'bulgaria', 'burkina faso', 'burundi', 'cambodia', 'cameroon', 'canada',
  'cape verde', 'central african republic', 'chad', 'chile', 'china', 'colombia', 'comoros',
  'congo', 'costa rica', 'croatia', 'cuba', 'cyprus', 'czech republic', 'denmark', 'djibouti',
  'dominica', 'dominican republic', 'east timor', 'ecuador', 'egypt', 'el salvador', 'equatorial guinea',
  'eritrea', 'estonia', 'ethiopia', 'fiji', 'finland', 'france', 'gabon', 'gambia', 'georgia',
  'germany', 'ghana', 'greece', 'grenada', 'guatemala', 'guinea', 'guinea-bissau', 'guyana',
  'haiti', 'honduras', 'hungary', 'iceland', 'india', 'indonesia', 'iran', 'iraq', 'ireland',
  'israel', 'italy', 'ivory coast', 'jamaica', 'japan', 'jordan', 'kazakhstan', 'kenya',
  'kiribati', 'kuwait', 'kyrgyzstan', 'laos', 'latvia', 'lebanon', 'lesotho', 'liberia',
  'libya', 'liechtenstein', 'lithuania', 'luxembourg', 'macedonia', 'madagascar', 'malawi',
  'malaysia', 'maldives', 'mali', 'malta', 'marshall islands', 'mauritania', 'mauritius',
  'mexico', 'micronesia', 'moldova', 'monaco', 'mongolia', 'montenegro', 'morocco', 'mozambique',
  'myanmar', 'namibia', 'nauru', 'nepal', 'netherlands', 'new zealand', 'nicaragua', 'niger',
  'nigeria', 'north korea', 'norway', 'oman', 'pakistan', 'palau', 'panama', 'papua new guinea',
  'paraguay', 'peru', 'philippines', 'poland', 'portugal', 'qatar', 'romania', 'russia',
  'rwanda', 'saint kitts and nevis', 'saint lucia', 'saint vincent and the grenadines',
  'samoa', 'san marino', 'sao tome and principe', 'saudi arabia', 'senegal', 'serbia',
  'seychelles', 'sierra leone', 'singapore', 'slovakia', 'slovenia', 'solomon islands',
  'somalia', 'south africa', 'south korea', 'south sudan', 'spain', 'sri lanka', 'sudan',
  'suriname', 'sweden', 'switzerland', 'syria', 'taiwan', 'tajikistan', 'tanzania', 'thailand',
  'togo', 'tonga', 'trinidad and tobago', 'tunisia', 'turkey', 'turkmenistan', 'tuvalu',
  'uganda', 'ukraine', 'united arab emirates', 'united kingdom', 'uruguay', 'uzbekistan',
  'vanuatu', 'vatican city', 'venezuela', 'vietnam', 'yemen', 'zambia', 'zimbabwe'
];

const ZIP_CODE_PATTERN = /^\d{5}(-\d{4})?$/;

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
 * Enhanced US location detection using geocoding with fallback
 * @param {string} location - The location string to check
 * @returns {Promise<Object>} Object with isUS flag and normalized location
 */
export async function detectUSLocation(location) {
  if (!location || typeof location !== 'string') {
    return { isUS: false, location: null, scope: 'non-US' };
  }
  
  const normalizedLocation = location.toLowerCase().trim();
  
  // Check cache first
  const cached = getCachedLocation(normalizedLocation);
  if (cached) {
    logger.info('Using cached location data:', { location, cached });
    return cached;
  }
  
  // Quick checks for obvious patterns
  if (ZIP_CODE_PATTERN.test(normalizedLocation)) {
    const result = { isUS: true, location: location.trim(), scope: 'US' };
    cacheLocation(normalizedLocation, result);
    return result;
  }
  
  // Try geocoding first (most accurate)
  try {
    const geocodeResult = await geocodeLocation(location);
    
    if (geocodeResult) {
      const isUS = geocodeResult.countryCode === 'us' || 
                   geocodeResult.country?.toLowerCase() === 'united states';
      
      const result = {
        isUS,
        location: location.trim(),
        scope: isUS ? 'US' : 'non-US',
        geocodeData: geocodeResult
      };
      
      cacheLocation(normalizedLocation, result);
      logger.info('Geocoded location:', { location, result });
      return result;
    }
  } catch (error) {
    logger.warn('Geocoding failed, falling back to pattern matching:', error);
  }
  
  // Fallback to hardcoded pattern matching
  const fallbackResult = detectUSLocationFallback(location);
  cacheLocation(normalizedLocation, fallbackResult);
  return fallbackResult;
}

/**
 * Fallback US location detection using hardcoded patterns
 * @param {string} location - The location string to check
 * @returns {Object} Object with isUS flag and normalized location
 */
function detectUSLocationFallback(location) {
  if (!location || typeof location !== 'string') {
    return { isUS: false, location: null, scope: 'non-US' };
  }
  
  const normalizedLocation = location.toLowerCase().trim();
  
  // Check for ZIP code first (definitely US)
  if (ZIP_CODE_PATTERN.test(normalizedLocation)) {
    return { isUS: true, location: location.trim(), scope: 'US' };
  }
  
  // Check if it's a known non-US country
  const normalizedLocationNoComma = normalizedLocation.replace(/,/g, '');
  for (const country of NON_US_COUNTRIES) {
    if (
      normalizedLocation === country ||
      normalizedLocationNoComma === country ||
      normalizedLocation.endsWith(` ${country}`) ||
      normalizedLocation.includes(`, ${country}`) ||
      normalizedLocation.includes(`${country},`) ||
      normalizedLocation.includes(` ${country} `)
    ) {
      return { isUS: false, location: location.trim(), scope: 'non-US' };
    }
  }
  
  // Check if it contains a US state
  for (const [stateName, stateCode] of Object.entries(US_STATES)) {
    if (normalizedLocation.includes(stateName) || normalizedLocation.includes(stateCode.toLowerCase())) {
      return { isUS: true, location: location.trim(), scope: 'US' };
    }
  }
  
  // If no clear indicators, assume it might be US (for cities without state)
  return { isUS: true, location: location.trim(), scope: 'US' };
}

/**
 * Extract location from query using enhanced patterns
 * @param {string} query - The user query
 * @returns {Object} Object with location info and scope
 */
export function extractLocationFromQuery(query) {
  if (!query || typeof query !== 'string') {
    return { location: null, scope: 'non-US' };
  }

  // Clean the query first by removing common conversational fillers
  const cleanedQuery = cleanConversationalFillers(query);
  
  // Check for incomplete location queries first
  if (isIncompleteLocationQuery(cleanedQuery)) {
    return { location: null, scope: 'incomplete' };
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
    // New pattern for queries like "find shelter home Mumbai" where "home" is a service word
    /find\s+(?:some\s+)?(?:shelter|help|resources?|services?)\s+(?:home|house|place)s?\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    /(?:need|want|looking\s+for)\s+(?:some\s+)?(?:shelter|help|resources?|services?)\s+(?:home|house|place)s?\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    /(?:can\s+you\s+)?(?:help\s+me\s+)?(?:find|get)\s+(?:some\s+)?(?:shelter|help|resources?|services?)\s+(?:home|house|place)s?\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    // Pattern for standalone location names (capitalized)
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:California|CA|Texas|TX|Florida|FL|New\s+York|NY|Illinois|IL|Pennsylvania|PA|Ohio|OH|Georgia|GA|North\s+Carolina|NC|Michigan|MI|New\s+Jersey|NJ|Virginia|VA|Washington|WA|Arizona|AZ|Massachusetts|MA|Tennessee|TN|Indiana|IN|Missouri|MO|Maryland|MD|Colorado|CO|Minnesota|MN|Wisconsin|WI|South\s+Carolina|SC|Alabama|AL|Louisiana|LA|Kentucky|KY|Oregon|OR|Oklahoma|OK|Connecticut|CT|Utah|UT|Iowa|IA|Nevada|NV|Arkansas|AR|Mississippi|MS|Kansas|KS|Vermont|VT|Nebraska|NE|Idaho|ID|West\s+Virginia|WV|Hawaii|HI|New\s+Hampshire|NH|Maine|ME|Montana|MT|Rhode\s+Island|RI|Delaware|DE|South\s+Dakota|SD|North\s+Dakota|ND|Alaska|AK|District\s+of\s+Columbia|DC|Wyoming|WY)\b/i
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
          scope: 'unknown', // Will be determined by detectUSLocation
          isUS: null // Will be determined by detectUSLocation
        };
      }
    }
  }

  // Try to extract standalone location names (common US cities)
  const standaloneLocation = extractStandaloneLocation(cleanedQuery);
  if (standaloneLocation) {
    return {
      location: standaloneLocation,
      scope: 'unknown',
      isUS: null
    };
  }

  return { location: null, scope: 'non-US' };
}

/**
 * Clean conversational fillers from the start of queries
 * @param {string} query - The user query
 * @returns {string} Cleaned query
 */
function cleanConversationalFillers(query) {
  if (!query || typeof query !== 'string') {
    return query;
  }

  const conversationalFillers = [
    'hey', 'hi', 'hello', 'good morning', 'good afternoon', 'good evening',
    'can you help me', 'could you help me', 'i need help', 'i need assistance',
    'please help me', 'please assist me', 'i would like', 'i want to',
    'i am looking for', 'i am searching for', 'i need to find', 'i want to find',
    'can you find', 'could you find', 'can you get', 'could you get',
    'i need some', 'i want some', 'i am looking for some', 'i need to get some',
    'i was wondering', 'i hope you can help', 'i hope you can assist',
    'i hope you can find', 'i hope you can search', 'excuse me', 'sorry to bother you'
  ];

  let cleanedQuery = query.toLowerCase().trim();
  
  // Remove consecutive fillers at the start
  let previousLength = 0;
  while (cleanedQuery.length !== previousLength) {
    previousLength = cleanedQuery.length;
    for (const filler of conversationalFillers) {
      // More aggressive pattern matching
      const fillerPattern = new RegExp(`^\\s*${filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[.,!?;]?\\s*`, 'i');
      cleanedQuery = cleanedQuery.replace(fillerPattern, ' ');
      
      // Also try without punctuation
      const fillerPattern2 = new RegExp(`^\\s*${filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i');
      cleanedQuery = cleanedQuery.replace(fillerPattern2, ' ');
    }
    cleanedQuery = cleanedQuery.trim();
  }

  // If all content was removed, return original
  if (!cleanedQuery) {
    return query;
  }

  return cleanedQuery;
}

/**
 * Clean extracted location by removing common artifacts
 * @param {string} location - The extracted location
 * @returns {string|null} Cleaned location or null if invalid
 */
function cleanExtractedLocation(location) {
  if (!location || typeof location !== 'string') {
    return null;
  }

  let cleaned = location.trim();
  
  // Remove common artifacts
  cleaned = cleaned.replace(/^(a|an|the)\s+/i, ''); // Remove articles
  cleaned = cleaned.replace(/\s+(a|an|the)\s+/gi, ' '); // Remove articles in middle
  cleaned = cleaned.replace(/^(some|any|all)\s+/i, ''); // Remove quantifiers
  cleaned = cleaned.replace(/\s+(some|any|all)\s+/gi, ' '); // Remove quantifiers in middle
  cleaned = cleaned.replace(/^(shelter|help|resource|service)s?\s+/i, ''); // Remove service words
  cleaned = cleaned.replace(/\s+(shelter|help|resource|service)s?\s+/gi, ' '); // Remove service words in middle
  cleaned = cleaned.replace(/^(home|house|place)s?\s+/i, ''); // Remove building words
  cleaned = cleaned.replace(/\s+(home|house|place)s?\s+/gi, ' '); // Remove building words in middle
  
  // Remove trailing punctuation
  cleaned = cleaned.replace(/[?.,!;]+$/, '');
  
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Must have at least 2 characters and contain letters
  if (cleaned.length < 2 || !/[a-zA-Z]/.test(cleaned)) {
    return null;
  }
  
  // Convert to lowercase for consistency
  return cleaned.toLowerCase();
}

/**
 * Extract standalone location names (common US cities)
 * @param {string} query - The cleaned query
 * @returns {string|null} Extracted location or null
 */
function extractStandaloneLocation(query) {
  if (!query || typeof query !== 'string') {
    return null;
  }

  // Common US cities and locations that might appear standalone
  const commonLocations = [
    'san francisco', 'los angeles', 'new york', 'chicago', 'houston', 'phoenix',
    'philadelphia', 'san antonio', 'san diego', 'dallas', 'san jose', 'austin',
    'jacksonville', 'fort worth', 'columbus', 'charlotte', 'san francisco',
    'indianapolis', 'seattle', 'denver', 'washington', 'boston', 'el paso',
    'nashville', 'detroit', 'oklahoma city', 'portland', 'las vegas', 'memphis',
    'louisville', 'baltimore', 'milwaukee', 'albuquerque', 'tucson', 'fresno',
    'sacramento', 'atlanta', 'kansas city', 'long beach', 'colorado springs',
    'raleigh', 'miami', 'virginia beach', 'omaha', 'oakland', 'minneapolis',
    'tulsa', 'arlington', 'tampa', 'new orleans', 'wichita', 'cleveland',
    'bakersfield', 'aurora', 'anaheim', 'honolulu', 'santa ana', 'corpus christi',
    'riverside', 'lexington', 'stockton', 'henderson', 'saint paul', 'st louis',
    'chula vista', 'orlando', 'san jose', 'laredo', 'chandler', 'madison',
    'lubbock', 'scottsdale', 'garland', 'irving', 'fremont', 'irvine',
    'birmingham', 'rochester', 'san bernardino', 'spokane', 'gilbert',
    'arlington', 'montgomery', 'boise', 'richmond', 'des moines',
    'santa clara', 'santa cruz', 'santa barbara', 'santa monica',
    'palo alto', 'mountain view', 'sunnyvale', 'cupertino', 'san mateo',
    'redwood city', 'menlo park', 'burlingame', 'san carlos', 'belmont',
    'foster city', 'san bruno', 'south san francisco', 'daly city',
    'san leandro', 'hayward', 'fremont', 'union city', 'newark',
    'fremont', 'pleasanton', 'livermore', 'dublin', 'san ramon',
    'walnut creek', 'concord', 'antioch', 'brentwood', 'oakley',
    'pittsburg', 'martinez', 'pleasant hill', 'lafayette', 'orinda',
    'moraga', 'danville', 'san rafael', 'novato', 'petaluma',
    'santa rosa', 'napa', 'vallejo', 'fairfield', 'vacaville',
    'davis', 'woodland', 'sacramento', 'roseville', 'rocklin',
    'lincoln', 'auburn', 'grass valley', 'nevada city', 'truckee',
    'tahoe', 'south lake tahoe', 'truckee', 'reno', 'carson city',
    'sparks', 'fernley', 'fallon', 'elko', 'winnemucca'
  ];

  const words = query.toLowerCase().split(/\s+/);
  
  // Look for multi-word locations first
  for (let i = 0; i < words.length - 1; i++) {
    for (let j = i + 1; j <= words.length; j++) {
      const potentialLocation = words.slice(i, j).join(' ');
      if (commonLocations.includes(potentialLocation)) {
        return potentialLocation;
      }
    }
  }
  
  // Look for single-word locations
  for (const word of words) {
    if (commonLocations.includes(word)) {
      return word;
    }
  }
  
  return null;
}

/**
 * Check if a query is an incomplete location query
 * @param {string} query - The cleaned query
 * @returns {boolean} True if the query ends with a location preposition without a location
 */
function isIncompleteLocationQuery(query) {
  if (!query || typeof query !== 'string') {
    return false;
  }

  // Patterns for incomplete location queries
  const incompletePatterns = [
    // Ends with location prepositions
    /\b(?:in|near|around|at|within|close\s+to)\s*[?.,!;]*$/i,
    // Ends with "shelter" + location preposition
    /\b(?:shelter|help|resources?|services?)\s+(?:in|near|around|at|within|close\s+to)\s*[?.,!;]*$/i,
    // Ends with "find" + "shelter" + location preposition
    /\bfind\s+(?:some\s+)?(?:shelter|help|resources?|services?)\s+(?:in|near|around|at|within|close\s+to)\s*[?.,!;]*$/i,
    // Ends with "help me find" + "shelter" + location preposition
    /\b(?:can\s+you\s+)?(?:help\s+me\s+)?(?:find|get)\s+(?:some\s+)?(?:shelter|help|resources?|services?)\s+(?:in|near|around|at|within|close\s+to)\s*[?.,!;]*$/i,
    // Ends with "home" + location preposition
    /\b(?:home|house|place)s?\s+(?:in|near|around|at|within|close\s+to)\s*[?.,!;]*$/i
  ];

  return incompletePatterns.some(pattern => pattern.test(query));
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
  
  // Use geocoding to determine if it's US
  const usLocationInfo = await detectUSLocation(locationInfo.location);
  
  return {
    location: locationInfo.location,
    scope: usLocationInfo.scope,
    isUS: usLocationInfo.isUS,
    geocodeData: usLocationInfo.geocodeData
  };
}

/**
 * Get location coordinates for mapping (if available)
 * @param {string} location - The location string
 * @returns {Promise<Object|null>} Coordinates object or null
 */
export async function getLocationCoordinates(location) {
  if (!location) return null;
  
  const locationInfo = await detectUSLocation(location);
  
  if (locationInfo.geocodeData) {
    return {
      latitude: locationInfo.geocodeData.latitude,
      longitude: locationInfo.geocodeData.longitude
    };
  }
  
  return null;
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache() {
  const now = Date.now();
  for (const [key, value] of LOCATION_CACHE.entries()) {
    if (now - value.timestamp >= CACHE_EXPIRY) {
      LOCATION_CACHE.delete(key);
    }
  }
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  return {
    size: LOCATION_CACHE.size,
    entries: Array.from(LOCATION_CACHE.keys())
  };
}

// Export helper functions for testing
export { 
  detectUSLocationFallback,
  cleanConversationalFillers,
  cleanExtractedLocation,
  extractStandaloneLocation
}; 