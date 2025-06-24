import { config } from './config.js';
import logger from './logger.js';
import { rerankByRelevance } from './relevanceScorer.js';
import { fallbackResponse } from './fallbackResponder.js';
import { ResponseGenerator } from './response.js';

/**
 * Call Tavily API to search for resources
 * @param {string} query - The search query
 * @param {string} intent - The detected intent
 * @returns {Promise<string>} Formatted response with search results
 */
export async function callTavilyAPI(query, intent) {
  try {
    // Validate query parameter
    if (!query || typeof query !== 'string' || query.trim() === '') {
      logger.error('Invalid query parameter for Tavily API:', {
        query,
        type: typeof query,
        intent,
        isNull: query === null,
        isUndefined: query === undefined,
        isEmpty: query === '',
        isWhitespace: query && query.trim() === ''
      });
      throw new Error('Invalid query parameter: query must be a non-empty string');
    }

    const cleanQuery = query.trim();
    logger.info('Calling Tavily API with query:', { query: cleanQuery, intent });

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.TAVILY_API_KEY
      },
      body: JSON.stringify({
        query: cleanQuery,
        search_depth: 'advanced',
        include_answer: true,
        include_results: true,
        include_raw_content: false,
        include_domains: ['211.org', 'womenshelters.org', 'domesticshelters.org'],
        max_results: 5
      })
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.statusText}`);
    }

    const data = await response.json();
    logger.info('Tavily API response:', { 
      resultCount: data.results.length,
      query: cleanQuery
    });

    // If no results, use fallback
    if (!data.results || data.results.length === 0) {
      logger.info('No Tavily results, using fallback response');
      return await fallbackResponse(cleanQuery, intent);
    }

    // Rerank results by semantic relevance
    const rerankedResults = await rerankByRelevance(cleanQuery, data.results);
    
    // If top result has low relevance score, use fallback
    if (rerankedResults[0].relevanceScore < 0.5) {
      logger.info('Low relevance results, using fallback response', {
        topScore: rerankedResults[0].relevanceScore
      });
      return await fallbackResponse(cleanQuery, intent);
    }
    
    // Format the response
    const formattedResponse = ResponseGenerator.formatTavilyResponse({results: rerankedResults}, 'web', cleanQuery, 3);
    return formattedResponse;

  } catch (error) {
    logger.error('Error calling Tavily API:', error);
    // Use fallback on error
    return await fallbackResponse(query, intent);
  }
} 