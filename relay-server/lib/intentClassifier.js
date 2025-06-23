import { OpenAI } from 'openai';
import { config } from './config.js';
import logger from './logger.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

const intentSchema = {
  name: 'classify_intent',
  description: 'Classify the user query into one of the predefined intents',
  parameters: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: [
          'find_shelter',
          'legal_services',
          'counseling_services',
          'emergency_help',
          'general_information',
          'other_resources',
          'off_topic'
        ],
        description: 'The classified intent of the user query'
      }
    },
    required: ['intent']
  }
};

// Add conversation context handling
const conversationContexts = new Map();

export function updateConversationContext(callSid, intent, query, response, tavilyResults = null, matchedResult = null) {
  if (!conversationContexts.has(callSid)) {
    conversationContexts.set(callSid, {
      history: [],
      lastIntent: null,
      lastQuery: null,
      lastResponse: null,
      lastQueryContext: null
    });
  }

  const context = conversationContexts.get(callSid);
  context.history.push({
    intent,
    query,
    response,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 5 interactions
  if (context.history.length > 5) {
    context.history.shift();
  }

  context.lastIntent = intent;
  context.lastQuery = query;
  context.lastResponse = response;

  // Update lastQueryContext with structured data for follow-ups
  if (tavilyResults && tavilyResults.results && tavilyResults.results.length > 0) {
    const location = extractLocationFromQuery(query);
    context.lastQueryContext = {
      intent: intent,
      location: location,
      results: tavilyResults.results.slice(0, 3), // Top 3 results
      timestamp: Date.now(),
      smsResponse: response.smsResponse || null,
      voiceResponse: response.voiceResponse || null
    };
  } else if (matchedResult) {
    // Update context with focus tracking for follow-up responses
    if (context.lastQueryContext) {
      context.lastQueryContext.focusResultTitle = cleanResultTitle(matchedResult.title);
      context.lastQueryContext.matchedResult = matchedResult;
      context.lastQueryContext.timestamp = Date.now(); // Refresh timestamp
    }
  }

  logger.info('Updated conversation context:', {
    callSid,
    intent,
    historyLength: context.history.length,
    hasLastQueryContext: !!context.lastQueryContext,
    focusResultTitle: context.lastQueryContext?.focusResultTitle || null
  });
}

// Helper function to extract location from query
function extractLocationFromQuery(query) {
  if (!query) return null;
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
  return null;
}

export function getConversationContext(callSid) {
  const context = conversationContexts.get(callSid);
  
  // Check timeout for lastQueryContext (5 minutes)
  if (context && context.lastQueryContext) {
    const timeSinceLastQuery = Date.now() - context.lastQueryContext.timestamp;
    const timeoutMs = 5 * 60 * 1000; // 5 minutes
    
    if (timeSinceLastQuery > timeoutMs) {
      logger.info('Clearing lastQueryContext due to timeout:', {
        callSid,
        timeSinceLastQuery: Math.round(timeSinceLastQuery / 1000) + 's',
        timeoutMs: Math.round(timeoutMs / 1000) + 's'
      });
      context.lastQueryContext = null;
    }
  }
  
  return context || null;
}

export function clearConversationContext(callSid) {
  conversationContexts.delete(callSid);
  logger.info('Cleared conversation context for call:', callSid);
}

/**
 * Rewrites a query based on the detected intent to improve search results
 * @param {string} query - The original user query
 * @param {string} intent - The detected intent
 * @param {string} callSid - The call SID for conversation context
 * @returns {string} The rewritten query
 */
export function rewriteQuery(query, intent, callSid = null) {
  // Convert query to lowercase for consistent matching
  const lowerQuery = query.toLowerCase();
  
  // Initialize rewritten query with original
  let rewrittenQuery = query;

  // Get conversation context if available
  const context = callSid ? getConversationContext(callSid) : null;

  // Define off-topic patterns that should NOT be rewritten
  const offTopicPatterns = [
    /joke|funny|humor|comedy|comic/i,
    /weather|temperature|forecast/i,
    /sports|game|team|basketball|football|baseball/i,
    /music|song|artist|band|concert/i,
    /movie|film|actor|actress/i,
    /food|restaurant|cooking|recipe/i,
    /travel|vacation|trip|destination/i
  ];

  // Check if current query is off-topic
  const isCurrentQueryOffTopic = offTopicPatterns.some(pattern => pattern.test(lowerQuery));

  // Handle follow-up questions
  let isFollowUp = false;
  if (context && context.lastIntent) {
    // Check for follow-up patterns
    const followUpPatterns = {
      find_shelter: [
        /(?:what|where|how|can|could)\s+(?:about|is|are|do|does)\s+(?:the|those|these|that)\s+(?:shelters?|homes?|places?)/i,
        /(?:tell|give)\s+(?:me)?\s+(?:more|additional)\s+(?:information|details|about)\s+(?:the|those|these|that)\s+(?:shelters?|homes?|places?)/i
      ],
      legal_services: [
        /(?:what|where|how|can|could)\s+(?:about|is|are|do|does)\s+(?:the|those|these|that)\s+(?:legal|lawyer|attorney|services?)/i,
        /(?:tell|give)\s+(?:me)?\s+(?:more|additional)\s+(?:information|details|about)\s+(?:the|those|these|that)\s+(?:legal|lawyer|attorney|services?)/i
      ],
      counseling_services: [
        /(?:what|where|how|can|could)\s+(?:about|is|are|do|does)\s+(?:the|those|these|that)\s+(?:counseling|therapy|support|groups?)/i,
        /(?:tell|give)\s+(?:me)?\s+(?:more|additional)\s+(?:information|details|about)\s+(?:the|those|these|that)\s+(?:counseling|therapy|support|groups?)/i
      ]
    };

    // Check if this is a follow-up question
    const patterns = followUpPatterns[context.lastIntent] || [];
    isFollowUp = patterns.some(pattern => pattern.test(lowerQuery));

    if (isFollowUp) {
      // Check if the original conversation was off-topic
      const wasOriginalOffTopic = context.lastQuery && offTopicPatterns.some(pattern => 
        pattern.test(context.lastQuery.toLowerCase())
      );

      if (wasOriginalOffTopic) {
        // If original was off-topic, don't rewrite - return as-is
        logger.info('Follow-up to off-topic query detected, no rewriting:', {
          originalQuery: query,
          lastQuery: context.lastQuery,
          isFollowUp: true
        });
        return query;
      } else {
        // Use the last query's context for the follow-up
        rewrittenQuery = `${context.lastQuery} ${query}`;
        logger.info('Detected follow-up question:', {
          originalQuery: query,
          lastQuery: context.lastQuery,
          combinedQuery: rewrittenQuery
        });
      }
    }
  }

  // If current query is off-topic and not a follow-up, don't rewrite
  if (isCurrentQueryOffTopic && !isFollowUp) {
    logger.info('Off-topic query detected, no rewriting:', {
      originalQuery: query,
      isOffTopic: true
    });
    return query;
  }

  // Add "domestic violence" context if not present AND query is relevant
  if (!lowerQuery.includes('domestic violence') && !lowerQuery.includes('domestic abuse')) {
    // Only add domestic violence context if query is support-related
    const supportRelatedPatterns = [
      /help|support|assistance|resource/i,
      /shelter|housing|safe|refuge/i,
      /legal|lawyer|attorney|court/i,
      /counseling|therapy|support group|mental health/i,
      /emergency|urgent|crisis|danger/i,
      /abuse|violence|domestic|relationship/i,
      /hotline|helpline|phone|call/i
    ];

    const isSupportRelated = supportRelatedPatterns.some(pattern => pattern.test(lowerQuery));
    
    if (isSupportRelated || isFollowUp) {
      rewrittenQuery = `domestic violence ${rewrittenQuery}`;
    }
  }

  // Intent-specific query enhancements (only for support-related queries)
  if (intent !== 'off_topic') {
    switch (intent) {
      case 'find_shelter':
        if (!lowerQuery.includes('shelter') && !lowerQuery.includes('safe housing')) {
          rewrittenQuery = `${rewrittenQuery} emergency shelter safe housing`;
        }
        // Add specific terms to target actual shelter organizations
        if (!lowerQuery.includes('organization') && !lowerQuery.includes('center') && !lowerQuery.includes('services')) {
          rewrittenQuery = `${rewrittenQuery} shelter organization center services`;
        }
        // Exclude general information and focus on specific shelters
        rewrittenQuery = `${rewrittenQuery} -site:wikipedia.org -site:gov -filetype:pdf`;
        break;

      case 'legal_services':
        if (!lowerQuery.includes('legal') && !lowerQuery.includes('lawyer') && !lowerQuery.includes('attorney')) {
          rewrittenQuery = `${rewrittenQuery} legal aid attorney services`;
        }
        if (!lowerQuery.includes('restraining order') && !lowerQuery.includes('protection order')) {
          rewrittenQuery = `${rewrittenQuery} restraining order protection`;
        }
        break;

      case 'counseling_services':
        if (!lowerQuery.includes('counseling') && !lowerQuery.includes('therapy') && !lowerQuery.includes('support group')) {
          rewrittenQuery = `${rewrittenQuery} counseling therapy support group`;
        }
        break;

      case 'emergency_help':
        if (!lowerQuery.includes('emergency') && !lowerQuery.includes('urgent')) {
          rewrittenQuery = `emergency urgent ${rewrittenQuery}`;
        }
        if (!lowerQuery.includes('hotline') && !lowerQuery.includes('24/7')) {
          rewrittenQuery = `${rewrittenQuery} 24/7 hotline immediate assistance`;
        }
        break;

      case 'general_information':
        if (!lowerQuery.includes('information') && !lowerQuery.includes('resources')) {
          rewrittenQuery = `${rewrittenQuery} information resources guide`;
        }
        break;

      case 'other_resources':
        if (!lowerQuery.includes('resources') && !lowerQuery.includes('support')) {
          rewrittenQuery = `${rewrittenQuery} support resources assistance`;
        }
        break;
    }
  }

  // Add location context if present in original query
  const locationMatch = lowerQuery.match(/(?:in|near|around|at)\s+([^,.]+?(?:,\s*[A-Za-z\s]+)?)/i);
  if (locationMatch) {
    const location = locationMatch[1].trim();
    if (!rewrittenQuery.includes(location)) {
      rewrittenQuery = `${rewrittenQuery} in ${location}`;
    }
  }

  logger.info('Query rewritten:', {
    original: query,
    rewritten: rewrittenQuery,
    intent,
    isFollowUp: isFollowUp,
    isOffTopic: isCurrentQueryOffTopic
  });

  return rewrittenQuery;
}

/**
 * Classifies a user query into one of the predefined intents using GPT-3.5-turbo
 * @param {string} query - The user query to classify
 * @returns {Promise<string>} The classified intent
 */
export async function getIntent(query) {
  try {
    logger.info('Classifying intent for query:', { query });

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Classify the query into one of these categories:
            - find_shelter: For requests about finding shelter homes or safe housing
            - legal_services: For requests about legal help, restraining orders, or legal rights
            - counseling_services: For requests about counseling, therapy, or emotional support
            - emergency_help: For urgent situations requiring immediate assistance
            - general_information: For general questions about domestic violence
            - other_resources: For other types of support or resources
            - off_topic: For requests unrelated to domestic violence support (jokes, weather, sports, etc.)`
        },
        {
          role: 'user',
          content: query
        }
      ],
      functions: [intentSchema],
      function_call: { name: 'classify_intent' }
    });

    const functionCall = response.choices[0].message.function_call;
    if (!functionCall) {
      logger.warn('No function call returned from GPT-3.5-turbo');
      return 'general_information';
    }

    const result = JSON.parse(functionCall.arguments);
    logger.info('Intent classification result:', result);
    return result.intent;

  } catch (error) {
    logger.error('Error classifying intent:', error);
    return 'general_information';
  }
}

// Helper functions for intent-based routing
export const intentHandlers = {
  find_shelter: async (query) => {
    // Handle shelter search queries
    return 'shelter_search';
  },
  legal_services: async (query) => {
    // Handle legal service queries
    return 'legal_resource_search';
  },
  counseling_services: async (query) => {
    // Handle counseling service queries
    return 'counseling_resource_search';
  },
  emergency_help: async (query) => {
    // Handle emergency situations
    return 'emergency_response';
  },
  general_information: async (query) => {
    // Handle general information requests
    return 'information_search';
  },
  other_resources: async (query) => {
    // Handle other resource queries
    return 'resource_search';
  },
  off_topic: async (query) => {
    // Handle off-topic requests
    return 'off_topic_response';
  }
};

// Helper function to check if a query is resource-related
export function isResourceQuery(intent) {
  return ['find_shelter', 'legal_services', 'counseling_services', 'other_resources'].includes(intent);
}

// Helper function to check if a query needs factual information
export function needsFactualInfo(intent) {
  return ['general_information', 'find_shelter', 'legal_services', 'counseling_services'].includes(intent);
}

// Helper function to check if a query is emergency-related
export function isEmergencyQuery(intent) {
  return intent === 'emergency_help';
}

// Helper function to check if a query is off-topic
export function isOffTopicQuery(intent) {
  return intent === 'off_topic';
}

/**
 * Handle follow-up questions based on previous query context
 * @param {string} query - The current user query
 * @param {Object} lastQueryContext - The context from the previous query
 * @returns {Object|null} FollowUpResponse or null if not a follow-up
 */
export async function handleFollowUp(query, lastQueryContext) {
  if (!lastQueryContext || !lastQueryContext.intent) {
    return null;
  }

  // Check if lastQueryContext is recent (within 5 minutes)
  const timeSinceLastQuery = Date.now() - lastQueryContext.timestamp;
  const maxAgeMs = 5 * 60 * 1000; // 5 minutes
  
  if (timeSinceLastQuery > maxAgeMs) {
    logger.info('Follow-up context too old:', {
      timeSinceLastQuery: Math.round(timeSinceLastQuery / 1000) + 's',
      maxAgeMs: Math.round(maxAgeMs / 1000) + 's'
    });
    return null;
  }

  // Step 1: Try fast pattern matching first (cost-effective)
  const lowerQuery = query.toLowerCase();
  const followUpIndicators = [
    'more', 'details', 'information', 'about', 'tell me', 'what about',
    'first', 'second', 'third', 'fourth', 'fifth', '1st', '2nd', '3rd', '4th', '5th',
    'that one', 'this one', 'the one', 'those', 'these', 'it', 'them'
  ];
  
  const isFollowUpByPattern = followUpIndicators.some(indicator => lowerQuery.includes(indicator));
  
  // Step 2: If pattern matching is uncertain, use AI for better accuracy
  let isFollowUp = isFollowUpByPattern;
  
  // Use AI if pattern matching is unclear or if we want to be extra sure
  if (!isFollowUpByPattern || lowerQuery.includes('one') || lowerQuery.includes('that') || lowerQuery.includes('this')) {
    try {
      const aiResult = await determineIfFollowUpWithAI(query, lastQueryContext);
      isFollowUp = aiResult;
      logger.info('Used AI for follow-up detection:', { query, aiResult, patternResult: isFollowUpByPattern });
    } catch (error) {
      logger.error('AI follow-up detection failed, using pattern result:', error);
      // Fall back to pattern matching result
    }
  }
  
  if (!isFollowUp) {
    return null;
  }

  // Generate improved follow-up response
  return await generateFollowUpResponse(query, lastQueryContext);
}

/**
 * Generate a comprehensive follow-up response with focus tracking and fuzzy matching
 * @param {string} userQuery - The current user query
 * @param {Object} lastQueryContext - The context from the previous query
 * @returns {Object} FollowUpResponse with voiceResponse, smsResponse, and matchedResult
 */
export async function generateFollowUpResponse(userQuery, lastQueryContext) {
  // Custom response for off-topic follow-ups (move to top)
  if (lastQueryContext && (lastQueryContext.intent === 'off_topic')) {
    return {
      type: 'off_topic',
      intent: 'off_topic',
      voiceResponse: "I'm here to help with domestic violence support and resources. If you have any questions about that, please let me know!",
      smsResponse: null,
      results: lastQueryContext.results || []
    };
  }

  if (!lastQueryContext || !lastQueryContext.results || lastQueryContext.results.length === 0) {
    return {
      voiceResponse: "I don't have the previous search results available. Could you please repeat your location or question?",
      type: 'no_context'
    };
  }

  // Extract focus target from user query
  const focusTarget = extractFocusTarget(userQuery, lastQueryContext);
  
  // Find the best matching result
  const matchedResult = findBestMatch(focusTarget, lastQueryContext.results);
  
  // Handle specific follow-up types
  const lowerQuery = userQuery.toLowerCase();
  
  // "Can you send that to me?" or "Can you text me?"
  if (lowerQuery.includes('send') || lowerQuery.includes('text') || lowerQuery.includes('email')) {
    return {
      type: 'send_details',
      intent: lastQueryContext.intent,
      voiceResponse: `I'll send you the ${lastQueryContext.intent.replace('_', ' ')} details via text message. You should receive them shortly.`,
      smsResponse: lastQueryContext.smsResponse,
      results: lastQueryContext.results,
      matchedResult
    };
  }
  
  // "Where is that located?" or "What's the address?"
  if (lowerQuery.includes('where') || lowerQuery.includes('address') || lowerQuery.includes('location')) {
    if (matchedResult) {
      const cleanTitle = cleanResultTitle(matchedResult.title);
      return {
        type: 'location_info',
        intent: lastQueryContext.intent,
        voiceResponse: `${cleanTitle} is located at ${matchedResult.url}. Would you like me to send you the complete details?`,
        smsResponse: lastQueryContext.smsResponse,
        results: lastQueryContext.results,
        matchedResult
      };
    } else {
      return {
        type: 'location_info',
        intent: lastQueryContext.intent,
        voiceResponse: `I found ${lastQueryContext.results.length} resources in ${lastQueryContext.location || 'that area'}. Would you like me to send you the details for all of them?`,
        smsResponse: lastQueryContext.smsResponse,
        results: lastQueryContext.results
      };
    }
  }
  
  // "What's the number?" or "What's their phone?"
  if (lowerQuery.includes('number') || lowerQuery.includes('phone') || lowerQuery.includes('call')) {
    if (matchedResult) {
      const cleanTitle = cleanResultTitle(matchedResult.title);
      const phone = extractPhoneFromContent(matchedResult.content);
      return {
        type: 'phone_info',
        intent: lastQueryContext.intent,
        voiceResponse: `For ${cleanTitle}, the phone number is ${phone}. Would you like me to send you the complete details?`,
        smsResponse: lastQueryContext.smsResponse,
        results: lastQueryContext.results,
        matchedResult
      };
    } else {
      return {
        type: 'phone_info',
        intent: lastQueryContext.intent,
        voiceResponse: `I found ${lastQueryContext.results.length} resources. Would you like me to send you the contact information for all of them?`,
        smsResponse: lastQueryContext.smsResponse,
        results: lastQueryContext.results
      };
    }
  }
  
  // Specific result follow-up (e.g., "Tell me more about South Lake Tahoe")
  if (matchedResult) {
    const cleanTitle = cleanResultTitle(matchedResult.title);
    const summary = generateResultSummary(matchedResult);
    
    return {
      type: 'specific_result',
      intent: lastQueryContext.intent,
      voiceResponse: `Here's what I found about ${cleanTitle}: ${summary}. Would you like me to send you the complete details?`,
      smsResponse: lastQueryContext.smsResponse,
      results: lastQueryContext.results,
      matchedResult
    };
  }
  
  // Generic "tell me more" or "more information" requests
  if (lowerQuery.includes('more') || lowerQuery.includes('information') || lowerQuery.includes('about') || lowerQuery.includes('details')) {
    return {
      type: 'detailed_info',
      intent: lastQueryContext.intent,
      voiceResponse: generateDetailedShelterInfo(lastQueryContext),
      smsResponse: lastQueryContext.smsResponse,
      results: lastQueryContext.results
    };
  }
  
  // Generic follow-up response with improved formatting
  return {
    type: 'general_follow_up',
    intent: lastQueryContext.intent,
    voiceResponse: generateGenericFollowUpResponse(lastQueryContext),
    smsResponse: lastQueryContext.smsResponse,
    results: lastQueryContext.results
  };
}

/**
 * Extract the focus target from user query (location, title, or reference)
 * @param {string} userQuery - The user's follow-up query
 * @param {Object} lastQueryContext - The previous query context
 * @returns {string|null} The focus target or null if not found
 */
function extractFocusTarget(userQuery, lastQueryContext) {
  const lowerQuery = userQuery.toLowerCase();
  
  // Check for location references
  if (lastQueryContext.location) {
    const locationLower = lastQueryContext.location.toLowerCase();
    if (lowerQuery.includes(locationLower)) {
      return lastQueryContext.location;
    }
  }
  
  // Check for ordinal references
  const ordinalPatterns = [
    /(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)/i,
    /(one|two|three|four|five)/i
  ];
  
  for (const pattern of ordinalPatterns) {
    const match = userQuery.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // Check for demonstrative references
  if (lowerQuery.includes('that') || lowerQuery.includes('this') || lowerQuery.includes('the one')) {
    return 'specific_reference';
  }
  
  // Extract potential location names (capitalized words)
  const locationMatch = userQuery.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g);
  if (locationMatch && locationMatch.length > 0) {
    return locationMatch[0];
  }
  
  return null;
}

/**
 * Find the best matching result using fuzzy matching
 * @param {string} focusTarget - The target to match against
 * @param {Array} results - Array of Tavily results
 * @returns {Object|null} The best matching result or null
 */
function findBestMatch(focusTarget, results) {
  if (!focusTarget || !results || results.length === 0) {
    return null;
  }
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const result of results) {
    const title = result.title.toLowerCase();
    const content = (result.content || '').toLowerCase();
    const url = result.url.toLowerCase();
    
    // Calculate similarity scores
    const titleScore = calculateSimilarity(focusTarget.toLowerCase(), title);
    const contentScore = calculateSimilarity(focusTarget.toLowerCase(), content);
    const urlScore = calculateSimilarity(focusTarget.toLowerCase(), url);
    
    // Weight the scores (title is most important)
    const totalScore = (titleScore * 0.6) + (contentScore * 0.3) + (urlScore * 0.1);
    
    if (totalScore > bestScore && totalScore > 0.3) { // Minimum threshold
      bestScore = totalScore;
      bestMatch = result;
    }
  }
  
  logger.info('Follow-up matching result:', {
    focusTarget,
    bestMatch: bestMatch ? cleanResultTitle(bestMatch.title) : null,
    bestScore,
    totalResults: results.length
  });
  
  return bestMatch;
}

/**
 * Calculate similarity between two strings using simple fuzzy matching
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score between 0 and 1
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  // Check for exact substring match
  if (str2.includes(str1) || str1.includes(str2)) {
    return 0.9;
  }
  
  // Check for word overlap
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  
  let matches = 0;
  for (const word1 of words1) {
    if (word1.length < 3) continue; // Skip short words
    for (const word2 of words2) {
      if (word2.includes(word1) || word1.includes(word2)) {
        matches++;
        break;
      }
    }
  }
  
  if (matches === 0) return 0;
  
  return Math.min(matches / Math.max(words1.length, words2.length), 0.8);
}

/**
 * Clean result title for voice response
 * @param {string} title - Raw result title
 * @returns {string} Cleaned title
 */
export function cleanResultTitle(title) {
  if (!title) return 'this resource';
  
  // Remove brackets and extra formatting
  let clean = title.replace(/^\[.*?\]\s*/, '').replace(/\s*-\s*.*$/i, '').trim();
  
  // Truncate if too long for voice
  if (clean.length > 50) {
    clean = clean.substring(0, 47) + '...';
  }
  
  return clean;
}

/**
 * Generate a summary of a result for voice response
 * @param {Object} result - Tavily result object
 * @returns {string} Voice-friendly summary
 */
export function generateResultSummary(result) {
  if (!result.content) {
    return 'This resource provides support and assistance for those in need.';
  }
  
  const content = result.content.toLowerCase();
  
  // Extract key services and programs
  const services = [];
  
  // Check for specific services
  if (content.includes('emergency shelter') || content.includes('crisis shelter')) {
    services.push('emergency shelter');
  }
  if (content.includes('transitional housing') || content.includes('long-term housing')) {
    services.push('transitional housing');
  }
  if (content.includes('counseling') || content.includes('therapy')) {
    services.push('counseling services');
  }
  if (content.includes('legal') || content.includes('attorney') || content.includes('restraining order')) {
    services.push('legal assistance');
  }
  if (content.includes('support group') || content.includes('group therapy')) {
    services.push('support groups');
  }
  if (content.includes('hotline') || content.includes('24/7')) {
    services.push('24/7 hotline');
  }
  if (content.includes('children') || content.includes('kids') || content.includes('family')) {
    services.push('family services');
  }
  if (content.includes('transportation') || content.includes('transport')) {
    services.push('transportation assistance');
  }
  if (content.includes('job') || content.includes('employment') || content.includes('career')) {
    services.push('employment assistance');
  }
  if (content.includes('education') || content.includes('training')) {
    services.push('education and training');
  }
  
  // Generate summary based on services found
  if (services.length > 0) {
    if (services.length === 1) {
      return `This shelter provides ${services[0]}.`;
    } else if (services.length === 2) {
      return `This shelter provides ${services[0]} and ${services[1]}.`;
    } else {
      const lastService = services.pop();
      return `This shelter provides ${services.join(', ')}, and ${lastService}.`;
    }
  }
  
  // Fallback: Extract first meaningful sentence
  const sentences = result.content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length === 0) {
    return 'This resource provides support and assistance for those in need.';
  }
  
  let summary = sentences[0].trim();
  
  // Truncate if too long for voice
  if (summary.length > 100) {
    summary = summary.substring(0, 97) + '...';
  }
  
  return summary;
}

/**
 * Generate a generic follow-up response with improved formatting
 * @param {Object} lastQueryContext - The previous query context
 * @returns {string} Voice-friendly response
 */
function generateGenericFollowUpResponse(lastQueryContext) {
  if (!lastQueryContext.results || lastQueryContext.results.length === 0) {
    return "I don't have the previous search results available. Could you please repeat your location or question?";
  }
  
  const results = lastQueryContext.results;
  const location = lastQueryContext.location || 'that area';
  
  if (results.length === 1) {
    const cleanTitle = cleanResultTitle(results[0].title);
    return `I found one helpful resource in ${location}: ${cleanTitle}. Would you like me to send you the details?`;
  } else if (results.length === 2) {
    const title1 = cleanResultTitle(results[0].title);
    const title2 = cleanResultTitle(results[1].title);
    return `I found two helpful resources in ${location}: one in ${title1}, and another in ${title2}. Would you like me to send you the details?`;
  } else {
    const title1 = cleanResultTitle(results[0].title);
    const title2 = cleanResultTitle(results[1].title);
    const title3 = cleanResultTitle(results[2].title);
    return `I found ${results.length} helpful resources in ${location}: one in ${title1}, another in ${title2}, and a third in ${title3}. Would you like me to send you the details?`;
  }
}

/**
 * Use AI to determine if a query is a follow-up question (only when needed)
 * @param {string} query - The current user query
 * @param {Object} lastQueryContext - The context from the previous query
 * @returns {boolean} True if it's a follow-up question
 */
async function determineIfFollowUpWithAI(query, lastQueryContext) {
  try {
    const { callGPT } = await import('./apis.js');
    
    const prompt = `Given this conversation context:
Previous question: "${lastQueryContext.query || 'unknown'}"
Previous intent: ${lastQueryContext.intent}
Previous results: ${lastQueryContext.results?.length || 0} items found

Current user query: "${query}"

Is the current query a follow-up question that refers to the previous conversation? 
Consider if the user is:
- Asking for more details about something mentioned before
- Referring to specific items from previous results (like "the third one", "that shelter")
- Asking for clarification or additional information
- Making a vague reference that requires context

Respond with only "yes" or "no".`;

    const response = await callGPT(prompt, 'gpt-3.5-turbo');
    
    // Handle the response properly - callGPT returns an object with a text property
    let responseText;
    if (typeof response === 'string') {
      responseText = response;
    } else if (response && typeof response === 'object' && response.text) {
      responseText = response.text;
    } else {
      logger.error('Unexpected response format from callGPT:', { response, type: typeof response });
      return false;
    }
    
    const isFollowUp = responseText.toLowerCase().includes('yes');
    
    return isFollowUp;
  } catch (error) {
    logger.error('Error calling GPT for follow-up determination:', error);
    return false;
  }
}

/**
 * Extract phone number from content
 * @param {string} content - The content to search for phone numbers
 * @returns {string} Phone number or "Not available"
 */
function extractPhoneFromContent(content) {
  if (!content) return 'Not available';
  const phoneMatch = content.match(/(\d{3}[-.]?\d{3}[-.]?\d{4})/);
  return phoneMatch ? phoneMatch[1] : 'Not available';
}

/**
 * Generate detailed information about shelters and their services
 * @param {Object} lastQueryContext - The previous query context
 * @returns {string} Voice-friendly detailed response
 */
export function generateDetailedShelterInfo(lastQueryContext) {
  if (!lastQueryContext.results || lastQueryContext.results.length === 0) {
    return "I don't have the previous search results available. Could you please repeat your location or question?";
  }
  
  const results = lastQueryContext.results;
  const location = lastQueryContext.location || 'that area';
  
  if (results.length === 1) {
    const result = results[0];
    const cleanTitle = cleanResultTitle(result.title);
    const summary = generateResultSummary(result);
    const phone = extractPhoneFromContent(result.content);
    
    return `Here's detailed information about ${cleanTitle}: ${summary}. You can contact them at ${phone}. Would you like me to send you the complete details?`;
  } else if (results.length === 2) {
    const result1 = results[0];
    const result2 = results[1];
    const title1 = cleanResultTitle(result1.title);
    const title2 = cleanResultTitle(result2.title);
    const summary1 = generateResultSummary(result1);
    const summary2 = generateResultSummary(result2);
    
    return `Here's what I found about the shelters in ${location}: First, ${title1} - ${summary1}. Second, ${title2} - ${summary2}. Would you like me to send you the complete details for both?`;
  } else {
    // For 3 or more results, provide details for the first 2 and mention the rest
    const result1 = results[0];
    const result2 = results[1];
    const title1 = cleanResultTitle(result1.title);
    const title2 = cleanResultTitle(result2.title);
    const summary1 = generateResultSummary(result1);
    const summary2 = generateResultSummary(result2);
    
    let response = `Here's what I found about the shelters in ${location}: First, ${title1} - ${summary1}. Second, ${title2} - ${summary2}.`;
    
    if (results.length === 3) {
      const result3 = results[2];
      const title3 = cleanResultTitle(result3.title);
      const summary3 = generateResultSummary(result3);
      response += ` Third, ${title3} - ${summary3}.`;
    } else {
      response += ` I also found ${results.length - 2} more resources.`;
    }
    
    response += ` Would you like me to send you the complete details for all of them?`;
    return response;
  }
} 