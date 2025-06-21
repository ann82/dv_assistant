import { getIntent } from './intentClassifier.js';
import { rewriteQuery } from './intentClassifier.js';
import { callTavilyAPI } from './tavily.js';
import { rerankByRelevance } from './relevanceScorer.js';
import { fallbackResponse } from './fallbackResponder.js';
import { logQueryHandling } from './queryLogger.js';
import logger from './logger.js';
import { ResponseGenerator } from './response.js';

// Minimum confidence score for considering Tavily results
const MIN_CONFIDENCE_SCORE = 0.7;

/**
 * Handle a user query through the complete processing pipeline
 * @param {string} query - The user's query
 * @returns {Promise<{ response: string, source: 'tavily' | 'gpt' }>} The response and its source
 */
export async function handleUserQuery(query) {
  try {
    logger.info('Processing user query:', { query });

    // Step 1: Get intent
    const intent = await getIntent(query);
    logger.info('Intent classification:', { query, intent });

    // Step 2: Rewrite query based on intent
    const rewrittenQuery = rewriteQuery(query, intent);
    logger.info('Query rewritten:', { 
      original: query,
      rewritten: rewrittenQuery,
      intent 
    });

    // Step 3: Get Tavily results
    const tavilyResponse = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.TAVILY_API_KEY
      },
      body: JSON.stringify({
        query: rewrittenQuery,
        search_depth: 'advanced',
        include_domains: ['211.org', 'womenshelters.org', 'domesticshelters.org'],
        max_results: 5
      })
    });

    if (!tavilyResponse.ok) {
      throw new Error(`Tavily API error: ${tavilyResponse.statusText}`);
    }

    const tavilyData = await tavilyResponse.json();
    
    // If no results, use GPT fallback
    if (!tavilyData.results || tavilyData.results.length === 0) {
      logger.info('No Tavily results, using GPT fallback');
      const gptResponse = await fallbackResponse(rewrittenQuery, intent);
      
      // Log query handling
      await logQueryHandling({
        query,
        intent,
        usedGPT: true,
        score: 0
      });
      
      return { response: gptResponse, source: 'gpt' };
    }

    // Step 4: Rerank results
    const rerankedResults = await rerankByRelevance(rewrittenQuery, tavilyData.results);
    const topScore = rerankedResults[0]?.relevanceScore || 0;
    
    // Check if top result meets confidence threshold
    if (topScore < MIN_CONFIDENCE_SCORE) {
      logger.info('Low confidence results, using GPT fallback', {
        topScore,
        threshold: MIN_CONFIDENCE_SCORE
      });
      const gptResponse = await fallbackResponse(rewrittenQuery, intent);
      
      // Log query handling
      await logQueryHandling({
        query,
        intent,
        usedGPT: true,
        score: topScore
      });
      
      return { response: gptResponse, source: 'gpt' };
    }

    // Step 5: Format Tavily response
    const formattedResponse = ResponseGenerator.formatTavilyResponse({results: rerankedResults}, 'web', query, 3);
    
    // Log query handling
    await logQueryHandling({
      query,
      intent,
      usedGPT: false,
      score: topScore
    });
    
    return { response: formattedResponse, source: 'tavily' };

  } catch (error) {
    logger.error('Error handling user query:', error);
    // Use GPT fallback on any error
    const gptResponse = await fallbackResponse(query, 'general_query');
    
    // Log query handling with error
    await logQueryHandling({
      query,
      intent: 'general_query',
      usedGPT: true,
      score: 0,
      error: error.message
    });
    
    return { response: gptResponse, source: 'gpt' };
  }
} 