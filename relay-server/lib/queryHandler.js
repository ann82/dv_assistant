import { getIntent } from './intentClassifier.js';
import { rewriteQuery } from './enhancedQueryRewriter.js';
import { rerankByRelevance } from './relevanceScorer.js';
import { fallbackResponse } from './fallbackResponder.js';
import { logQueryHandling } from './queryLogger.js';
import logger from './logger.js';
import { ResponseGenerator } from './response.js';
import { SearchIntegration } from '../integrations/searchIntegration.js';

// Minimum confidence score for considering Tavily results
const MIN_CONFIDENCE_SCORE = 0.7;

/**
 * Handle a user query through the complete processing pipeline
 * @param {string} query - The user's query
 * @param {string} callSid - Optional call SID for context enhancement
 * @param {string} detectedLanguage - Optional detected language code
 * @returns {Promise<{ response: string, source: 'tavily' | 'gpt' }>} The response and its source
 */
export async function handleUserQuery(query, callSid = null, detectedLanguage = 'en-US') {
  try {
    // Validate query parameter
    if (!query || typeof query !== 'string' || query.trim() === '') {
      logger.error('Invalid query parameter for user query:', {
        query,
        type: typeof query,
        isNull: query === null,
        isUndefined: query === undefined,
        isEmpty: query === '',
        isWhitespace: query && query.trim() === ''
      });
      throw new Error('Invalid query parameter: query must be a non-empty string');
    }

    const cleanQuery = query.trim();
    logger.info('Processing user query:', { query: cleanQuery });

    // STEP 1: Always classify intent first
    const intent = await getIntent(cleanQuery);
    logger.info('Intent classification:', { query: cleanQuery, intent });

    // STEP 2: Get conversation context for follow-up detection
    let context = null;
    if (callSid) {
      try {
        const { getConversationContext } = await import('./intentClassifier.js');
        context = getConversationContext(callSid);
        logger.info('Retrieved conversation context for query handler:', { callSid, context: !!context });
      } catch (contextError) {
        logger.error('Error getting conversation context in query handler:', contextError);
        // Continue without context
      }
    }

    // STEP 3: Check for follow-up questions using context
    let followUpResponse = null;
    if (context?.lastQueryContext) {
      try {
        const { handleFollowUp } = await import('./intentClassifier.js');
        followUpResponse = await handleFollowUp(cleanQuery, context.lastQueryContext);
        logger.info('Follow-up question check in query handler:', { isFollowUp: !!followUpResponse });
      } catch (followUpError) {
        logger.error('Error checking follow-up in query handler:', followUpError);
        // Continue without follow-up handling
      }
    }

    // If this is a follow-up question, handle it directly
    if (followUpResponse) {
      logger.info('Processing follow-up response in query handler:', {
        followUpType: followUpResponse.type,
        hasResults: !!followUpResponse.results,
        resultCount: followUpResponse.results?.length || 0
      });
      return { response: followUpResponse.voiceResponse || followUpResponse.smsResponse || 'No response available', source: 'follow-up' };
    }

    // STEP 4: Rewrite query based on intent using enhanced query rewriter
    const rewrittenQuery = await rewriteQuery(cleanQuery, intent);
    logger.info('Query rewritten:', { 
      original: cleanQuery,
      rewritten: rewrittenQuery,
      intent 
    });

    // Validate rewritten query
    if (!rewrittenQuery || typeof rewrittenQuery !== 'string' || rewrittenQuery.trim() === '') {
      logger.error('Invalid rewritten query:', {
        originalQuery: cleanQuery,
        rewrittenQuery,
        intent
      });
      throw new Error('Invalid rewritten query: query must be a non-empty string');
    }

    const cleanRewrittenQuery = rewrittenQuery.trim();

    // STEP 5: Only extract location if the intent is a location-seeking one
    let location = null;
    const locationSeekingIntents = ['find_shelter', 'legal_services', 'counseling_services', 'other_resources'];
    const isLocationSeekingIntent = locationSeekingIntents.includes(intent);
    
    if (isLocationSeekingIntent) {
      location = ResponseGenerator.extractLocationFromQuery(cleanRewrittenQuery);
      logger.info('Extracted location for location-seeking intent:', { intent, location });
    } else {
      logger.info('Skipping location extraction for non-location-seeking intent:', { intent });
    }

    // STEP 6: Get Tavily results using SearchIntegration
    const searchResult = await SearchIntegration.search(cleanRewrittenQuery);
    
    if (!searchResult.success) {
      logger.info('Search integration failed, using GPT fallback:', searchResult.error);
      const gptResponse = await fallbackResponse(cleanRewrittenQuery, intent, callSid, detectedLanguage);
      
      // Log query handling
      await logQueryHandling({
        query: cleanQuery,
        intent,
        usedGPT: true,
        score: 0
      });
      
      return { response: gptResponse, source: 'gpt' };
    }
    
    const tavilyData = searchResult.data;
    
    // If no results, use GPT fallback
    if (!tavilyData.results || tavilyData.results.length === 0) {
      logger.info('No Tavily results, using GPT fallback');
      const gptResponse = await fallbackResponse(cleanRewrittenQuery, intent, callSid, detectedLanguage);
      
      // Log query handling
      await logQueryHandling({
        query: cleanQuery,
        intent,
        usedGPT: true,
        score: 0
      });
      
      return { response: gptResponse, source: 'gpt' };
    }

    // Step 7: Rerank results
    const rerankedResults = await rerankByRelevance(cleanRewrittenQuery, tavilyData.results);
    const topScore = rerankedResults[0]?.relevanceScore || 0;
    
    // Check if top result meets confidence threshold
    if (topScore < MIN_CONFIDENCE_SCORE) {
      logger.info('Low confidence results, using GPT fallback', {
        topScore,
        threshold: MIN_CONFIDENCE_SCORE
      });
      const gptResponse = await fallbackResponse(cleanRewrittenQuery, intent, callSid, detectedLanguage);
      
      // Log query handling
      await logQueryHandling({
        query: cleanQuery,
        intent,
        usedGPT: true,
        score: topScore
      });
      
      return { response: gptResponse, source: 'gpt' };
    }

    // Step 8: Format Tavily response
    const formattedResponse = ResponseGenerator.formatTavilyResponse({results: rerankedResults}, 'web', cleanQuery, 3);
    
    // Log query handling
    await logQueryHandling({
      query: cleanQuery,
      intent,
      usedGPT: false,
      score: topScore
    });
    
    return { response: formattedResponse.voiceResponse, source: 'tavily' };

  } catch (error) {
    logger.error('Error in handleUserQuery:', error);
    throw error;
  }
} 