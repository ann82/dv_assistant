import { OpenAI } from 'openai';
import { config } from './config.js';
import logger from './logger.js';
import { detectLocationWithGeocoding } from './enhancedLocationDetector.js';

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
          'end_conversation',
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
 * Rewrite query for optimal search results
 * @param {string} query - The user query
 * @param {string} intent - The detected intent
 * @param {string} callSid - The call SID for conversation context
 * @returns {Promise<string>} The rewritten query
 */
export async function rewriteQuery(query, intent, callSid = null) {
  if (!query || typeof query !== 'string') {
    return query || '';
  }

  let rewrittenQuery = query.trim();
  const lowerQuery = rewrittenQuery.toLowerCase();

  try {
    // Use geocoding-based location detection
    const locationInfo = await detectLocationWithGeocoding(query);

    // Add location context if present and US
    if (locationInfo && locationInfo.location && locationInfo.isUS) {
      // Add shelter-specific terms for shelter intent
      if (intent === 'find_shelter') {
        // Make the query more specific to domestic violence shelters
        if (!/\b(domestic violence|abuse|victim|survivor)\b/i.test(rewrittenQuery)) {
          rewrittenQuery = `domestic violence shelter ${rewrittenQuery}`;
        }
        if (!/\bshelter\b/i.test(rewrittenQuery)) {
          rewrittenQuery = `${rewrittenQuery} shelter`;
        }
        
        // Check if location is already mentioned to avoid duplication
        const hasLocation = new RegExp(`\\b${locationInfo.location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(rewrittenQuery);
        if (!hasLocation) {
          rewrittenQuery = `${rewrittenQuery} ${locationInfo.location}`;
        }
        
        // Add minimal site restrictions to focus on relevant domains
        rewrittenQuery += ' site:org OR site:gov';
        
        // Add specific terms to improve relevance (simplified)
        rewrittenQuery += ' "domestic violence"';
      } else {
        // For other intents, just add location context
        if (!rewrittenQuery.includes(locationInfo.location)) {
          rewrittenQuery = `${rewrittenQuery} in ${locationInfo.location}`;
        }
      }
    } else if (locationInfo && locationInfo.location && !locationInfo.isUS) {
      // For non-US locations, preserve the location but don't add US-specific enhancements
      // Optionally, you could return a message here if you want to block non-US queries
      // For now, just keep the original query as-is
    }
  } catch (error) {
    logger.error('Error in location detection during query rewriting:', error);
    // Continue with the original query if location detection fails
  }

  // Add intent-specific enhancements for other intents
  switch (intent) {
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

  // Ensure we always return a valid string
  return rewrittenQuery || query || '';
}

/**
 * Classifies a user query into one of the predefined intents using GPT-3.5-turbo
 * @param {string} query - The user query to classify
 * @returns {Promise<string>} The classified intent
 */
export async function getIntent(query) {
  try {
    logger.info('Classifying intent for query:', { query });

    // Check if we have a valid API key
    if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === 'sk-test-key') {
      logger.warn('OpenAI API key not configured, using fallback intent classification');
      const fallbackIntent = classifyIntentFallback(query);
      logger.info('Fallback intent classification result:', { 
        query, 
        intent: fallbackIntent, 
        confidence: 'fallback',
        method: 'pattern_matching'
      });
      return fallbackIntent;
    }

    // Log API key format for debugging (without exposing the full key)
    const apiKeyPrefix = config.OPENAI_API_KEY.substring(0, 7);
    const apiKeyLength = config.OPENAI_API_KEY.length;
    const isValidFormat = (apiKeyPrefix === 'sk-' || apiKeyPrefix === 'sk-proj') && apiKeyLength > 20;
    
    logger.info('OpenAI API key check:', { 
      prefix: apiKeyPrefix, 
      length: apiKeyLength,
      isValidFormat
    });

    const prompt = `Classify the following user query into one of these predefined intents for a domestic violence support assistant:

Available intents:
- find_shelter: For requests to find domestic violence shelters, safe houses, or emergency housing
- legal_services: For requests about legal help, restraining orders, court assistance, or legal representation
- counseling_services: For requests about therapy, counseling, mental health support, or emotional help
- emergency_help: For urgent requests, immediate danger, or crisis situations
- general_information: For general questions about domestic violence, resources, or support
- other_resources: For requests about financial assistance, job training, childcare, or other support services
- end_conversation: For requests to end the call, hang up, or stop the conversation
- off_topic: For requests unrelated to domestic violence support

IMPORTANT: If the query is about ANY topic other than domestic violence support (medical questions, entertainment, weather, sports, jokes, personal problems, etc.), classify it as "off_topic". Only classify as one of the other intents if the query is specifically about domestic violence support, shelters, legal help, counseling, or related resources.

User query: "${query}"

Respond with only the intent name (e.g., "find_shelter").`;

    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: config.GPT35_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.1
    });
    const responseTime = Date.now() - startTime;

    const intent = response.choices[0].message.content.trim().toLowerCase();
    const usage = response.usage;
    
    // Calculate confidence based on response characteristics
    const confidence = calculateIntentConfidence(intent, query, response);
    
    // Log detailed intent classification results
    logger.info('Intent classification completed:', {
      query,
      intent,
      confidence,
      responseTime: `${responseTime}ms`,
      model: config.GPT35_MODEL,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens
      },
      method: 'openai_gpt35'
    });

    // Log confidence score for monitoring
    logger.info('AI Model Confidence Score:', {
      query,
      intent,
      confidence,
      confidenceLevel: getConfidenceLevel(confidence),
      timestamp: new Date().toISOString()
    });

    return intent;

  } catch (error) {
    logger.error('Error classifying intent:', {
      error: error.message,
      status: error.status,
      statusText: error.statusText,
      query,
      stack: error.stack
    });
    
    // Fallback to pattern matching
    logger.info('Falling back to pattern-based intent classification');
    const fallbackIntent = classifyIntentFallback(query);
    
    logger.info('Fallback intent classification result:', { 
      query, 
      intent: fallbackIntent, 
      confidence: 'fallback',
      method: 'pattern_matching',
      error: error.message
    });
    
    return fallbackIntent;
  }
}

/**
 * Fallback intent classification using pattern matching when OpenAI API is unavailable
 * @param {string} query - The user query to classify
 * @returns {string} The classified intent
 */
function classifyIntentFallback(query) {
  if (!query || typeof query !== 'string') {
    return 'general_information';
  }

  const lowerQuery = query.toLowerCase();
  
  // First check for domestic violence related keywords
  const domesticViolenceKeywords = [
    'domestic', 'violence', 'abuse', 'shelter', 'safe', 'refuge', 'protection',
    'restraining order', 'legal', 'lawyer', 'attorney', 'court', 'divorce', 'custody',
    'counseling', 'therapy', 'therapist', 'mental health', 'emotional support',
    'emergency', 'urgent', 'danger', 'unsafe', 'resources',
    'housing', 'home', 'place to stay', 'financial', 'job training', 'childcare'
  ];
  
  // More specific check - look for word boundaries to avoid false positives
  const hasDomesticViolenceKeywords = domesticViolenceKeywords.some(keyword => {
    // Use word boundary regex to avoid partial matches
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(lowerQuery);
  });
  
  // Also check for "help" but only in domestic violence context
  const hasHelpInContext = lowerQuery.includes('help') && (
    lowerQuery.includes('domestic') || 
    lowerQuery.includes('violence') || 
    lowerQuery.includes('abuse') || 
    lowerQuery.includes('shelter') || 
    lowerQuery.includes('legal') || 
    lowerQuery.includes('counseling') ||
    lowerQuery.includes('support')
  );
  
  // If no domestic violence keywords and no help in context, it's off-topic
  if (!hasDomesticViolenceKeywords && !hasHelpInContext) {
    return 'off_topic';
  }
  
  // Pattern matching for specific intents (only for domestic violence related queries)
  if (/\b(shelter|home|housing|place to stay|safe place|refuge)\b/i.test(lowerQuery)) {
    return 'find_shelter';
  }
  
  if (/\b(legal|lawyer|attorney|restraining order|order of protection|court|divorce|custody|rights)\b/i.test(lowerQuery)) {
    return 'legal_services';
  }
  
  if (/\b(counseling|therapy|therapist|counselor|mental health|emotional support|talk to someone)\b/i.test(lowerQuery)) {
    return 'counseling_services';
  }
  
  if (/\b(emergency|urgent|immediate|help now|danger|unsafe|abuse|violence)\b/i.test(lowerQuery)) {
    return 'emergency_help';
  }
  
  if (/\b(end|stop|goodbye|bye|hang up|disconnect)\b/i.test(lowerQuery)) {
    return 'end_conversation';
  }
  
  // Default to general information for domestic violence related queries
  return 'general_information';
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
  end_conversation: async (query) => {
    // Handle end conversation requests
    return 'end_conversation';
  },
  off_topic: async (query) => {
    // Enhanced off-topic handling with conversation management
    const queryLower = query.toLowerCase();
    
    // Check for conversation end requests
    if (queryLower.includes('goodbye') || queryLower.includes('bye') || 
        queryLower.includes('end call') || queryLower.includes('hang up')) {
      return {
        type: 'conversation_end',
        intent: 'end_conversation',
        voiceResponse: "Thank you for calling. I hope I was able to help. If you need support in the future, please don't hesitate to call back. Take care.",
        smsResponse: null,
        shouldEndCall: true
      };
    }
    
    // Check for re-engagement attempts
    if (queryLower.includes('help') || queryLower.includes('support') || 
        queryLower.includes('domestic') || queryLower.includes('violence')) {
      return {
        type: 're_engagement',
        intent: 'general_information',
        voiceResponse: "I'm here to help with domestic violence support and resources. What specific information or assistance do you need today?",
        smsResponse: "I'm here to help with domestic violence support. What do you need assistance with?",
        shouldReengage: true
      };
    }
    
    // Check for medical queries specifically
    if (/\b(chemo|chemotherapy|cancer|treatment|medicine|medical|doctor|hospital|disease|illness|symptoms|diagnosis|prescription|medication|drug|pharmacy)\b/i.test(queryLower)) {
      return {
        type: 'medical_redirection',
        intent: 'off_topic',
        voiceResponse: "I'm specifically designed to help with domestic violence support and resources. For medical questions about chemotherapy, cancer treatment, or other health concerns, please consult with your healthcare provider or call a medical information line. If you're experiencing domestic violence and need support, I'm here to help with that.",
        smsResponse: "I'm here for domestic violence support. For medical questions, please consult your healthcare provider.",
        shouldRedirect: true
      };
    }
    
    // Handle entertainment and other off-topic queries
    if (/\b(weather|sports|joke|funny|music|movie|food|restaurant|shopping|game|entertainment)\b/i.test(queryLower)) {
      return {
        type: 'entertainment_redirection',
        intent: 'off_topic',
        voiceResponse: "I'm specifically designed to help with domestic violence support and resources. For entertainment, weather, sports, or other general topics, you might want to try a different service. If you have questions about domestic violence support, I'm here to help with that.",
        smsResponse: "I'm here for domestic violence support. For other topics, please try a different service.",
        shouldRedirect: true
      };
    }
    
    // Generic off-topic response
    return {
      type: 'off_topic_redirection',
      intent: 'off_topic',
      voiceResponse: "I'm specifically designed to help with domestic violence support and resources. If you have questions about that, I'd be happy to help. Otherwise, you might want to try a different service for other topics.",
      smsResponse: "I'm here for domestic violence support. For other topics, please try a different service.",
      shouldRedirect: true
    };
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
    // General follow-up words
    'more', 'details', 'information', 'about', 'tell me', 'what about',
    'can you tell me', 'i want to know', 'i need to know', 'show me',
    // Ordinal references
    'first', 'second', 'third', 'fourth', 'fifth', '1st', '2nd', '3rd', '4th', '5th',
    // Demonstrative references
    'that one', 'this one', 'the one', 'those', 'these', 'it', 'them',
    'that place', 'this place', 'that shelter', 'this shelter',
    // Specific follow-up patterns
    'where is', 'what is the address', 'what is the phone', 'what is the number',
    'can you send', 'can you text', 'can you message',
    // Pet-related follow-up patterns
    'pets', 'pet', 'animals', 'pet policy', 'pet-friendly', 'do they allow pets', 'can i bring my pet', 'are pets allowed', 'pet accommodation', 'pet shelter', 'pet program', 'pet support', 'pet services', 'pet safe', 'pet safety', 'pet-friendly shelter', 'pet-friendly program', 'pet-friendly services'
  ];
  
  const isFollowUpByPattern = followUpIndicators.some(indicator => lowerQuery.includes(indicator));
  
  // Additional check for very short queries that are likely follow-ups
  const isShortQuery = query.trim().length <= 10;
  const hasFollowUpWords = lowerQuery.includes('one') || lowerQuery.includes('that') || lowerQuery.includes('this') || lowerQuery.includes('it');
  const isLikelyShortFollowUp = isShortQuery && hasFollowUpWords;
  
  // Step 2: If pattern matching is uncertain, use AI for better accuracy
  let isFollowUp = isFollowUpByPattern || isLikelyShortFollowUp;
  
  // Use AI if pattern matching is unclear or if we want to be extra sure
  if (!isFollowUpByPattern || lowerQuery.includes('one') || lowerQuery.includes('that') || lowerQuery.includes('this') || isLikelyShortFollowUp) {
    try {
      const aiResult = await determineIfFollowUpWithAI(query, lastQueryContext);
      // Only use AI result if it's true, otherwise fall back to pattern matching
      if (aiResult === true) {
        isFollowUp = true;
      }
      // If AI returns false, keep the pattern matching result
      logger.info('Used AI for follow-up detection:', { 
        query, 
        aiResult, 
        patternResult: isFollowUpByPattern,
        isLikelyShortFollowUp,
        finalResult: isFollowUp
      });
    } catch (error) {
      logger.error('AI follow-up detection failed, using pattern result:', error);
      // Fall back to pattern matching result - don't override with false
    }
  }
  
  if (!isFollowUp) {
    logger.info('Not detected as follow-up:', { 
      query, 
      patternResult: isFollowUpByPattern,
      isLikelyShortFollowUp,
      finalResult: isFollowUp
    });
    return null;
  }

  logger.info('Detected as follow-up question:', { 
    query, 
    patternResult: isFollowUpByPattern,
    isLikelyShortFollowUp,
    finalResult: isFollowUp
  });

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
        voiceResponse: `I can provide you with the address for ${cleanTitle}. Would you like me to send you the complete details including the address via text message?`,
        smsResponse: lastQueryContext.smsResponse,
        results: lastQueryContext.results,
        matchedResult
      };
    } else {
      return {
        type: 'location_info',
        intent: lastQueryContext.intent,
        voiceResponse: `I found ${lastQueryContext.results.length} resources in ${lastQueryContext.location || 'that area'}. How else can I help you today?`,
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
  
  // Check for ordinal references and map them to result indices
  const ordinalPatterns = [
    { pattern: /(first|1st)/i, index: 0 },
    { pattern: /(second|2nd)/i, index: 1 },
    { pattern: /(third|3rd)/i, index: 2 },
    { pattern: /(fourth|4th)/i, index: 3 },
    { pattern: /(fifth|5th)/i, index: 4 }
  ];
  
  for (const { pattern, index } of ordinalPatterns) {
    const match = userQuery.match(pattern);
    if (match && lastQueryContext.results && lastQueryContext.results[index]) {
      // Return the title of the specific result instead of the ordinal word
      return lastQueryContext.results[index].title;
    }
  }
  
  // Check for "last one", "the last one", etc.
  if (lowerQuery.includes('last') && (lowerQuery.includes('one') || lowerQuery.includes('result'))) {
    if (lastQueryContext.results && lastQueryContext.results.length > 0) {
      // Return the title of the last result
      const lastIndex = lastQueryContext.results.length - 1;
      return lastQueryContext.results[lastIndex].title;
    }
  }
  
  // Check for demonstrative references
  if (lowerQuery.includes('that') || lowerQuery.includes('this') || lowerQuery.includes('the one')) {
    // If we have a focused result from previous context, use that
    if (lastQueryContext.focusResultTitle) {
      return lastQueryContext.focusResultTitle;
    }
    // Otherwise, default to the first result
    if (lastQueryContext.results && lastQueryContext.results.length > 0) {
      return lastQueryContext.results[0].title;
    }
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
  if (content.includes('safety planning') || content.includes('safety plan')) {
    services.push('safety planning');
  }
  if (content.includes('advocacy') || content.includes('advocate')) {
    services.push('advocacy services');
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
  
  // Fallback: Extract first meaningful sentence that contains relevant information
  const sentences = result.content.split(/[.!?]+/).filter(s => s.trim().length > 15);
  if (sentences.length === 0) {
    return 'This resource provides support and assistance for those in need.';
  }
  
  // Look for a sentence that contains relevant keywords
  const relevantKeywords = ['shelter', 'domestic violence', 'support', 'help', 'assistance', 'counseling', 'legal', 'family', 'children', 'emergency', 'crisis', 'safe'];
  
  let bestSentence = sentences[0];
  let bestScore = 0;
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    let score = 0;
    
    for (const keyword of relevantKeywords) {
      if (lowerSentence.includes(keyword)) {
        score += 1;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }
  
  let summary = bestSentence.trim();
  
  // Truncate if too long for voice
  if (summary.length > 120) {
    summary = summary.substring(0, 117) + '...';
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
    return `I found one helpful resource in ${location}: ${cleanTitle}. How else can I help you today?`;
  } else if (results.length === 2) {
    const title1 = cleanResultTitle(results[0].title);
    const title2 = cleanResultTitle(results[1].title);
    return `I found two helpful resources in ${location}: one in ${title1}, and another in ${title2}. How else can I help you today?`;
  } else {
    const title1 = cleanResultTitle(results[0].title);
    const title2 = cleanResultTitle(results[1].title);
    const title3 = cleanResultTitle(results[2].title);
    return `I found ${results.length} helpful resources in ${location}: one in ${title1}, another in ${title2}, and a third in ${title3}. How else can I help you today?`;
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
    
    // Extract more detailed information from content
    const detailedInfo = extractDetailedInfo(result.content);
    
    let response = `Here's detailed information about ${cleanTitle}: ${summary}`;
    
    if (detailedInfo.services.length > 0) {
      response += ` They provide ${detailedInfo.services.join(', ')}.`;
    }
    
    if (detailedInfo.highlights.length > 0) {
      response += ` ${detailedInfo.highlights.join(' ')}`;
    }
    
    if (phone !== 'Not available') {
      response += ` You can contact them at ${phone}.`;
    }
    
    response += ` How else can I help you today?`;
    
    return response;
  } else if (results.length === 2) {
    const result1 = results[0];
    const result2 = results[1];
    const title1 = cleanResultTitle(result1.title);
    const title2 = cleanResultTitle(result2.title);
    const summary1 = generateResultSummary(result1);
    const summary2 = generateResultSummary(result2);
    
    // Extract detailed info for both results
    const detailedInfo1 = extractDetailedInfo(result1.content);
    const detailedInfo2 = extractDetailedInfo(result2.content);
    
    let response = `Here's what I found about the shelters in ${location}: `;
    
    response += `First, ${title1} - ${summary1}`;
    if (detailedInfo1.services.length > 0) {
      response += ` They provide ${detailedInfo1.services.join(', ')}.`;
    }
    
    response += ` Second, ${title2} - ${summary2}`;
    if (detailedInfo2.services.length > 0) {
      response += ` They provide ${detailedInfo2.services.join(', ')}.`;
    }
    
    response += ` How else can I help you today?`;
    
    return response;
  } else {
    // For 3 or more results, provide details for the first 2 and mention the rest
    const result1 = results[0];
    const result2 = results[1];
    const title1 = cleanResultTitle(result1.title);
    const title2 = cleanResultTitle(result2.title);
    const summary1 = generateResultSummary(result1);
    const summary2 = generateResultSummary(result2);
    
    // Extract detailed info for first two results
    const detailedInfo1 = extractDetailedInfo(result1.content);
    const detailedInfo2 = extractDetailedInfo(result2.content);
    
    let response = `Here's what I found about the shelters in ${location}: `;
    
    response += `First, ${title1} - ${summary1}`;
    if (detailedInfo1.services.length > 0) {
      response += ` They provide ${detailedInfo1.services.join(', ')}.`;
    }
    
    response += ` Second, ${title2} - ${summary2}`;
    if (detailedInfo2.services.length > 0) {
      response += ` They provide ${detailedInfo2.services.join(', ')}.`;
    }
    
    if (results.length > 3) {
      response += ` I also found ${results.length - 2} more resources in that area.`;
    }
    
    response += ` How else can I help you today?`;
    
    return response;
  }
}

/**
 * Extract detailed information from content
 * @param {string} content - The content to analyze
 * @returns {Object} Object with services and highlights
 */
function extractDetailedInfo(content) {
  if (!content) return { services: [], highlights: [] };
  
  const lowerContent = content.toLowerCase();
  const services = [];
  const highlights = [];
  
  // Extract services
  if (lowerContent.includes('counseling') || lowerContent.includes('therapy')) {
    services.push('counseling services');
  }
  if (lowerContent.includes('legal') || lowerContent.includes('attorney') || lowerContent.includes('restraining order')) {
    services.push('legal assistance');
  }
  if (lowerContent.includes('support group') || lowerContent.includes('group therapy')) {
    services.push('support groups');
  }
  if (lowerContent.includes('hotline') || lowerContent.includes('24/7')) {
    services.push('24/7 hotline');
  }
  if (lowerContent.includes('children') || lowerContent.includes('kids') || lowerContent.includes('family')) {
    services.push('family services');
  }
  if (lowerContent.includes('transportation') || lowerContent.includes('transport')) {
    services.push('transportation assistance');
  }
  if (lowerContent.includes('job') || lowerContent.includes('employment') || lowerContent.includes('career')) {
    services.push('employment assistance');
  }
  if (lowerContent.includes('education') || lowerContent.includes('training')) {
    services.push('education and training');
  }
  if (lowerContent.includes('housing') || lowerContent.includes('shelter')) {
    services.push('emergency housing');
  }
  if (lowerContent.includes('safety planning') || lowerContent.includes('safety plan')) {
    services.push('safety planning');
  }
  
  // Extract highlights (first meaningful sentence)
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (sentences.length > 0) {
    const firstSentence = sentences[0].trim();
    if (firstSentence.length > 0) {
      highlights.push(firstSentence);
    }
  }
  
  return { services, highlights };
}

/**
 * Calculate intent confidence based on response characteristics
 * @param {string} intent - The classified intent
 * @param {string} query - The user query
 * @param {Object} response - The GPT-3.5-turbo response
 * @returns {number} Confidence score between 0 and 1
 */
function calculateIntentConfidence(intent, query, response) {
  let confidence = 0.5; // Base confidence
  
  // Check if intent is valid
  const validIntents = [
    'find_shelter', 'legal_services', 'counseling_services', 
    'emergency_help', 'general_information', 'other_resources', 
    'end_conversation', 'off_topic'
  ];
  
  if (!validIntents.includes(intent)) {
    logger.warn('Invalid intent detected:', { intent, query });
    return 0.1; // Low confidence for invalid intents
  }
  
  // Boost confidence for clear keyword matches
  const queryLower = query.toLowerCase();
  const intentKeywords = {
    'find_shelter': ['shelter', 'housing', 'safe', 'place to stay', 'home', 'live'],
    'legal_services': ['legal', 'lawyer', 'attorney', 'court', 'restraining order', 'divorce'],
    'counseling_services': ['counseling', 'therapy', 'counselor', 'therapist', 'mental health', 'emotional'],
    'emergency_help': ['emergency', 'urgent', 'danger', 'help now', 'immediate', 'crisis'],
    'general_information': ['what is', 'how to', 'information', 'about', 'tell me'],
    'other_resources': ['financial', 'money', 'job', 'work', 'childcare', 'transportation'],
    'end_conversation': ['goodbye', 'bye', 'end', 'stop', 'hang up', 'finish'],
    'off_topic': ['weather', 'sports', 'joke', 'funny', 'movie', 'music']
  };
  
  const keywords = intentKeywords[intent] || [];
  const keywordMatches = keywords.filter(keyword => queryLower.includes(keyword)).length;
  
  if (keywordMatches > 0) {
    confidence += 0.3; // Boost for keyword matches
  }
  
  // Boost confidence for longer, more specific queries
  if (query.length > 20) {
    confidence += 0.1;
  }
  
  // Reduce confidence for very short or vague queries
  if (query.length < 5) {
    confidence -= 0.2;
  }
  
  // Boost confidence for emergency-related queries
  if (intent === 'emergency_help') {
    confidence += 0.2; // Higher confidence for emergency detection
  }
  
  // Cap confidence at 1.0
  return Math.min(confidence, 1.0);
}

/**
 * Get confidence level based on confidence score
 * @param {number} confidence - The confidence score
 * @returns {string} Confidence level
 */
function getConfidenceLevel(confidence) {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

/**
 * Manage conversation flow based on intent and context
 * @param {string} intent - The detected intent
 * @param {string} query - The user query
 * @param {Object} context - Conversation context
 * @returns {Object} Conversation management response
 */
export function manageConversationFlow(intent, query, context = {}) {
  const response = {
    shouldContinue: true,
    shouldEndCall: false,
    shouldReengage: false,
    redirectionMessage: null,
    confidence: (context && context.confidence) ? context.confidence : 0.5
  };

  // Handle off-topic intents
  if (intent === 'off_topic') {
    const queryLower = query.toLowerCase();
    
    // Check for conversation end requests
    if (queryLower.includes('goodbye') || queryLower.includes('bye') || 
        queryLower.includes('end call') || queryLower.includes('hang up')) {
      response.shouldEndCall = true;
      response.shouldContinue = false;
      response.redirectionMessage = "Thank you for calling. I hope I was able to help. If you need support in the future, please don't hesitate to call back. Take care.";
      return response;
    }
    
    // Check for re-engagement attempts
    if (queryLower.includes('help') || queryLower.includes('support') || 
        queryLower.includes('domestic') || queryLower.includes('violence')) {
      response.shouldReengage = true;
      response.redirectionMessage = "I'm here to help with domestic violence support and resources. What specific information or assistance do you need today?";
      return response;
    }
    
    // Handle general off-topic with gentle redirection
    response.redirectionMessage = "I'm specifically designed to help with domestic violence support and resources. If you have questions about that, I'd be happy to help. Otherwise, you might want to try a different service for other topics.";
    return response;
  }

  // Handle end conversation intent
  if (intent === 'end_conversation') {
    response.shouldEndCall = true;
    response.shouldContinue = false;
    response.redirectionMessage = "Thank you for calling. I hope I was able to help. If you need support in the future, please don't hesitate to call back. Take care.";
    return response;
  }

  // Handle emergency situations with high priority
  if (intent === 'emergency_help') {
    response.shouldContinue = true;
    response.priority = 'high';
    return response;
  }

  // Default: continue conversation
  return response;
}

/**
 * Check if conversation should be re-engaged based on user behavior
 * @param {Object} context - Conversation context
 * @returns {boolean} Whether to attempt re-engagement
 */
export function shouldAttemptReengagement(context) {
  if (!context || !context.history || !Array.isArray(context.history)) {
    return false;
  }

  const recentIntents = context.history.slice(-3).map(h => h.intent);
  const offTopicCount = recentIntents.filter(intent => intent === 'off_topic').length;
  
  // Attempt re-engagement if user has been off-topic for multiple interactions
  return offTopicCount >= 2;
}

/**
 * Generate re-engagement message based on context
 * @param {Object} context - Conversation context
 * @returns {string} Re-engagement message
 */
export function generateReengagementMessage(context) {
  const messages = [
    "I'm here specifically to help with domestic violence support and resources. Is there anything related to that I can assist you with?",
    "I want to make sure you get the help you need. Do you have questions about domestic violence resources, shelters, legal help, or counseling services?",
    "I'm designed to help with domestic violence support. If you're experiencing domestic violence or know someone who is, I can help you find resources and information.",
    "Let me know if you need help finding shelters, legal services, counseling, or other domestic violence resources. I'm here to help."
  ];
  
  // Randomly select a message to avoid repetition
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
} 