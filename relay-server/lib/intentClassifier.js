import { OpenAI } from 'openai';
import { config } from './config.js';
import logger from './logger.js';
import { extractLocationFromQuery as enhancedExtractLocation } from './enhancedLocationDetector.js';
import { rewriteQuery } from './enhancedQueryRewriter.js';

// Re-export rewriteQuery for backward compatibility
export { rewriteQuery };

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });



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
  // Set lastQueryContext for resource requests even if no results yet
  if (tavilyResults && tavilyResults.results && tavilyResults.results.length > 0) {
    let location = extractLocationFromQuery(query);
    if (location) location = toTitleCase(location);
    context.lastQueryContext = {
      intent: intent,
      location: location,
      results: tavilyResults.results.slice(0, 3), // Top 3 results
      timestamp: Date.now(),
      smsResponse: response.smsResponse || null,
      voiceResponse: response.voiceResponse || null,
      needsLocation: !location && isResourceQuery(intent), // Needs location if no location found and it's a resource query
      lastQuery: query // Store the original query for context
    };
  } else if (isResourceQuery(intent)) {
    // For resource queries without Tavily results, preserve context if we need location
    let location = extractLocationFromQuery(query);
    if (location) location = toTitleCase(location);
    
    // If we have a previous context that needs location, preserve it
    if (context.lastQueryContext && context.lastQueryContext.needsLocation && !location) {
      // Update timestamp but keep the context for location follow-up
      context.lastQueryContext.timestamp = Date.now();
      context.lastQueryContext.lastQuery = query;
    } else if (tavilyResults && tavilyResults.results && tavilyResults.results.length > 0) {
      context.lastQueryContext = {
        intent: intent,
        location: location,
        results: tavilyResults.results,
        timestamp: Date.now(),
        smsResponse: response.smsResponse || null,
        voiceResponse: response.voiceResponse || null,
        needsLocation: !location && isResourceQuery(intent), // Needs location if no location found and it's a resource query
        lastQuery: query
      };
    } else if (!location && isResourceQuery(intent)) {
      // Create context for resource queries that need location but have no results yet
      context.lastQueryContext = {
        intent: intent,
        location: null,
        results: [],
        timestamp: Date.now(),
        smsResponse: response.smsResponse || null,
        voiceResponse: response.voiceResponse || null,
        needsLocation: true,
        lastQuery: query
      };
    } else {
      context.lastQueryContext = null;
    }
  } else if (matchedResult) {
    // Update context with focus tracking for follow-up responses
    if (context.lastQueryContext) {
      context.lastQueryContext.focusResultTitle = cleanResultTitle(matchedResult.title);
      context.lastQueryContext.matchedResult = matchedResult;
      context.lastQueryContext.timestamp = Date.now(); // Refresh timestamp
    }
  } else if (isResourceQuery(intent)) {
    // Ensure we create context for resource queries even without Tavily results
    let location = extractLocationFromQuery(query);
    if (location) location = toTitleCase(location);
    
    context.lastQueryContext = {
      intent: intent,
      location: location,
      results: [],
      timestamp: Date.now(),
      smsResponse: response.smsResponse || null,
      voiceResponse: response.voiceResponse || null,
      needsLocation: !location, // Needs location if no location found
      lastQuery: query
    };
  }

  logger.info('Updated conversation context:', {
    callSid,
    intent,
    historyLength: context.history.length,
    hasLastQueryContext: !!context.lastQueryContext,
    focusResultTitle: context.lastQueryContext?.focusResultTitle || null,
    needsLocation: context.lastQueryContext?.needsLocation || false
  });
}

// Helper function to extract location from query - now uses enhanced detector
function extractLocationFromQuery(query) {
  if (!query) return null;
  const result = enhancedExtractLocation(query);
  return result?.location || null;
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
    'find_shelter': ['shelter', 'housing', 'safe', 'place to stay', 'home'],
    'legal_services': ['legal', 'lawyer', 'attorney', 'court', 'restraining order', 'divorce'],
    'counseling_services': ['counseling', 'therapy', 'counselor', 'therapist', 'mental health', 'emotional'],
    'emergency_help': ['emergency', 'urgent', 'danger', 'help now', 'immediate', 'crisis'],
    'general_information': ['what is', 'how to', 'information', 'about', 'tell me'],
    'other_resources': ['financial', 'money', 'job', 'work', 'childcare', 'transportation'],
    'end_conversation': ['goodbye', 'bye', 'end', 'stop', 'hang up', 'finish', 'thank you', 'thanks'],
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
 * Fallback intent classification using pattern matching when OpenAI API is unavailable
 * @param {string} query - The user query to classify
 * @returns {string} The classified intent
 */
function classifyIntentFallback(query) {
  if (!query || typeof query !== 'string') {
    return 'general_information';
  }

  const lowerQuery = query.toLowerCase();
  
  // Check for end conversation first (before other checks)
  if (/\b(end|stop|goodbye|bye|hang up|disconnect|thank you|thanks)\b/i.test(lowerQuery)) {
    return 'end_conversation';
  }

  // --- NEW: Check for resource-seeking queries with 'near me', 'my location', etc. ---
  const resourceNearMePattern = /\b(shelter|help|resources?|services?|support)\b.*\b(near me|nearby|my location|here|around me|close to me|current location)\b|\b(near me|nearby|my location|here|around me|close to me|current location)\b.*\b(shelter|help|resources?|services?|support)\b/;
  if (resourceNearMePattern.test(lowerQuery)) {
    // Pick the most appropriate resource intent
    if (/shelter|housing|safe|place to stay|home/.test(lowerQuery)) {
      return 'find_shelter';
    }
    if (/legal|lawyer|attorney|restraining order|court|divorce|custody|rights/.test(lowerQuery)) {
      return 'legal_services';
    }
    if (/counseling|therapy|therapist|counselor|mental health|emotional support|talk to someone/.test(lowerQuery)) {
      return 'counseling_services';
    }
    // Default to other_resources for generic resource/help queries
    return 'other_resources';
  }
  // --- END NEW ---

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
  
  // Default to general information for domestic violence related queries
  return 'general_information';
}



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
    // Ordinal references
    'first', 'second', 'third', 'fourth', 'fifth', '1st', '2nd', '3rd', '4th', '5th',
    // Demonstrative references
    'that one', 'this one', 'the one', 'those', 'these', 'it', 'them',
    'that place', 'this place', 'that shelter', 'this shelter',
    // Location references (enhanced)
    'these locations', 'those locations', 'these places', 'those places',
    'in these', 'in those', 'at these', 'at those', 'for these', 'for those',
    // Specific follow-up patterns
    'where is', 'what is the address', 'what is the phone', 'what is the number',
    'can you send', 'can you text', 'can you message',
    // Pet-related follow-up patterns (enhanced)
    'pets', 'pet', 'animals', 'pet policy', 'pet-friendly', 'do they allow pets', 'can i bring my pet', 'are pets allowed', 'pet accommodation', 'pet shelter', 'pet program', 'pet support', 'pet services', 'pet safe', 'pet safety', 'pet-friendly shelter', 'pet-friendly program', 'pet-friendly services',
    'dogs', 'dog', 'cats', 'cat', 'if they', 'do they', 'can they', 'will they', 'allow', 'accept', 'take', 'bring', 'love dogs', 'love cats', 'have pets', 'with pets', 'pet policy', 'animal policy',
    // Enhanced pet policy patterns
    'let me know if', 'tell me if', 'do you know if', 'can you tell me if', 'i want to know if', 'i need to know if',
    'allow pets', 'accept pets', 'take pets', 'bring pets', 'pet friendly', 'pet policy',
    // Additional follow-up patterns
    'let me know', 'tell me if', 'do you know if', 'can you tell me if', 'i want to know if', 'i need to know if',
    'what about', 'how about', 'what if', 'what happens if', 'what do they', 'what does it', 'what is it',
    'is there', 'are there', 'does it', 'do they', 'can it', 'will it', 'would it'
  ];
  
  const isFollowUpByPattern = followUpIndicators.some(indicator => lowerQuery.includes(indicator));
  
  // Additional check for very short queries that are likely follow-ups
  const isShortQuery = query.trim().length <= 10;
  const hasFollowUpWords = lowerQuery.includes('one') || lowerQuery.includes('that') || lowerQuery.includes('this') || lowerQuery.includes('it');
  const isLikelyShortFollowUp = isShortQuery && hasFollowUpWords;
  
  // Step 2: Check if this is a location statement using geocoding
  const isResourceRequest = isResourceQuery(lastQueryContext.intent);
  const needsLocation = lastQueryContext.needsLocation;
  
  let isLocationFollowUp = false;
  let locationData = null;
  
  if (isResourceRequest && needsLocation) {
    try {
      // Try to geocode the query to see if it's a location
      const { detectLocationWithGeocoding } = await import('./enhancedLocationDetector.js');
      locationData = await detectLocationWithGeocoding(query);
      
      // If geocoding succeeds and returns a location, treat it as a location follow-up
      if (locationData && locationData.location) {
        isLocationFollowUp = true;
        logger.info('Detected location follow-up via geocoding:', {
          query,
          location: locationData.location,
          isComplete: locationData.isComplete,
          lastIntent: lastQueryContext.intent,
          needsLocation
        });
      }
    } catch (error) {
      logger.error('Error in location geocoding for follow-up detection:', error);
    }
  }
  
  // Additional check for location statements that might not be caught by geocoding
  const locationKeywords = ['live in', 'live at', 'live near', 'live by', 'i live', 'i\'m in', 'i am in', 'located in', 'from', 'in', 'at', 'i\'m from', 'i am from', 'i live in', 'i\'m located in', 'i am located in'];
  const hasLocationKeywords = locationKeywords.some(keyword => lowerQuery.includes(keyword));
  const isShortLocationStatement = query.trim().length <= 50 && hasLocationKeywords;
  
  if (isResourceRequest && needsLocation && isShortLocationStatement && !isLocationFollowUp) {
    // Try to extract location using the enhanced detector
    const { extractLocationFromQuery } = await import('./enhancedLocationDetector.js');
    const extractedLocation = extractLocationFromQuery(query);
    
    if (extractedLocation && extractedLocation.location) {
      isLocationFollowUp = true;
      locationData = { location: extractedLocation.location, isComplete: true };
      logger.info('Detected location follow-up via keyword matching:', {
        query,
        location: extractedLocation.location,
        lastIntent: lastQueryContext.intent,
        needsLocation
      });
    }
  }
  
  // Step 3: If pattern matching is uncertain, use AI for better accuracy
  let isFollowUp = isFollowUpByPattern || isLikelyShortFollowUp || isLocationFollowUp;
  
  // Use AI if pattern matching is unclear AND it's not already a location follow-up
  if (!isFollowUpByPattern && !isLocationFollowUp && (lowerQuery.includes('one') || lowerQuery.includes('that') || lowerQuery.includes('this') || isLikelyShortFollowUp)) {
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
        isLocationFollowUp,
        finalResult: isFollowUp
      });
    } catch (error) {
      logger.error('AI follow-up detection failed, using pattern result:', error);
      // Fall back to pattern matching result - don't override with false
    }
  } else if (isLocationFollowUp) {
    // Skip AI detection for location follow-ups since we already know it's a follow-up
    logger.info('Skipping AI detection for confirmed location follow-up:', { 
      query, 
      patternResult: isFollowUpByPattern,
      isLikelyShortFollowUp,
      isLocationFollowUp,
      finalResult: isFollowUp
    });
  }
  
  if (!isFollowUp) {
    logger.info('Not detected as follow-up:', { 
      query, 
      patternResult: isFollowUpByPattern,
      isLikelyShortFollowUp,
      isLocationFollowUp,
      finalResult: isFollowUp
    });
    return null;
  }

  logger.info('Detected as follow-up question:', { 
    query, 
    patternResult: isFollowUpByPattern,
    isLikelyShortFollowUp,
    isLocationFollowUp,
    finalResult: isFollowUp
  });

  // Handle location follow-up specifically
  if (isLocationFollowUp && locationData) {
    return await generateLocationFollowUpResponse(query, lastQueryContext, locationData);
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
  
  // Pet-related follow-up questions
  if (lowerQuery.includes('dog') || lowerQuery.includes('cat') || lowerQuery.includes('pet') || lowerQuery.includes('animal') || 
      lowerQuery.includes('allow') || lowerQuery.includes('accept') || lowerQuery.includes('take') || lowerQuery.includes('bring') ||
      lowerQuery.includes('love dogs') || lowerQuery.includes('love cats')) {
    
    if (matchedResult) {
      const cleanTitle = cleanResultTitle(matchedResult.title);
      return {
        type: 'pet_policy',
        intent: lastQueryContext.intent,
        voiceResponse: `Regarding pet policies at ${cleanTitle}, I'd recommend calling them directly to ask about their specific pet accommodation policies. Many shelters have different rules about pets, and it's best to confirm directly. Would you like me to send you their contact information?`,
        smsResponse: lastQueryContext.smsResponse,
        results: lastQueryContext.results,
        matchedResult,
        focusTarget: cleanTitle
      };
    } else {
      return {
        type: 'pet_policy',
        intent: lastQueryContext.intent,
        voiceResponse: `For pet accommodation policies, I'd recommend calling the shelters directly to ask about their specific pet rules. Many domestic violence shelters have different policies regarding pets, and it's important to confirm directly with each shelter. Would you like me to send you the contact information for the shelters I found?`,
        smsResponse: lastQueryContext.smsResponse,
        results: lastQueryContext.results,
        focusTarget: null
      };
    }
  }
  
  // "Can you send that to me?" or "Can you text me?"
  if (lowerQuery.includes('send') || lowerQuery.includes('text') || lowerQuery.includes('email')) {
    return {
      type: 'send_details',
      intent: lastQueryContext.intent,
      voiceResponse: `I'll send you the ${lastQueryContext.intent.replace('_', ' ')} details via text message. You should receive them shortly.`,
      smsResponse: lastQueryContext.smsResponse,
      results: lastQueryContext.results,
      matchedResult,
      focusTarget: matchedResult ? cleanResultTitle(matchedResult.title) : null
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
        matchedResult,
        focusTarget: cleanTitle
      };
    } else {
      return {
        type: 'location_info',
        intent: lastQueryContext.intent,
        voiceResponse: `I found ${lastQueryContext.results.length} resources in ${lastQueryContext.location || 'that area'}. How else can I help you today?`,
        smsResponse: lastQueryContext.smsResponse,
        results: lastQueryContext.results,
        focusTarget: null
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
        matchedResult,
        focusTarget: cleanTitle
      };
    } else {
      return {
        type: 'phone_info',
        intent: lastQueryContext.intent,
        voiceResponse: `I found ${lastQueryContext.results.length} resources. Would you like me to send you the contact information for all of them?`,
        smsResponse: lastQueryContext.smsResponse,
        results: lastQueryContext.results,
        focusTarget: null
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
      matchedResult,
      focusTarget: cleanTitle
    };
  }
  
  // Generic "tell me more" or "more information" requests
  if (lowerQuery.includes('more') || lowerQuery.includes('information') || lowerQuery.includes('about') || lowerQuery.includes('details')) {
    return {
      type: 'detailed_info',
      intent: lastQueryContext.intent,
      voiceResponse: generateDetailedShelterInfo(lastQueryContext),
      smsResponse: lastQueryContext.smsResponse,
      results: lastQueryContext.results,
      focusTarget: null
    };
  }
  
  // Generic follow-up response with improved formatting
  return {
    type: 'general_follow_up',
    intent: lastQueryContext.intent,
    voiceResponse: generateGenericFollowUpResponse(lastQueryContext),
    smsResponse: lastQueryContext.smsResponse,
    results: lastQueryContext.results,
    focusTarget: null
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
- Providing a location in response to a previous request that needed location (like "I'm in San Jose" or "I live in Austin")
- Confirming or correcting location information

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

// Helper function to generate response for location-only follow-ups
async function generateLocationFollowUpResponse(locationQuery, lastQueryContext, locationData) {
  try {
    // Use the pre-geocoded location data
    const location = locationData.location;
    
    if (!location) {
      return {
        type: 'location_follow_up',
        intent: lastQueryContext.intent,
        voiceResponse: "I didn't catch the location clearly. Could you please tell me which city or area you're looking for?",
        smsResponse: null,
        results: []
      };
    }
    
    // Create a new query combining the original intent with the location
    const originalQuery = lastQueryContext.lastQuery || lastQueryContext.intent.replace('_', ' ');
    const combinedQuery = `${originalQuery} in ${location}`;
    
    logger.info('Generating location follow-up response:', {
      originalQuery,
      locationQuery,
      combinedQuery,
      location,
      isComplete: locationData.isComplete
    });
    
    // Import required functions for processing
    const { callTavilyAPI } = await import('./apis.js');
    const { ResponseGenerator } = await import('./response.js');
    
    // Process the combined query with timeout handling
    let tavilyResponse;
    try {
      // Use a shorter timeout for location follow-ups to be more responsive
      const { callTavilyAPI } = await import('./apis.js');
      
      // Create a timeout promise for faster response
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Location search timeout')), 15000); // 15 second timeout
      });
      
      // Race between Tavily API call and timeout
      tavilyResponse = await Promise.race([
        callTavilyAPI(combinedQuery, location),
        timeoutPromise
      ]);
      
      // If we get here, Tavily succeeded, so format the response
      if (tavilyResponse && tavilyResponse.results && tavilyResponse.results.length > 0) {
        const { ResponseGenerator } = await import('./response.js');
        const formattedResponse = ResponseGenerator.formatTavilyResponse(tavilyResponse, 'twilio', combinedQuery, 3);
        
        return {
          type: 'location_follow_up',
          intent: lastQueryContext.intent,
          voiceResponse: formattedResponse.voiceResponse,
          smsResponse: formattedResponse.smsResponse,
          results: tavilyResponse.results,
          location: location
        };
      }
    } catch (tavilyError) {
      logger.error('Tavily API error in location follow-up:', {
        error: tavilyError.message,
        query: combinedQuery,
        location
      });
      
      // Return a helpful response even if Tavily fails
      return {
        type: 'location_follow_up',
        intent: lastQueryContext.intent,
        voiceResponse: `I'm having trouble searching for ${lastQueryContext.intent.replace('_', ' ')} resources in ${location} right now. Let me provide you with some general information about domestic violence resources in that area. You can also try calling the National Domestic Violence Hotline at 1-800-799-7233 for immediate assistance.`,
        smsResponse: `I couldn't search for ${lastQueryContext.intent.replace('_', ' ')} resources in ${location} due to a technical issue. For immediate help, call the National Domestic Violence Hotline: 1-800-799-7233 or visit thehotline.org`,
        results: [],
        location: location,
        error: tavilyError.message
      };
    }
    
    // If we get here, Tavily succeeded but returned no results
    return {
      type: 'location_follow_up',
      intent: lastQueryContext.intent,
      voiceResponse: `I couldn't find any ${lastQueryContext.intent.replace('_', ' ')} resources in ${location}. Could you try a nearby city or let me know if you need help with something else?`,
      smsResponse: null,
      results: [],
      location: location
    };
  } catch (error) {
    logger.error('Error generating location follow-up response:', error);
    return {
      type: 'location_follow_up',
      intent: lastQueryContext.intent,
      voiceResponse: "I'm having trouble processing that location. Could you please try again or let me know if you need help with something else?",
      smsResponse: null,
      results: []
    };
  }
}

/**
 * Manages conversation flow based on intent and context
 * @param {string} intent - The classified intent
 * @param {string} query - The user query
 * @param {Object} context - Conversation context
 * @returns {Object} Flow management result
 */
export function manageConversationFlow(intent, query, context) {
  // Handle null/undefined context gracefully
  if (!context) {
    return {
      shouldContinue: true,
      shouldEndCall: false,
      shouldReengage: false,
      redirectionMessage: null,
      confidence: 0.5
    };
  }

  // Use context confidence if available
  const confidence = context.confidence || 0.5;

  // Handle off-topic intents
  if (intent === 'off_topic') {
    const lowerQuery = query.toLowerCase();
    
    // Check if user wants to end conversation
    const endKeywords = ['goodbye', 'bye', 'end', 'stop', 'hang up', 'go'];
    const wantsToEnd = endKeywords.some(keyword => lowerQuery.includes(keyword));
    
    if (wantsToEnd) {
      return {
        shouldContinue: false,
        shouldEndCall: false,
        shouldReengage: false,
        redirectionMessage: "Before we end this call, I want to make sure you have the support you need. If you're experiencing domestic violence, please know that help is available 24/7. You can call the National Domestic Violence Hotline at 1-800-799-SAFE (7233) anytime.",
        confidence
      };
    }
    
    // Check if user is trying to re-engage with domestic violence topic
    const dvKeywords = ['domestic violence', 'abuse', 'shelter', 'help', 'support', 'safety'];
    const isReengaging = dvKeywords.some(keyword => lowerQuery.includes(keyword));
    
    if (isReengaging) {
      return {
        shouldContinue: true,
        shouldEndCall: false,
        shouldReengage: true,
        redirectionMessage: "I understand you're asking about domestic violence support. Let me help you find the resources you need. What specific type of help are you looking for?",
        confidence
      };
    }
    
    // General redirection for off-topic queries
    return {
      shouldContinue: true,
      shouldEndCall: false,
      shouldReengage: false,
      redirectionMessage: "I'm here to help with domestic violence support and resources. How can I assist you today?",
      confidence
    };
  }

  // Handle end conversation intent
  if (intent === 'end_conversation') {
    return {
      shouldContinue: false,
      shouldEndCall: false,
      shouldReengage: false,
      redirectionMessage: "Before we end this call, I want to make sure you have the support you need. If you're experiencing domestic violence, please know that help is available 24/7. You can call the National Domestic Violence Hotline at 1-800-799-SAFE (7233) anytime.",
      confidence
    };
  }

  // Handle emergency help with high priority
  if (intent === 'emergency_help') {
    return {
      shouldContinue: true,
      shouldEndCall: false,
      shouldReengage: false,
      redirectionMessage: null,
      confidence,
      priority: 'high'
    };
  }

  // Continue conversation for regular intents
  return {
    shouldContinue: true,
    shouldEndCall: false,
    shouldReengage: false,
    redirectionMessage: null,
    confidence
  };
}

/**
 * Determines if we should attempt to re-engage the user based on conversation history
 * @param {Object} context - Conversation context
 * @returns {boolean} Whether to attempt re-engagement
 */
export function shouldAttemptReengagement(context) {
  // Handle null/undefined context
  if (!context) return false;
  
  // Check if context has history
  if (!context.history || !Array.isArray(context.history)) return false;
  
  // Need at least 2 interactions to consider re-engagement
  if (context.history.length < 2) return false;
  
  // Count off-topic interactions
  const offTopicCount = context.history.filter(interaction => 
    interaction.intent === 'off_topic'
  ).length;
  
  // Attempt re-engagement if more than 50% of recent interactions are off-topic
  const offTopicRatio = offTopicCount / context.history.length;
  return offTopicRatio > 0.5;
}

/**
 * Generates a re-engagement message to redirect user back to domestic violence support
 * @param {Object} context - Conversation context
 * @returns {string} Re-engagement message
 */
export function generateReengagementMessage(context) {
  const messages = [
    "I'm here specifically to help with domestic violence support and resources. How can I assist you today?",
    "Let me help you find the domestic violence support you need. What type of assistance are you looking for?",
    "I understand you might have other questions, but I'm here to help with domestic violence resources. Can I help you find shelter, legal services, or other support?",
    "If you're experiencing domestic violence or know someone who is, I can help you find resources and support. What would be most helpful for you right now?",
    "I'm your domestic violence support assistant. Let me help you find the resources and information you need. What can I help you with today?"
  ];
  
  // Return a random message
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}

// Helper function to capitalize location (title case)
function toTitleCase(str) {
  if (!str) return str;
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}