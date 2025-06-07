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
          'get_information',
          'get_support_resource',
          'get_contact_details',
          'general_query'
        ],
        description: 'The classified intent of the user query'
      }
    },
    required: ['intent']
  }
};

/**
 * Rewrites a query based on the detected intent to improve search results
 * @param {string} query - The original user query
 * @param {string} intent - The detected intent
 * @returns {string} The rewritten query
 */
export function rewriteQuery(query, intent) {
  // Convert query to lowercase for consistent matching
  const lowerQuery = query.toLowerCase();
  
  // Initialize rewritten query with original
  let rewrittenQuery = query;

  // Add "domestic violence" for shelter and resource queries if not present
  if ((intent === 'find_shelter' || intent === 'get_support_resource') && 
      !lowerQuery.includes('domestic violence')) {
    rewrittenQuery = `domestic violence ${rewrittenQuery}`;
  }

  // Add "safe housing" for shelter queries if not present
  if (intent === 'find_shelter' && 
      !lowerQuery.includes('safe housing') && 
      !lowerQuery.includes('shelter')) {
    rewrittenQuery = `${rewrittenQuery} safe housing`;
  }

  // Add "support hotline" for contact queries if not present
  if (intent === 'get_contact_details' && 
      !lowerQuery.includes('hotline') && 
      !lowerQuery.includes('contact')) {
    rewrittenQuery = `${rewrittenQuery} support hotline`;
  }

  logger.info('Query rewritten:', {
    original: query,
    rewritten: rewrittenQuery,
    intent
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
          content: 'Classify the query into: find_shelter, get_information, get_support_resource, get_contact_details, or general_query.'
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
      return 'general_query';
    }

    const result = JSON.parse(functionCall.arguments);
    logger.info('Intent classification result:', result);
    return result.intent;

  } catch (error) {
    logger.error('Error classifying intent:', error);
    return 'general_query';
  }
}

// Helper functions for intent-based routing
export const intentHandlers = {
  find_shelter: async (query) => {
    // Handle shelter search queries
    return 'shelter_search';
  },
  get_information: async (query) => {
    // Handle information requests
    return 'information_search';
  },
  get_support_resource: async (query) => {
    // Handle support resource queries
    return 'resource_search';
  },
  get_contact_details: async (query) => {
    // Handle contact information queries
    return 'contact_search';
  },
  general_query: async (query) => {
    // Handle general queries
    return 'general_response';
  }
};

// Helper function to check if a query is resource-related
export function isResourceQuery(intent) {
  return ['find_shelter', 'get_support_resource', 'get_contact_details'].includes(intent);
}

// Helper function to check if a query needs factual information
export function needsFactualInfo(intent) {
  return ['get_information', 'find_shelter', 'get_contact_details'].includes(intent);
} 