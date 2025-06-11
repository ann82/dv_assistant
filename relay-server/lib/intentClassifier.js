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
          'other_resources'
        ],
        description: 'The classified intent of the user query'
      }
    },
    required: ['intent']
  }
};

// Add conversation context handling
const conversationContexts = new Map();

export function updateConversationContext(callSid, intent, query, response) {
  if (!conversationContexts.has(callSid)) {
    conversationContexts.set(callSid, {
      history: [],
      lastIntent: null,
      lastQuery: null,
      lastResponse: null
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

  logger.info('Updated conversation context:', {
    callSid,
    intent,
    historyLength: context.history.length
  });
}

export function getConversationContext(callSid) {
  return conversationContexts.get(callSid) || null;
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

  // Handle follow-up questions
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
    const isFollowUp = patterns.some(pattern => pattern.test(lowerQuery));

    if (isFollowUp) {
      // Use the last query's context for the follow-up
      rewrittenQuery = `${context.lastQuery} ${query}`;
      logger.info('Detected follow-up question:', {
        originalQuery: query,
        lastQuery: context.lastQuery,
        combinedQuery: rewrittenQuery
      });
    }
  }

  // Add "domestic violence" context if not present
  if (!lowerQuery.includes('domestic violence') && !lowerQuery.includes('domestic abuse')) {
    rewrittenQuery = `domestic violence ${rewrittenQuery}`;
  }

  // Intent-specific query enhancements
  switch (intent) {
    case 'find_shelter':
      if (!lowerQuery.includes('shelter') && !lowerQuery.includes('safe housing')) {
        rewrittenQuery = `${rewrittenQuery} emergency shelter safe housing`;
      }
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
    isFollowUp: context ? !!context.lastIntent : false
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
            - other_resources: For other types of support or resources`
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