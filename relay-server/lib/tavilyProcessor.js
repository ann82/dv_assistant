import logger from './logger.js';

/**
 * Process Tavily search results to create voice and SMS responses
 * @param {Object} tavilyResponse - The raw Tavily API response
 * @param {string} userQuery - The original user query for context
 * @param {number} maxResults - Maximum number of results to include (default: 3)
 * @returns {Object} Object containing voiceResponse and smsResponse
 */
export function processTavilyResponse(tavilyResponse, userQuery, maxResults = 3) {
  try {
    logger.info('Processing Tavily response:', {
      query: userQuery,
      resultCount: tavilyResponse?.results?.length || 0,
      maxResults
    });

    // Validate input
    if (!tavilyResponse || !tavilyResponse.results || !Array.isArray(tavilyResponse.results)) {
      return {
        voiceResponse: "I'm sorry, I couldn't find any shelters in that area. Would you like me to search for resources in a different location?",
        smsResponse: "No shelters found in that area. Please try a different location or contact the National Domestic Violence Hotline at 1-800-799-7233."
      };
    }

    // Sort results by score (highest first) and take top results
    const sortedResults = tavilyResponse.results
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, maxResults);

    if (sortedResults.length === 0) {
      return {
        voiceResponse: "I'm sorry, I couldn't find any shelters in that area. Would you like me to search for resources in a different location?",
        smsResponse: "No shelters found in that area. Please try a different location or contact the National Domestic Violence Hotline at 1-800-799-7233."
      };
    }

    // Extract location from user query for context
    const location = extractLocationFromQuery(userQuery);
    
    // Create voice response
    const voiceResponse = createVoiceResponse(sortedResults, location);
    
    // Create SMS response with clickable links
    const smsResponse = createSMSResponse(sortedResults, location);

    logger.info('Tavily response processed successfully:', {
      originalCount: tavilyResponse.results.length,
      processedCount: sortedResults.length,
      location,
      voiceResponseLength: voiceResponse.length,
      smsResponseLength: smsResponse.length
    });

    return {
      voiceResponse,
      smsResponse
    };

  } catch (error) {
    logger.error('Error processing Tavily response:', error);
    return {
      voiceResponse: "I'm sorry, I encountered an error while searching for shelters. Please try again.",
      smsResponse: "Error processing shelter search. Please try again or contact the National Domestic Violence Hotline at 1-800-799-7233."
    };
  }
}

/**
 * Extract location from user query
 * @param {string} query - The user query
 * @returns {string} Extracted location or empty string
 */
function extractLocationFromQuery(query) {
  if (!query) return '';
  
  // Common patterns for location extraction
  const locationPatterns = [
    /in\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    /near\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    /around\s+([^,.]+(?:,\s*[^,.]+)?)/i,
    /at\s+([^,.]+(?:,\s*[^,.]+)?)/i
  ];

  for (const pattern of locationPatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}

/**
 * Create voice response from top results
 * @param {Array} results - Top results sorted by score
 * @param {string} location - Extracted location
 * @returns {string} Voice-friendly response
 */
function createVoiceResponse(results, location) {
  const locationText = location ? ` in ${location}` : '';
  
  if (results.length === 1) {
    const result = results[0];
    const title = cleanTitleForVoice(result.title);
    return `I found a shelter${locationText}: ${title}. How else can I help you today?`;
  }

  // Extract organization names from titles
  const organizationNames = results.map(result => {
    return cleanTitleForVoice(result.title);
  });

  // Create natural-sounding list
  let response = `I found ${results.length} shelters${locationText}`;
  
  if (organizationNames.length === 2) {
    response += `: ${organizationNames[0]} and ${organizationNames[1]}`;
  } else if (organizationNames.length === 3) {
    response += `: ${organizationNames[0]}, ${organizationNames[1]}, and ${organizationNames[2]}`;
  } else {
    response += ` including ${organizationNames[0]} and ${organizationNames[1]}`;
  }

  response += '. How else can I help you today?';
  return response;
}

/**
 * Create SMS response with clickable links
 * @param {Array} results - Top results sorted by score
 * @param {string} location - Extracted location
 * @returns {string} SMS response with links
 */
function createSMSResponse(results, location) {
  const locationText = location ? ` in ${location}` : '';
  
  let smsResponse = `Shelters${locationText}:\n\n`;
  
  results.forEach((result, index) => {
    const title = cleanTitleForSMS(result.title);
    const url = result.url;
    
    smsResponse += `${index + 1}. ${title}\n`;
    smsResponse += `   ${url}\n\n`;
  });

  smsResponse += "For immediate help, call the National Domestic Violence Hotline: 1-800-799-7233";
  
  return smsResponse;
}

/**
 * Clean title for voice response (remove unwanted prefixes/suffixes)
 * @param {string} title - Original title
 * @returns {string} Cleaned title for voice
 */
function cleanTitleForVoice(title) {
  if (!title) return 'Unknown Organization';
  
  let cleanTitle = title
    // Remove common prefixes
    .replace(/^\[.*?\]\s*/, '')  // Remove [PDF], [DOC], etc.
    .replace(/^THE BEST \d+ /i, '')  // Remove "THE BEST 10" etc.
    .replace(/^Best \d+ /i, '')  // Remove "Best 5" etc.
    .replace(/^Best /i, '')  // Remove "Best" prefix
    
    // Remove common suffixes
    .replace(/\s*-\s*Yelp$/i, '')  // Remove "- Yelp"
    .replace(/\s*-\s*The Real Yellow.*$/i, '')  // Remove "- The Real Yellow..."
    .replace(/\s*-\s*.*$/i, '')  // Remove other "-" suffixes
    
    // Remove location suffixes
    .replace(/\s*,\s*[A-Z]{2}$/i, '')  // Remove ", CA", ", NY", etc.
    .replace(/\s*in\s+[^,]+(?:,\s*[A-Z]{2})?$/i, '')  // Remove "in South Lake Tahoe, CA"
    
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();

  // If title is too long for voice, truncate it
  if (cleanTitle.length > 50) {
    cleanTitle = cleanTitle.substring(0, 47) + '...';
  }

  return cleanTitle || 'Unknown Organization';
}

/**
 * Clean title for SMS response
 * @param {string} title - Original title
 * @returns {string} Cleaned title for SMS
 */
function cleanTitleForSMS(title) {
  if (!title) return 'Unknown Organization';
  
  let cleanTitle = title
    // Remove common prefixes
    .replace(/^\[.*?\]\s*/, '')  // Remove [PDF], [DOC], etc.
    .replace(/^THE BEST \d+ /i, '')  // Remove "THE BEST 10" etc.
    .replace(/^Best \d+ /i, '')  // Remove "Best 5" etc.
    .replace(/^Best /i, '')  // Remove "Best" prefix
    
    // Remove common suffixes
    .replace(/\s*-\s*Yelp$/i, '')  // Remove "- Yelp"
    .replace(/\s*-\s*The Real Yellow.*$/i, '')  // Remove "- The Real Yellow..."
    .replace(/\s*-\s*.*$/i, '')  // Remove other "-" suffixes
    
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();

  return cleanTitle || 'Unknown Organization';
}

/**
 * Get detailed information about a specific result
 * @param {Object} result - Tavily result object
 * @returns {Object} Detailed information
 */
export function getResultDetails(result) {
  return {
    title: cleanTitleForSMS(result.title),
    url: result.url,
    score: result.score,
    content: result.content,
    phoneNumbers: extractPhoneNumbers(result.content),
    address: extractAddress(result.content)
  };
}

/**
 * Extract phone numbers from content
 * @param {string} content - Content to search
 * @returns {Array} Array of phone numbers found
 */
function extractPhoneNumbers(content) {
  if (!content) return [];
  
  const phonePatterns = [
    /(\d{3}[-.]?\d{3}[-.]?\d{4})/g,  // Standard US format
    /(\d{1}[-.]?\d{3}[-.]?\d{3}[-.]?\d{4})/g,  // 1-800 format
    /\((\d{3})\)\s*(\d{3})[-.]?(\d{4})/g  // (555) 123-4567 format
  ];

  const phoneNumbers = [];
  
  phonePatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      phoneNumbers.push(...matches);
    }
  });

  return [...new Set(phoneNumbers)]; // Remove duplicates
}

/**
 * Extract address from content
 * @param {string} content - Content to search
 * @returns {string} Extracted address or empty string
 */
function extractAddress(content) {
  if (!content) return '';
  
  // Simple address pattern (can be enhanced)
  const addressPattern = /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Way|Circle|Cir|Terrace|Ter)[^,]*)/i;
  
  const match = content.match(addressPattern);
  return match ? match[1].trim() : '';
} 